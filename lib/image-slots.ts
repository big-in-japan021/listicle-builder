// Enumera quais slots de imagem precisam de geração via IA, a partir de um Spec
// já estruturado pela Claude + o input do usuário (uploads).

import type { ImageSlot } from "@/templates/listicle-classica/image-prompts";
import type { Spec } from "./types";

export type PlannedSlot = {
  /** ID estável (vira chave do imagesMap no client). */
  id: string;
  /** Definição usada para gerar o prompt. */
  slot: ImageSlot;
  /** Caminho dentro do Spec onde a URL final vai ser injetada. */
  targetPath: string;
};

/**
 * Lista os slots que ainda não têm imagem (string vazia no spec).
 * Não considera uploads do usuário — se hero.image já está preenchido (sprite,
 * data URI, etc), ele não vira slot a gerar.
 */
export function planSlotsForSpec(spec: Spec): PlannedSlot[] {
  const plan: PlannedSlot[] = [];

  if (!spec.hero?.image) {
    plan.push({ id: "hero", slot: { kind: "hero" }, targetPath: "hero.image" });
  }

  const authorName = spec.hero?.author?.name;
  if (authorName && !spec.hero?.author?.photo) {
    plan.push({
      id: "author",
      slot: { kind: "author", name: authorName },
      targetPath: "hero.author.photo",
    });
  }

  (spec.list_items ?? []).forEach((item, i) => {
    if (item.image) return;
    plan.push({
      id: `list_item_${i}`,
      slot: { kind: "list_item", index: i, title_html: item.title_html ?? "" },
      targetPath: `list_items.${i}.image`,
    });
  });

  (spec.reviews ?? []).forEach((rev, i) => {
    if (rev.photo) return;
    if (!rev.name) return;
    plan.push({
      id: `review_${i}`,
      slot: { kind: "review", index: i, name: rev.name },
      targetPath: `reviews.${i}.photo`,
    });
  });

  if (!spec.timeline?.before_after_image) {
    plan.push({
      id: "before_after",
      slot: { kind: "before_after" },
      targetPath: "timeline.before_after_image",
    });
  }

  return plan;
}

/**
 * Aplica imagens (dataURIs) num spec, retornando uma cópia com as URLs injetadas
 * nos caminhos certos. Não muta o original.
 */
export function applyImagesToSpec(
  spec: Spec,
  imagesByPath: Record<string, string>
): Spec {
  const clone = structuredClone(spec);
  for (const [pathStr, value] of Object.entries(imagesByPath)) {
    if (!value) continue;
    setPath(clone, pathStr, value);
  }
  return clone;
}

function setPath<T extends object>(obj: T, path: string, value: string) {
  const parts = path.split(".");
  let cur: Record<string, unknown> | unknown[] = obj as unknown as
    | Record<string, unknown>
    | unknown[];
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i];
    if (Array.isArray(cur)) {
      const idx = Number(p);
      if (cur[idx] === undefined || cur[idx] === null) cur[idx] = {};
      cur = cur[idx] as Record<string, unknown> | unknown[];
    } else {
      if ((cur as Record<string, unknown>)[p] === undefined) {
        (cur as Record<string, unknown>)[p] = {};
      }
      cur = (cur as Record<string, unknown>)[p] as
        | Record<string, unknown>
        | unknown[];
    }
  }
  const last = parts[parts.length - 1];
  if (Array.isArray(cur)) cur[Number(last)] = value;
  else (cur as Record<string, unknown>)[last] = value;
}
