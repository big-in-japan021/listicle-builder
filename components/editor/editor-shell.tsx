"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Button, buttonVariants } from "@/components/ui/button";
import { FieldRenderer } from "@/components/editor/field-renderer";
import { PreviewIframe } from "@/components/editor/preview-iframe";
import { defaultSpecFromSchema } from "@/lib/spec-utils";
import type { TemplateSchema } from "@/lib/template-schema";
import type { Spec } from "@/lib/types";
import { cn } from "@/lib/utils";

type EditorShellProps = {
  schema: TemplateSchema;
  templateName: string;
};

const STORAGE_KEY_PREFIX = "listicle-builder.spec.";

export function EditorShell({ schema, templateName }: EditorShellProps) {
  const storageKey = `${STORAGE_KEY_PREFIX}${templateName}`;
  const defaultSpec = useMemo(() => defaultSpecFromSchema(schema), [schema]);

  const [spec, setSpec] = useState<Spec>(defaultSpec);
  const [hydrated, setHydrated] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const initialLoadRan = useRef(false);

  // Hidrata do localStorage no client (evita mismatch SSR).
  useEffect(() => {
    if (initialLoadRan.current) return;
    initialLoadRan.current = true;
    try {
      const stored = window.localStorage.getItem(storageKey);
      if (stored) setSpec(JSON.parse(stored));
    } catch {
      // ignora — fica com defaults
    }
    setHydrated(true);
  }, [storageKey]);

  // Persiste a cada mudança no spec (depois de hidratar).
  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(spec));
    } catch {
      // pode estourar quota com imagens grandes em base64; ignora silenciosamente
    }
  }, [spec, hydrated, storageKey]);

  const updatePreview = useCallback(async () => {
    setPreviewLoading(true);
    try {
      const res = await fetch("/api/build", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template: templateName, spec }),
      });
      const body = (await res.json()) as { html?: string; error?: string };
      if (!res.ok || !body.html) {
        toast.error(body.error ?? "Falha ao gerar o preview");
        return;
      }
      setPreviewHtml(body.html);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro de rede");
    } finally {
      setPreviewLoading(false);
    }
  }, [spec, templateName]);

  const resetProject = useCallback(() => {
    const ok = window.confirm(
      "Isso apaga tudo que você preencheu e volta pro template em branco. Continuar?"
    );
    if (!ok) return;
    setSpec(defaultSpec);
    setPreviewHtml(null);
    try {
      window.localStorage.removeItem(storageKey);
    } catch {
      // ignora
    }
    toast.success("Projeto resetado");
  }, [defaultSpec, storageKey]);

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
            <h1 className="text-sm font-semibold">{schema.label}</h1>
            <p className="text-[11px] text-muted-foreground">{schema.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={resetProject}
          >
            Limpar projeto
          </Button>
          <Button
            type="button"
            onClick={updatePreview}
            disabled={previewLoading}
            size="sm"
          >
            {previewLoading ? "Gerando…" : "Atualizar preview"}
          </Button>
        </div>
      </header>

      {/* SPLIT — form esquerda, preview direita */}
      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-2">
        <div className="min-h-0 overflow-y-auto border-r border-border bg-card">
          <form
            className="flex flex-col gap-2 p-6"
            onSubmit={(e) => {
              e.preventDefault();
              updatePreview();
            }}
          >
            {schema.fields.map((field) => (
              <FieldRenderer
                key={field.key}
                field={field}
                spec={spec}
                pathPrefix=""
                onChange={setSpec}
              />
            ))}
            <div className="mt-8 flex items-center justify-between border-t border-border pt-6">
              <p className="text-xs text-muted-foreground">
                Mudanças são salvas no seu navegador automaticamente.
              </p>
              <button
                type="submit"
                className={cn(buttonVariants({ size: "default" }))}
              >
                Atualizar preview
              </button>
            </div>
          </form>
        </div>

        <div className="min-h-0 overflow-hidden">
          <PreviewIframe html={previewHtml} loading={previewLoading} />
        </div>
      </div>
    </div>
  );
}
