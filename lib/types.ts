// Tipos compartilhados entre front, API e motor de build.

/** Item de uma lista de bullets de uma das listicles. */
export type ListItemSpec = {
  number?: string;
  title_html?: string;
  /** URL ou data: URI da imagem; vazio = placeholder. */
  image?: string;
  text_html?: string;
  emoji_list?: string[];
  /** Prompt em inglês pra gerar a imagem desse item via gpt-image-2 (preenchido pela Claude). */
  image_prompt?: string;
};

export type AuthorSpec = {
  photo?: string;
  name?: string;
  date?: string;
};

export type HeroSpec = {
  image?: string;
  stars?: string;
  social_proof?: string;
  title_html?: string;
  author?: AuthorSpec;
  summary_html?: string;
};

export type OfferSpec = {
  title_html?: string;
  /** true = título em vermelho. */
  title_red?: boolean;
  subtitle_html?: string;
  product_image?: string;
  stat_bar_top?: string;
  stat_bar_bottom?: string;
  urgency_label?: string;
  urgency_title_html?: string;
  price_old?: string;
  price_new?: string;
  cta_text?: string;
  cta_href?: string;
  countdown_seconds?: number;
  stock_label?: string;
  stock?: number | string;
  guarantee_text?: string;
};

export type TimelineStepSpec = {
  badge?: string;
  title?: string;
  checks?: string[];
};

export type TimelineSpec = {
  before_after_image?: string;
  title?: string;
  intro?: string;
  steps?: TimelineStepSpec[];
  cta_text?: string;
  cta_href?: string;
};

export type ReviewSpec = {
  name?: string;
  date?: string;
  stars?: string;
  text?: string;
  photo?: string;
};

export type FooterSpec = {
  logo?: string;
  copyright?: string;
  disclaimer?: string;
};

export type MetaSpec = {
  lang?: string;
  page_title?: string;
};

/** Spec completa da listicle — mesma forma do spec.example.yaml. */
export type Spec = {
  slug?: string;
  meta?: MetaSpec;
  hero?: HeroSpec;
  list_items?: ListItemSpec[];
  offer_1?: OfferSpec;
  offer_2?: OfferSpec;
  timeline?: TimelineSpec;
  reviews?: ReviewSpec[];
  footer?: FooterSpec;
};

/** Input do endpoint /api/build. */
export type BuildInput = {
  template: string;
  spec: Spec;
};

export type BuildOutput = {
  html: string;
};
