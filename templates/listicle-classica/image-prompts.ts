// Port do prompts.py para TypeScript.
// Cada função gera o prompt da OpenAI gpt-image-1 para um slot de imagem.

const STYLE_PREFIX =
  "Photorealistic editorial photography style, " +
  "natural lighting, shallow depth of field, real textures, " +
  "no over-retouching, no plastic skin, real-looking imperfections preserved, " +
  "authentic candid feel like a magazine article photo. ";

const NEGATIVE =
  " Avoid: cartoonish, 3D render, illustration, glossy CGI, " +
  "stock photo cliches, perfect symmetry, watermarks, text overlays, " +
  "plastic skin, uncanny features, AI-typical hands or eyes.";

export type ImageSize = "1024x1024" | "1024x1536" | "1536x1024";

/** Contexto comum: vem do AiOutput + EditorInput. */
export type ImageContext = {
  /** "natural weight loss supplement for women 30+" */
  product_category: string;
  /** "Brazilian woman, 35-55 years old, natural skin tone" */
  customer_description: string;
};

export type ImagePromptResult = {
  prompt: string;
  size: ImageSize;
};

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

// ─── HERO: imagem grande horizontal ──────────────────────────────────
export function heroImagePrompt(ctx: ImageContext): ImagePromptResult {
  return {
    prompt:
      STYLE_PREFIX +
      `Wide editorial header image for an article about ${ctx.product_category}. ` +
      `Shows ${ctx.customer_description} in a real moment ` +
      "(e.g. morning routine, looking in mirror, holding a glass of water, smiling outdoors). " +
      "Warm natural light, lifestyle magazine aesthetic. " +
      "Composition: subject on left or right, soft background, horizontal banner crop. " +
      "Should evoke transformation, health, real life — not a sterile product shot." +
      NEGATIVE,
    size: "1536x1024",
  };
}

// ─── AUTOR: foto pequena redonda ─────────────────────────────────────
export function authorPhotoPrompt(
  ctx: ImageContext,
  authorName: string
): ImagePromptResult {
  return {
    prompt:
      STYLE_PREFIX +
      `Headshot portrait of '${authorName}', a professional female journalist or health writer, ` +
      "30-45 years old, friendly trustworthy expression, simple neutral background. " +
      "Looking directly at camera, slight smile, business-casual outfit. " +
      "Looks like a real byline photo from a wellness magazine, not a stock photo." +
      NEGATIVE,
    size: "1024x1024",
  };
}

// ─── ITEM DA LISTICLE ────────────────────────────────────────────────
export function listItemImagePrompt(
  ctx: ImageContext,
  titleHtml: string
): ImagePromptResult {
  const titleText = stripHtml(titleHtml);
  return {
    prompt:
      STYLE_PREFIX +
      `Lifestyle photograph illustrating the benefit: '${titleText}'. ` +
      `Subject: ${ctx.customer_description}. ` +
      "Real candid moment, NOT a product shot. " +
      "Soft natural light, warm colors, magazine editorial style. " +
      "Horizontal landscape crop." +
      NEGATIVE,
    size: "1536x1024",
  };
}

// ─── REVIEW ──────────────────────────────────────────────────────────
export function reviewPhotoPrompt(
  ctx: ImageContext,
  name: string
): ImagePromptResult {
  return {
    prompt:
      STYLE_PREFIX +
      `Casual portrait of a real person, name reference: '${name}'. ` +
      `${ctx.customer_description}, ` +
      "looking like they just took a selfie at home, " +
      "natural light from window, neutral home background, " +
      "slight smile, looking at camera, everyday clothing. " +
      "Should feel like a real customer testimonial photo, " +
      "not a polished model shoot." +
      NEGATIVE,
    size: "1024x1024",
  };
}

// ─── BEFORE/AFTER ────────────────────────────────────────────────────
export function beforeAfterImagePrompt(ctx: ImageContext): ImagePromptResult {
  return {
    prompt:
      STYLE_PREFIX +
      `Side-by-side before/after transformation photo of ${ctx.customer_description}. ` +
      "Two panels: left side shows 'before' state (heavier, tired, less confident), " +
      "right side shows 'after' (leaner, vibrant, confident). " +
      "Same lighting and pose for fair comparison. " +
      "Real-looking, not exaggerated. " +
      "Horizontal landscape crop." +
      NEGATIVE,
    size: "1536x1024",
  };
}

// ─── DISPATCH ────────────────────────────────────────────────────────
export type ImageSlot =
  | { kind: "hero" }
  | { kind: "author"; name: string }
  | { kind: "list_item"; index: number; title_html: string }
  | { kind: "review"; index: number; name: string }
  | { kind: "before_after" };

export function promptForSlot(
  slot: ImageSlot,
  ctx: ImageContext
): ImagePromptResult {
  switch (slot.kind) {
    case "hero":
      return heroImagePrompt(ctx);
    case "author":
      return authorPhotoPrompt(ctx, slot.name);
    case "list_item":
      return listItemImagePrompt(ctx, slot.title_html);
    case "review":
      return reviewPhotoPrompt(ctx, slot.name);
    case "before_after":
      return beforeAfterImagePrompt(ctx);
  }
}
