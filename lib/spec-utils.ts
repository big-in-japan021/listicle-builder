// Utilitários pra mexer no Spec a partir de paths em string ("hero.title_html",
// "list_items.0.text_html") e construir o spec inicial a partir do schema.

import { isGroup, isList, type Field, type TemplateSchema } from "./template-schema";
import type { Spec } from "./types";

export type SpecPath = string;

export function getPath(obj: unknown, path: SpecPath): unknown {
  const parts = path.split(".");
  let cur: unknown = obj;
  for (const p of parts) {
    if (cur === null || cur === undefined) return undefined;
    if (Array.isArray(cur)) cur = cur[Number(p)];
    else if (typeof cur === "object") cur = (cur as Record<string, unknown>)[p];
    else return undefined;
  }
  return cur;
}

/**
 * Retorna uma cópia rasa do objeto com o `path` setado pra `value`.
 * Cria objetos/arrays intermediários conforme o segmento for número ou string.
 */
export function setPath<T>(obj: T, path: SpecPath, value: unknown): T {
  const parts = path.split(".");
  const clone = structuredClone(obj);
  let cur: Record<string, unknown> | unknown[] = clone as unknown as
    | Record<string, unknown>
    | unknown[];
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i];
    const nextP = parts[i + 1];
    const nextIsIndex = /^\d+$/.test(nextP);
    if (Array.isArray(cur)) {
      const idx = Number(p);
      if (cur[idx] === undefined || cur[idx] === null) {
        cur[idx] = nextIsIndex ? [] : {};
      }
      cur = cur[idx] as Record<string, unknown> | unknown[];
    } else {
      if (cur[p] === undefined || cur[p] === null) {
        cur[p] = nextIsIndex ? [] : {};
      }
      cur = cur[p] as Record<string, unknown> | unknown[];
    }
  }
  const last = parts[parts.length - 1];
  if (Array.isArray(cur)) cur[Number(last)] = value;
  else cur[last] = value;
  return clone;
}

/** Cria um item "vazio" (com defaults aplicados) pra inserir numa list field. */
export function emptyItemForList(field: { fields: Field[] }, index: number): Record<string, unknown> {
  const item: Record<string, unknown> = {};
  for (const f of field.fields) {
    const initial = initialValueForField(f, index);
    if (initial !== undefined) {
      setDotted(item, f.key, initial);
    }
  }
  return item;
}

function setDotted(obj: Record<string, unknown>, key: string, value: unknown) {
  const parts = key.split(".");
  let cur: Record<string, unknown> = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i];
    if (typeof cur[p] !== "object" || cur[p] === null) cur[p] = {};
    cur = cur[p] as Record<string, unknown>;
  }
  cur[parts[parts.length - 1]] = value;
}

function initialValueForField(field: Field, indexInParentList?: number): unknown {
  if (isGroup(field)) {
    const obj: Record<string, unknown> = {};
    for (const f of field.fields) {
      const v = initialValueForField(f, indexInParentList);
      if (v !== undefined) setDotted(obj, f.key, v);
    }
    return obj;
  }
  if (isList(field)) {
    const minCount = field.min ?? 0;
    const recommended = field.recommended_count?.[0] ?? minCount;
    const count = Math.max(minCount, recommended);
    const arr: unknown[] = [];
    for (let i = 0; i < count; i++) {
      arr.push(emptyItemForList(field, i));
    }
    return arr;
  }
  // Leaf
  if (field.default !== undefined) return field.default;
  if (field.default_from_index && indexInParentList !== undefined) {
    return String(indexInParentList + 1);
  }
  switch (field.type) {
    case "text":
    case "html":
      return "";
    case "number":
      return 0;
    case "boolean":
      return false;
    case "image":
    case "image_ai":
      return "";
    case "string_list":
      return [];
    default:
      return undefined;
  }
}

/** Cria um Spec preenchido com os defaults do schema. */
export function defaultSpecFromSchema(schema: TemplateSchema): Spec {
  const spec: Record<string, unknown> = {};
  for (const f of schema.fields) {
    const v = initialValueForField(f);
    if (v !== undefined) setDotted(spec, f.key, v);
  }
  return spec as Spec;
}
