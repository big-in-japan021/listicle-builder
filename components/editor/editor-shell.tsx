"use client";

import Link from "next/link";
import pLimit from "p-limit";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PreviewIframe } from "@/components/editor/preview-iframe";
import type { EditorInput, ReviewInput } from "@/lib/editor-input";
import { getCachedImage, setCachedImage } from "@/lib/image-cache";
import {
  applyImagesToSpec,
  planSlotsForSpec,
  type PlannedSlot,
} from "@/lib/image-slots";
import type { Spec } from "@/lib/types";
import type { AiOutput } from "@/templates/listicle-classica/ai-prompts";
import { buildSpec } from "@/templates/listicle-classica/build-spec";
import {
  promptForSlot,
  type ImageContext,
} from "@/templates/listicle-classica/image-prompts";
import { cn } from "@/lib/utils";

type SlotStatus = "pending" | "generating" | "done" | "error";

type EditorShellProps = {
  templateName: string;
};

const STORAGE_KEY_PREFIX = "listicle-builder.input.";

function emptyInput(): EditorInput {
  return {
    slug: "",
    lang: "pt-BR",
    product: {
      name: "",
      price_old: "",
      price_new: "",
      cta_href: "",
      product_image_b64: undefined,
    },
    copy_raw: "",
    reviews: [
      { name: "", text: "" },
      { name: "", text: "" },
      { name: "", text: "" },
    ],
    before_after_image_b64: undefined,
    footer_logo_b64: undefined,
  };
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

/** Tenta parsear o body como JSON; se a Vercel devolveu HTML/texto (413, 504, etc),
 *  retorna um objeto T com `error` preenchido. Evita "Unexpected token..." no toast. */
async function safeReadJson<T extends { error?: string }>(
  res: Response
): Promise<T> {
  const text = await res.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    const short = text.slice(0, 200).replace(/<[^>]+>/g, "").trim();
    let error: string;
    if (res.status === 413)
      error = "Resposta grande demais (413). Imagem está pesada.";
    else if (res.status === 504)
      error = "A IA demorou demais e a função expirou (504).";
    else error = `HTTP ${res.status}: ${short || "resposta não-JSON"}`;
    return { error } as T;
  }
}

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === "string") resolve(result);
      else reject(new Error("Falha ao ler imagem"));
    };
    reader.onerror = () => reject(reader.error ?? new Error("Falha ao ler imagem"));
    reader.readAsDataURL(file);
  });
}

export function EditorShell({ templateName }: EditorShellProps) {
  const storageKey = `${STORAGE_KEY_PREFIX}${templateName}`;

  const [input, setInput] = useState<EditorInput>(emptyInput);
  const [hydrated, setHydrated] = useState(false);
  const [aiOutput, setAiOutput] = useState<AiOutput | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  /** targetPath (ex: "hero.image", "list_items.2.image") → data URI da imagem IA. */
  const [imagesMap, setImagesMap] = useState<Record<string, string>>({});
  const [slotStatuses, setSlotStatuses] = useState<Record<string, SlotStatus>>({});
  const [imagesLoading, setImagesLoading] = useState(false);
  const initialLoadRan = useRef(false);

  // Hidrata do localStorage
  useEffect(() => {
    if (initialLoadRan.current) return;
    initialLoadRan.current = true;
    try {
      const stored = window.localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored) as { input?: EditorInput; ai?: AiOutput };
        if (parsed.input) setInput(parsed.input);
        if (parsed.ai) setAiOutput(parsed.ai);
      }
    } catch {
      // ignora
    }
    setHydrated(true);
  }, [storageKey]);

  // Persiste
  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(
        storageKey,
        JSON.stringify({ input, ai: aiOutput })
      );
    } catch {
      // imagens grandes em base64 podem estourar a quota; segue silencioso
    }
  }, [input, aiOutput, hydrated, storageKey]);

  // ── ATIONS ──────────────────────────────────────────────────────
  const handleStructure = useCallback(async () => {
    // Prepara o input pra envio (filtra reviews vazias, gera slug se faltar)
    const cleanReviews = input.reviews.filter(
      (r) => r.name.trim() !== "" && r.text.trim() !== ""
    );
    if (cleanReviews.length === 0) {
      toast.error("Preencha pelo menos 1 review (nome + depoimento).");
      return;
    }
    if (input.copy_raw.trim().length < 20) {
      toast.error("Cola pelo menos um parágrafo da copy.");
      return;
    }
    if (!input.product.name.trim()) {
      toast.error("Preencha o nome do produto.");
      return;
    }
    const finalSlug = input.slug.trim() || slugify(input.product.name) || "nova-listicle";
    const payload: EditorInput = {
      ...input,
      slug: finalSlug,
      reviews: cleanReviews,
    };

    setAiLoading(true);
    try {
      const res = await fetch("/api/structure-copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await safeReadJson<{
        spec?: Spec;
        html?: string;
        ai?: AiOutput;
        error?: string;
        details?: unknown;
      }>(res);
      if (!res.ok || !body.html) {
        toast.error(body.error ?? "Falha ao estruturar com IA");
        return;
      }
      if (body.ai) setAiOutput(body.ai);
      if (body.html) setPreviewHtml(body.html);
      if (payload.slug !== input.slug) setInput((p) => ({ ...p, slug: finalSlug }));
      // Nova estrutura = reset das imagens IA antigas (que podem não fazer mais sentido).
      setImagesMap({});
      setSlotStatuses({});
      toast.success("Copy estruturada — preview atualizado.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro de rede");
    } finally {
      setAiLoading(false);
    }
  }, [input]);

  // Rebuild preview localmente (com aiOutput cacheado) — usar quando trocou só
  // preço/imagem/link, pra não gastar tokens.
  const handleRefreshPreview = useCallback(async () => {
    if (!aiOutput) {
      // sem AI ainda — força chamar estrutura
      return handleStructure();
    }
    const cleanReviews = input.reviews.filter(
      (r) => r.name.trim() !== "" && r.text.trim() !== ""
    );
    const finalSlug =
      input.slug.trim() || slugify(input.product.name) || "nova-listicle";
    const inputForBuild: EditorInput = {
      ...input,
      slug: finalSlug,
      reviews: cleanReviews,
    };

    setPreviewLoading(true);
    try {
      const baseSpec = buildSpec(inputForBuild, aiOutput);
      const spec = applyImagesToSpec(baseSpec, imagesMap);
      const res = await fetch("/api/build", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template: templateName, spec }),
      });
      const body = await safeReadJson<{ html?: string; error?: string }>(res);
      if (!res.ok || !body.html) {
        toast.error(body.error ?? "Falha ao gerar preview");
        return;
      }
      setPreviewHtml(body.html);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro de rede");
    } finally {
      setPreviewLoading(false);
    }
  }, [aiOutput, imagesMap, input, templateName, handleStructure]);

  // ── GERAÇÃO DE IMAGENS IA ───────────────────────────────────────
  const handleGenerateImages = useCallback(async () => {
    if (!aiOutput) {
      toast.error('Primeiro clique em "Estruturar com IA".');
      return;
    }
    const cleanReviews = input.reviews.filter(
      (r) => r.name.trim() !== "" && r.text.trim() !== ""
    );
    const finalSlug =
      input.slug.trim() || slugify(input.product.name) || "nova-listicle";
    const inputForPlan: EditorInput = {
      ...input,
      slug: finalSlug,
      reviews: cleanReviews,
    };

    const baseSpec = buildSpec(inputForPlan, aiOutput);
    const plan = planSlotsForSpec(baseSpec);
    if (plan.length === 0) {
      toast.success("Todas as imagens já estão preenchidas.");
      return;
    }

    const ctx: ImageContext = {
      product_category: aiOutput.product_category,
      customer_description: aiOutput.target_customer,
    };

    setImagesLoading(true);
    setSlotStatuses(
      Object.fromEntries(plan.map((p) => [p.id, "pending" as SlotStatus]))
    );

    const limit = pLimit(4);
    const generateOne = async (p: PlannedSlot) => {
      setSlotStatuses((prev) => ({ ...prev, [p.id]: "generating" }));
      const promptInfo = promptForSlot(p.slot, ctx);
      const quality = "high";
      try {
        const cached = await getCachedImage(
          promptInfo.prompt,
          promptInfo.size,
          quality
        );
        if (cached) {
          setImagesMap((prev) => ({ ...prev, [p.targetPath]: cached }));
          setSlotStatuses((prev) => ({ ...prev, [p.id]: "done" }));
          return;
        }
        const res = await fetch("/api/generate-image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slot: p.slot, context: ctx, quality }),
        });
        const body = await safeReadJson<{
          image_b64?: string;
          error?: string;
        }>(res);
        if (!res.ok || !body.image_b64) {
          console.warn(`Slot ${p.id} falhou:`, body.error);
          setSlotStatuses((prev) => ({ ...prev, [p.id]: "error" }));
          return;
        }
        await setCachedImage(
          promptInfo.prompt,
          promptInfo.size,
          quality,
          body.image_b64
        );
        setImagesMap((prev) => ({ ...prev, [p.targetPath]: body.image_b64! }));
        setSlotStatuses((prev) => ({ ...prev, [p.id]: "done" }));
      } catch (err) {
        console.warn(`Slot ${p.id} erro:`, err);
        setSlotStatuses((prev) => ({ ...prev, [p.id]: "error" }));
      }
    };

    await Promise.all(plan.map((p) => limit(() => generateOne(p))));
    setImagesLoading(false);
    const failed = Object.values(slotStatuses).filter((s) => s === "error").length;
    if (failed > 0) {
      toast.error(
        `${plan.length - failed}/${plan.length} imagens prontas — ${failed} falharam.`
      );
    } else {
      toast.success(`${plan.length} imagens prontas.`);
    }
  }, [aiOutput, input, slotStatuses]);

  // Debounce: a cada mudança em imagesMap, refazer o preview com as novas imagens.
  useEffect(() => {
    if (!aiOutput) return;
    if (Object.keys(imagesMap).length === 0 && !previewHtml) return;
    const timer = setTimeout(() => {
      void handleRefreshPreview();
    }, 600);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imagesMap]);

  // Após hidratar, se já tinha aiOutput, tenta restaurar imagens do cache.
  useEffect(() => {
    if (!hydrated || !aiOutput) return;
    let cancelled = false;
    (async () => {
      const cleanReviews = input.reviews.filter(
        (r) => r.name.trim() !== "" && r.text.trim() !== ""
      );
      const inputForPlan: EditorInput = {
        ...input,
        slug: input.slug || slugify(input.product.name) || "nova-listicle",
        reviews: cleanReviews,
      };
      const baseSpec = buildSpec(inputForPlan, aiOutput);
      const plan = planSlotsForSpec(baseSpec);
      const ctx: ImageContext = {
        product_category: aiOutput.product_category,
        customer_description: aiOutput.target_customer,
      };
      const restored: Record<string, string> = {};
      for (const p of plan) {
        const promptInfo = promptForSlot(p.slot, ctx);
        const cached = await getCachedImage(
          promptInfo.prompt,
          promptInfo.size,
          "high"
        );
        if (cached) restored[p.targetPath] = cached;
      }
      if (!cancelled && Object.keys(restored).length > 0) {
        setImagesMap(restored);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, aiOutput]);

  const generatedCount = useMemo(
    () =>
      Object.values(slotStatuses).filter((s) => s === "done" || s === "error")
        .length,
    [slotStatuses]
  );
  const totalSlots = useMemo(
    () => Object.keys(slotStatuses).length,
    [slotStatuses]
  );

  const handleReset = useCallback(() => {
    const ok = window.confirm(
      "Isso apaga tudo (copy, fotos, reviews, preview, imagens IA) e volta ao zero. Continuar?"
    );
    if (!ok) return;
    setInput(emptyInput());
    setAiOutput(null);
    setPreviewHtml(null);
    setImagesMap({});
    setSlotStatuses({});
    try {
      window.localStorage.removeItem(storageKey);
    } catch {
      // ignora
    }
    toast.success("Projeto resetado");
  }, [storageKey]);

  // ── UPDATERS ────────────────────────────────────────────────────
  const updateProduct = <K extends keyof EditorInput["product"]>(
    k: K,
    v: EditorInput["product"][K]
  ) => setInput((p) => ({ ...p, product: { ...p.product, [k]: v } }));

  const updateReview = (i: number, k: keyof ReviewInput, v: string) =>
    setInput((p) => {
      const next = [...p.reviews];
      next[i] = { ...next[i], [k]: v };
      return { ...p, reviews: next };
    });

  const addReview = () =>
    setInput((p) => ({ ...p, reviews: [...p.reviews, { name: "", text: "" }] }));

  const removeReview = (i: number) =>
    setInput((p) => ({
      ...p,
      reviews: p.reviews.filter((_, idx) => idx !== i),
    }));

  const handleImage = async (
    field: "product_image_b64" | "before_after_image_b64" | "footer_logo_b64",
    file: File | null
  ) => {
    if (!file) return;
    try {
      const dataUrl = await fileToDataUrl(file);
      if (field === "product_image_b64") updateProduct("product_image_b64", dataUrl);
      else setInput((p) => ({ ...p, [field]: dataUrl }));
    } catch {
      toast.error("Falha ao ler a imagem.");
    }
  };

  const clearImage = (
    field: "product_image_b64" | "before_after_image_b64" | "footer_logo_b64"
  ) => {
    if (field === "product_image_b64") updateProduct("product_image_b64", undefined);
    else setInput((p) => ({ ...p, [field]: undefined }));
  };

  // ── RENDER ──────────────────────────────────────────────────────
  return (
    <div className="flex h-screen w-full flex-col bg-background">
      {/* TOPO */}
      <header className="flex items-center justify-between border-b border-border bg-card px-6 py-3">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            ← Início
          </Link>
          <div className="flex flex-col">
            <h1 className="text-sm font-semibold">Listicle Clássica</h1>
            <p className="text-[11px] text-muted-foreground">
              Cole sua copy bruta. A IA distribui no template.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={handleReset}>
            Limpar projeto
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleRefreshPreview}
            disabled={previewLoading || aiLoading || !aiOutput}
            title={
              !aiOutput
                ? "Primeiro clique em 'Estruturar com IA'"
                : "Recarrega o preview com os dados atuais"
            }
          >
            {previewLoading ? "Gerando…" : "Atualizar preview"}
          </Button>
          <Button
            type="button"
            onClick={handleStructure}
            disabled={aiLoading || previewLoading || imagesLoading}
            size="sm"
          >
            {aiLoading ? "Estruturando…" : "Estruturar com IA"}
          </Button>
          <Button
            type="button"
            onClick={handleGenerateImages}
            disabled={!aiOutput || aiLoading || imagesLoading}
            size="sm"
            variant="outline"
            title={
              !aiOutput
                ? "Estruture a copy primeiro"
                : "Gera as imagens IA via OpenAI (~$2 em créditos por listicle)"
            }
          >
            {imagesLoading
              ? `Gerando ${generatedCount}/${totalSlots}…`
              : "Gerar imagens"}
          </Button>
        </div>
      </header>

      {/* SPLIT */}
      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-2">
        <div className="min-h-0 overflow-y-auto border-r border-border bg-card">
          <form
            className="flex flex-col gap-8 p-6"
            onSubmit={(e) => {
              e.preventDefault();
              handleStructure();
            }}
          >
            {/* BLOCO 1 — INFO DO PROJETO */}
            <Section title="1. Identificação" subtitle="Dados básicos do projeto.">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Nome do produto">
                  <Input
                    value={input.product.name}
                    onChange={(e) => updateProduct("name", e.target.value)}
                    placeholder="Ex: Arctic Goddess"
                  />
                </Field>
                <Field label="Idioma">
                  <select
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm"
                    value={input.lang}
                    onChange={(e) => setInput((p) => ({ ...p, lang: e.target.value }))}
                  >
                    <option value="pt-BR">Português (Brasil)</option>
                    <option value="en">English</option>
                    <option value="es">Español</option>
                  </select>
                </Field>
                <Field
                  label="Slug do projeto"
                  help="Nome curto pra pasta de download. Se vazio, geramos a partir do nome do produto."
                >
                  <Input
                    value={input.slug}
                    onChange={(e) =>
                      setInput((p) => ({ ...p, slug: slugify(e.target.value) }))
                    }
                    placeholder={slugify(input.product.name) || "nova-listicle"}
                  />
                </Field>
              </div>
            </Section>

            {/* BLOCO 2 — COPY */}
            <Section
              title="2. Copy bruta"
              subtitle="Cole tudo: headline, resumo, motivos numerados, copy da timeline. A IA separa cada coisa no lugar certo. Não precisa formatar HTML."
            >
              <Textarea
                value={input.copy_raw}
                rows={18}
                onChange={(e) =>
                  setInput((p) => ({ ...p, copy_raw: e.target.value }))
                }
                placeholder="Cola aqui sua copy completa. Quebra de linha vira parágrafo automaticamente."
                className="font-mono text-sm"
              />
              <p className="text-[11px] text-muted-foreground">
                {input.copy_raw.length} caracteres
              </p>
            </Section>

            {/* BLOCO 3 — OFERTA */}
            <Section
              title="3. Oferta"
              subtitle="Preço, link, fotos do produto. A IA não toca nesses números (zero risco de inventar preço)."
            >
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Preço antigo (riscado)">
                  <Input
                    value={input.product.price_old}
                    onChange={(e) => updateProduct("price_old", e.target.value)}
                    placeholder="R$ 159,80"
                  />
                </Field>
                <Field label="Preço novo (em destaque)">
                  <Input
                    value={input.product.price_new}
                    onChange={(e) => updateProduct("price_new", e.target.value)}
                    placeholder="R$ 79,90"
                  />
                </Field>
                <Field label="Link do checkout" className="sm:col-span-2">
                  <Input
                    value={input.product.cta_href}
                    onChange={(e) => updateProduct("cta_href", e.target.value)}
                    placeholder="https://seu-checkout.com/produto"
                  />
                </Field>
              </div>
            </Section>

            {/* BLOCO 4 — IMAGENS FIXAS */}
            <Section
              title="4. Imagens fixas"
              subtitle="Foto do produto é obrigatória pras ofertas. Antes/depois e logo são opcionais. Hero, autor, itens e fotos de reviews vão ser gerados por IA no Sprint 5."
            >
              <div className="grid grid-cols-1 gap-3">
                <ImageInput
                  label="Foto do produto"
                  value={input.product.product_image_b64}
                  onPick={(f) => handleImage("product_image_b64", f)}
                  onClear={() => clearImage("product_image_b64")}
                />
                <ImageInput
                  label="Foto antes/depois (timeline) — opcional"
                  value={input.before_after_image_b64}
                  onPick={(f) => handleImage("before_after_image_b64", f)}
                  onClear={() => clearImage("before_after_image_b64")}
                />
                <ImageInput
                  label="Logo da marca (footer) — opcional"
                  value={input.footer_logo_b64}
                  onPick={(f) => handleImage("footer_logo_b64", f)}
                  onClear={() => clearImage("footer_logo_b64")}
                />
              </div>
            </Section>

            {/* BLOCO 5 — REVIEWS */}
            <Section
              title="5. Reviews"
              subtitle="Cola nome + depoimento de cada cliente. Estrelas 5★ e data são automáticas. A foto será gerada por IA no Sprint 5."
            >
              <div className="flex flex-col gap-3">
                {input.reviews.map((r, i) => (
                  <Card
                    key={i}
                    className="flex flex-col gap-2 border-border bg-card p-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Review {i + 1}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="xs"
                        onClick={() => removeReview(i)}
                        disabled={input.reviews.length <= 1}
                      >
                        Remover
                      </Button>
                    </div>
                    <Input
                      value={r.name}
                      placeholder="Nome do cliente"
                      onChange={(e) => updateReview(i, "name", e.target.value)}
                    />
                    <Textarea
                      value={r.text}
                      rows={3}
                      placeholder="Depoimento"
                      onChange={(e) => updateReview(i, "text", e.target.value)}
                    />
                  </Card>
                ))}
                <Button type="button" variant="outline" size="sm" onClick={addReview}>
                  + Adicionar review
                </Button>
              </div>
            </Section>

            <div className="mt-2 flex flex-col gap-3 border-t border-border pt-6">
              <p className="text-xs text-muted-foreground">
                Mudanças são salvas no seu navegador automaticamente. Clica em
                &ldquo;Estruturar com IA&rdquo; quando estiver pronto.
              </p>
              <button
                type="submit"
                className={cn(buttonVariants({ size: "lg" }), "w-full")}
                disabled={aiLoading || previewLoading}
              >
                {aiLoading ? "Estruturando com IA…" : "Estruturar e gerar preview"}
              </button>
            </div>
          </form>
        </div>

        <div className="min-h-0 overflow-hidden">
          <PreviewIframe html={previewHtml} loading={previewLoading || aiLoading} />
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
//  COMPONENTES AUXILIARES
// ════════════════════════════════════════════════════════════════════
function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 className="text-sm font-semibold">{title}</h2>
        {subtitle ? (
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function Field({
  label,
  help,
  className,
  children,
}: {
  label: string;
  help?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label className="text-xs">{label}</Label>
      {children}
      {help ? <p className="text-[11px] text-muted-foreground">{help}</p> : null}
    </div>
  );
}

function ImageInput({
  label,
  value,
  onPick,
  onClear,
}: {
  label: string;
  value: string | undefined;
  onPick: (f: File | null) => void;
  onClear: () => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label className="text-xs">{label}</Label>
      <div className="flex items-center gap-3">
        <label
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "cursor-pointer"
          )}
        >
          {value ? "Trocar" : "Subir"}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => onPick(e.target.files?.[0] ?? null)}
          />
        </label>
        {value ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={value}
              alt={label}
              className="h-12 w-12 rounded-md object-cover ring-1 ring-border"
            />
            <Button type="button" variant="ghost" size="xs" onClick={onClear}>
              Remover
            </Button>
          </>
        ) : (
          <span className="text-[11px] italic text-muted-foreground">
            sem imagem
          </span>
        )}
      </div>
    </div>
  );
}
