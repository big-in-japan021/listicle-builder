// Junta EditorInput (o que o usuário preenche) + AiOutput (o que o Claude
// estrutura) + defaults hardcoded → Spec completa pro builder.

import type { EditorInput } from "@/lib/editor-input";
import type { Spec } from "@/lib/types";
import type { AiOutput } from "./ai-prompts";

type Lang = "pt-BR" | "en" | "es";

const fallbackLang = (input: string): Lang => {
  if (input.startsWith("pt")) return "pt-BR";
  if (input.startsWith("es")) return "es";
  return "en";
};

// ════════════════════════════════════════════════════════════════════
//  STRINGS LOCALIZADAS PRA DEFAULTS
// ════════════════════════════════════════════════════════════════════
const STRINGS = {
  "pt-BR": {
    today_prefix: "Atualizado em",
    months: ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"],
    offer_1_title: 'OFERTA RELÂMPAGO <span class="highlight">SÓ HOJE</span>',
    offer_2_title: 'ÚLTIMA CHANCE<br>OFERTA RELÂMPAGO',
    offer_subtitle: (name: string) =>
      `GARANTA ${name.toUpperCase()} COM <span class="highlight">50% OFF AGORA</span>`,
    stat_bar_top_1: "96% perceberam diferença em 24h",
    stat_bar_bottom: "🚚 Frete grátis para todo o Brasil",
    stat_bar_top_2: (name: string) => `92,3% usam ${name} diariamente`,
    urgency_label: "OFERTA RELÂMPAGO POR TEMPO LIMITADO",
    urgency_title: 'ECONOMIZE <span class="highlight">50%</span> AGORA!',
    cta_text: "QUERO GARANTIR AGORA →",
    stock_label: "UNIDADES RESTANTES:",
    guarantee:
      "Garantia incondicional de 30 dias — se em 30 dias você não sentir diferença, devolvemos 100% do seu dinheiro.",
  },
  en: {
    today_prefix: "Last Updated",
    months: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
    offer_1_title: 'FLASH SALE <span class="highlight">TODAY ONLY</span>',
    offer_2_title: 'LAST CHANCE<br>FLASH SALE',
    offer_subtitle: (name: string) =>
      `GET ${name.toUpperCase()} AT <span class="highlight">50% OFF NOW</span>`,
    stat_bar_top_1: "96% noticed a difference within 24h",
    stat_bar_bottom: "🚚 Free shipping on all orders",
    stat_bar_top_2: (name: string) => `92.3% use ${name} daily`,
    urgency_label: "LIMITED-TIME FLASH PROMO",
    urgency_title: 'SAVE <span class="highlight">50%</span> NOW!',
    cta_text: "GET 50% OFF →",
    stock_label: "UNITS REMAINING:",
    guarantee:
      "30-day money-back guarantee — if you don't see results in 30 days we refund 100% of your purchase.",
  },
  es: {
    today_prefix: "Última actualización",
    months: ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"],
    offer_1_title: 'OFERTA RELÁMPAGO <span class="highlight">SOLO HOY</span>',
    offer_2_title: 'ÚLTIMA OPORTUNIDAD<br>OFERTA RELÁMPAGO',
    offer_subtitle: (name: string) =>
      `OBTÉN ${name.toUpperCase()} CON <span class="highlight">50% DE DESCUENTO AHORA</span>`,
    stat_bar_top_1: "96% notaron diferencia en 24h",
    stat_bar_bottom: "🚚 Envío gratis a todo el país",
    stat_bar_top_2: (name: string) => `92,3% usan ${name} diariamente`,
    urgency_label: "PROMOCIÓN RELÁMPAGO POR TIEMPO LIMITADO",
    urgency_title: 'AHORRA <span class="highlight">50%</span> AHORA!',
    cta_text: "OBTENER 50% DE DESCUENTO →",
    stock_label: "UNIDADES RESTANTES:",
    guarantee:
      "Garantía incondicional de 30 días — si en 30 días no sientes la diferencia, devolvemos el 100% de tu dinero.",
  },
} as const;

// ════════════════════════════════════════════════════════════════════
//  HELPERS DE DATA
// ════════════════════════════════════════════════════════════════════
function todayString(lang: Lang): string {
  const s = STRINGS[lang];
  const d = new Date();
  return `${s.today_prefix} ${d.getDate()} ${s.months[d.getMonth()]}, ${d.getFullYear()}`;
}

function reviewDate(i: number, lang: Lang): string {
  const d = new Date();
  d.setDate(d.getDate() - (4 + i * 6));
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  if (lang === "en") return `${mm}/${dd}/${yyyy}`;
  return `${dd}/${mm}/${yyyy}`;
}

// ════════════════════════════════════════════════════════════════════
//  MERGER
// ════════════════════════════════════════════════════════════════════
export function buildSpec(input: EditorInput, ai: AiOutput): Spec {
  const lang: Lang = fallbackLang(input.lang || "pt-BR");
  const s = STRINGS[lang];
  const productName = input.product.name;
  const productImage = input.product.product_image_b64 ?? "";

  return {
    slug: input.slug,
    meta: {
      lang,
      page_title: ai.page_title,
    },
    hero: {
      image: "", // sprint 5 gera via IA
      stars: "★★★★★",
      social_proof: ai.hero.social_proof,
      title_html: ai.hero.title_html,
      author: {
        photo: "", // sprint 5 gera
        name: ai.hero.author_name,
        date: todayString(lang),
      },
      summary_html: ai.hero.summary_html,
    },
    list_items: ai.list_items.map((it, i) => ({
      number: it.number || String(i + 1),
      title_html: it.title_html,
      image: "", // sprint 5 gera
      text_html: it.text_html,
      emoji_list: it.emoji_list,
    })),
    offer_1: {
      title_html: s.offer_1_title,
      title_red: false,
      subtitle_html: s.offer_subtitle(productName),
      product_image: productImage,
      stat_bar_top: s.stat_bar_top_1,
      stat_bar_bottom: s.stat_bar_bottom,
      urgency_label: s.urgency_label,
      urgency_title_html: s.urgency_title,
      price_old: input.product.price_old,
      price_new: input.product.price_new,
      cta_text: s.cta_text,
      cta_href: input.product.cta_href,
      countdown_seconds: 900,
      stock_label: s.stock_label,
      stock: 32,
      guarantee_text: s.guarantee,
    },
    timeline: {
      before_after_image: input.before_after_image_b64 ?? "",
      title: ai.timeline.title,
      intro: ai.timeline.intro,
      steps: ai.timeline.steps,
      cta_text: s.cta_text,
      cta_href: input.product.cta_href,
    },
    reviews: input.reviews.map((r, i) => ({
      name: r.name,
      date: reviewDate(i, lang),
      stars: "★★★★★",
      text: r.text,
      photo: "", // sprint 5 gera
    })),
    offer_2: {
      title_html: s.offer_2_title,
      title_red: true,
      subtitle_html: "",
      product_image: productImage,
      stat_bar_top: s.stat_bar_top_2(productName),
      stat_bar_bottom: s.stat_bar_bottom,
      urgency_label: s.urgency_label,
      urgency_title_html: s.urgency_title,
      price_old: input.product.price_old,
      price_new: input.product.price_new,
      cta_text: s.cta_text,
      cta_href: input.product.cta_href,
      countdown_seconds: 326,
      stock_label: s.stock_label,
      stock: 22,
      guarantee_text: s.guarantee,
    },
    footer: {
      logo: input.footer_logo_b64 ?? "",
      copyright: ai.footer.copyright,
      disclaimer: ai.footer.disclaimer,
    },
  };
}
