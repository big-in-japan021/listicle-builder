// EditorInput — formato simplificado do que o usuário preenche no editor.
// Tudo o que não está aqui é preenchido pela IA ou por defaults hardcoded.

import { z } from "zod";

export type ReviewInput = {
  name: string;
  text: string;
};

export type EditorInput = {
  slug: string;
  lang: string;
  product: {
    name: string;
    price_old: string;
    price_new: string;
    cta_href: string;
    /** data: URI da foto do produto (foto que o usuário subiu). */
    product_image_b64?: string;
  };
  copy_raw: string;
  reviews: ReviewInput[];
  /** data: URI opcional. */
  before_after_image_b64?: string;
  /** data: URI opcional. */
  footer_logo_b64?: string;
};

export const reviewInputSchema = z.object({
  name: z.string().min(1, "Nome obrigatório"),
  text: z.string().min(1, "Depoimento obrigatório"),
});

export const editorInputSchema = z.object({
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/, "Use só letras minúsculas, números e -"),
  lang: z.string().default("pt-BR"),
  product: z.object({
    name: z.string().min(1, "Nome do produto obrigatório"),
    price_old: z.string().default(""),
    price_new: z.string().default(""),
    cta_href: z
      .string()
      .default("")
      .refine(
        (v) => v === "" || /^https?:\/\//.test(v),
        "URL do checkout precisa começar com http:// ou https://"
      ),
    product_image_b64: z.string().optional(),
  }),
  copy_raw: z.string().min(20, "Cola pelo menos um parágrafo da copy"),
  reviews: z.array(reviewInputSchema).default([]),
  before_after_image_b64: z.string().optional(),
  footer_logo_b64: z.string().optional(),
});

export type ValidEditorInput = z.infer<typeof editorInputSchema>;
