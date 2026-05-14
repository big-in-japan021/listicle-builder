// Tipos do schema.json — descrevem os slots de um template.

export type FieldType =
  | "text"
  | "html"
  | "number"
  | "boolean"
  | "image"
  | "image_ai"
  | "string_list"
  | "group"
  | "list";

export type BaseField = {
  key: string;
  label: string;
  type: FieldType;
  default?: unknown;
  /** Quando true, o índice (i+1) é usado como valor inicial. Aplica em "number" de list_items. */
  default_from_index?: boolean;
  placeholder?: string;
  help?: string;
  /** Para textareas. */
  rows?: number;
  /** Se este campo deve ser preenchido pela IA (Sprint 4). */
  ai_extract?: boolean;
  /** Para image_ai: identificador do prompt em ai-prompts.ts (Sprint 5). */
  ai_prompt_key?: string;
  /** Para image_ai: nome do arquivo gerado (sem extensão). */
  image_fname?: string;
  /** Para image_ai em listas: template tipo "list_item_{index_plus_1}". */
  image_fname_template?: string;
};

export type LeafField = BaseField & {
  type: "text" | "html" | "number" | "boolean" | "image" | "image_ai" | "string_list";
};

export type GroupField = BaseField & {
  type: "group";
  fields: Field[];
};

export type ListField = BaseField & {
  type: "list";
  min?: number;
  max?: number;
  recommended_count?: [number, number];
  item_label_template?: string;
  fields: Field[];
};

export type Field = LeafField | GroupField | ListField;

export type TemplateSchema = {
  name: string;
  label: string;
  description: string;
  fields: Field[];
};

export function isGroup(f: Field): f is GroupField {
  return f.type === "group";
}
export function isList(f: Field): f is ListField {
  return f.type === "list";
}
