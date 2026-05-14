// Motor de build: recebe um Spec e o base.html, devolve o HTML final.
// Port direto do gerar.py (Python+BeautifulSoup) pra TypeScript+cheerio.

import * as cheerio from "cheerio";
import type {
  AuthorSpec,
  ListItemSpec,
  OfferSpec,
  ReviewSpec,
  Spec,
  TimelineStepSpec,
} from "./types";

type CheerioAPI = ReturnType<typeof cheerio.load>;
type CheerioEl = ReturnType<CheerioAPI>;

const BG_IMAGE_STYLE = (url: string, fallbackBg = "#ccc") =>
  `background: ${fallbackBg} url('${url}') center/cover no-repeat;`;

function stripExistingBgImage(style: string): string {
  return style
    .replace(/background(?:-image)?\s*:\s*[^;]*url\([^)]*\)[^;]*;?/g, "")
    .trim()
    .replace(/;$/, "");
}

function setBgImage($el: CheerioEl, url: string, fallbackBg = "#ccc") {
  if (!url) return;
  const existing = stripExistingBgImage($el.attr("style") ?? "");
  const next = (existing ? `${existing}; ` : "") + BG_IMAGE_STYLE(url, fallbackBg);
  $el.attr("style", next);
}

function setText($el: CheerioEl, value: string | undefined | null) {
  if (value === undefined || value === null) return;
  $el.text(value);
}

function setHtml($el: CheerioEl, html: string | undefined | null) {
  if (html === undefined || html === null) return;
  $el.html(html);
}

function applyHero($: CheerioAPI, hero: Spec["hero"]) {
  if (!hero) return;

  const $heroImage = $(".hero-image").first();
  if ($heroImage.length && hero.image) {
    $heroImage.attr("style", BG_IMAGE_STYLE(hero.image));
  }

  const $stars = $(".hero-stars .stars").first();
  if ($stars.length && hero.stars) setText($stars, hero.stars);

  // span (.hero-stars > span:not(.stars))
  const $social = $(".hero-stars > span")
    .filter((_, el) => !$(el).hasClass("stars"))
    .first();
  if ($social.length && hero.social_proof) setText($social, hero.social_proof);

  const $title = $(".hero-title").first();
  if ($title.length && hero.title_html) setHtml($title, hero.title_html);

  applyAuthor($, hero.author);

  const $summary = $(".hero-summary").first();
  if ($summary.length && hero.summary_html) setHtml($summary, hero.summary_html);
}

function applyAuthor($: CheerioAPI, author: AuthorSpec | undefined) {
  if (!author) return;

  const $photo = $(".hero-author-photo").first();
  if ($photo.length && author.photo) {
    $photo.attr("style", BG_IMAGE_STYLE(author.photo));
  }

  const $info = $(".hero-author-info").first();
  if ($info.length && (author.name || author.date)) {
    $info.empty();
    if (author.name) {
      $info.append(`<strong>By ${escapeHtml(author.name)}</strong>`);
    }
    if (author.date) {
      $info.append(`\n${escapeHtml(author.date)}`);
    }
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function applyListItems($: CheerioAPI, items: ListItemSpec[] | undefined) {
  if (!items || items.length === 0) return;

  const $existing = $(".list-item");
  if ($existing.length === 0) return;

  const templateHtml = $.html($existing.first());
  const dividerHtml = '<div class="section-divider"></div>';
  const $parent = $existing.first().parent();

  // Remove todos os list-items existentes + section-dividers adjacentes que
  // estão entre eles (mantém os que ficam antes de blocos diferentes).
  $existing.each((_, el) => {
    const $el = $(el);
    const $next = $el.next();
    $el.remove();
    if ($next.hasClass("section-divider")) $next.remove();
  });

  // Âncora: divider tipo `<div style="height: 32px ...">` antes da 1ª oferta.
  let $anchor: CheerioEl = $();
  for (const el of $parent.children("div").toArray()) {
    const $el = $(el);
    const style = $el.attr("style") ?? "";
    if (/height\s*:\s*32px/.test(style)) {
      $anchor = $el;
      break;
    }
  }
  if (!$anchor.length) {
    $anchor = $parent.find(".offer-block").first();
  }

  items.forEach((item, i) => {
    const $clone = $(templateHtml).first();

    // Número + título
    const $titleEl = $clone.find(".list-item-title").first();
    if ($titleEl.length) {
      const number = item.number ?? String(i + 1);
      const titleInner = item.title_html ?? "";
      $titleEl.html(`${escapeHtml(number)}. ${titleInner}`);
    }

    // Imagem (background do .img-placeholder)
    const $img = $clone.find(".img-placeholder").first();
    if ($img.length && item.image) {
      $img.attr("style", BG_IMAGE_STYLE(item.image, "#ddd"));
    }

    // Texto
    const $text = $clone.find(".list-item-text").first();
    if ($text.length && item.text_html) setHtml($text, item.text_html);

    // Emoji list (opcional)
    if (item.emoji_list && item.emoji_list.length > 0) {
      $clone.find(".emoji-list").remove();
      const bullets = item.emoji_list
        .map((b) => `<li>${escapeHtml(b)}</li>`)
        .join("");
      const ulHtml = `<ul class="emoji-list">${bullets}</ul>`;
      if ($text.length) $text.after(ulHtml);
      else $clone.append(ulHtml);
    }

    if ($anchor.length) {
      $anchor.before($.html($clone));
      if (i < items.length - 1) $anchor.before(dividerHtml);
    } else {
      $parent.append($.html($clone));
      if (i < items.length - 1) $parent.append(dividerHtml);
    }
  });
}

function applyOffers($: CheerioAPI, spec: Spec) {
  const offers: Array<[string, OfferSpec | undefined]> = [
    ["offer_1", spec.offer_1],
    ["offer_2", spec.offer_2],
  ];

  const $blocks = $(".offer-block");
  offers.forEach(([, offer], idx) => {
    if (!offer) return;
    const block = $blocks.eq(idx);
    if (!block.length) return;
    applyOffer($, block, offer);
  });
}

function applyOffer($: CheerioAPI, $block: CheerioEl, offer: OfferSpec) {
  // Título
  const $title = $block.find(".offer-title").first();
  if ($title.length && offer.title_html) {
    const classes = ["offer-title"];
    if (offer.title_red) classes.push("red-title");
    $title.attr("class", classes.join(" "));
    setHtml($title, offer.title_html);
  }

  // Subtítulo: cria/atualiza/remove conforme presença
  let $subtitle = $block.find(".offer-subtitle").first();
  if (offer.subtitle_html) {
    if (!$subtitle.length) {
      if ($title.length) {
        $title.after('<p class="offer-subtitle"></p>');
        $subtitle = $block.find(".offer-subtitle").first();
      }
    }
    if ($subtitle.length) setHtml($subtitle, offer.subtitle_html);
  } else if ($subtitle.length) {
    $subtitle.remove();
  }

  // Stat bars (topo e fundo)
  const $statBars = $block.find(".product-image-wrap > .product-stat-bar");
  if ($statBars.length >= 1 && offer.stat_bar_top) {
    setText($statBars.eq(0), offer.stat_bar_top);
  }
  if ($statBars.length >= 2 && offer.stat_bar_bottom) {
    setText($statBars.eq(1), offer.stat_bar_bottom);
  }

  // Foto do produto
  const $product = $block.find(".product-img").first();
  if ($product.length && offer.product_image) {
    $product.attr("style", BG_IMAGE_STYLE(offer.product_image, "#888"));
  }

  // Urgência
  const $uLabel = $block.find(".urgency-label").first();
  if ($uLabel.length && offer.urgency_label) setText($uLabel, offer.urgency_label);
  const $uTitle = $block.find(".urgency-title").first();
  if ($uTitle.length && offer.urgency_title_html) setHtml($uTitle, offer.urgency_title_html);

  // Preços
  const $priceOld = $block.find(".price-old").first();
  if ($priceOld.length && offer.price_old) setText($priceOld, offer.price_old);
  const $priceNew = $block.find(".price-new").first();
  if ($priceNew.length && offer.price_new) setText($priceNew, offer.price_new);

  // CTA
  const $cta = $block.find(".cta-btn").first();
  if ($cta.length) {
    if (offer.cta_href) $cta.attr("href", offer.cta_href);
    if (offer.cta_text) setText($cta, offer.cta_text);
  }

  // Stock row — pode reconstruir o conteúdo todo (label + span com número)
  const $stockRow = $block.find(".stock-row").first();
  if ($stockRow.length) {
    if (offer.stock_label) {
      $stockRow.empty();
      $stockRow.append(`${escapeHtml(offer.stock_label)} `);
      $stockRow.append(
        `<span class="stock-number">${escapeHtml(String(offer.stock ?? "0"))}</span>`
      );
    } else if (offer.stock !== undefined) {
      const $num = $stockRow.find(".stock-number").first();
      if ($num.length) setText($num, String(offer.stock));
    }
  }

  // Garantia
  const $guarantee = $block.find(".guarantee-text").first();
  if ($guarantee.length && offer.guarantee_text) setText($guarantee, offer.guarantee_text);
}

function applyCountdowns($: CheerioAPI, spec: Spec) {
  const t1 = spec.offer_1?.countdown_seconds;
  const t2 = spec.offer_2?.countdown_seconds;
  if (t1 === undefined && t2 === undefined) return;

  $("script").each((_, el) => {
    const $script = $(el);
    let body = $script.html() ?? "";
    if (!body.includes("startCountdown")) return;
    if (t1 !== undefined) {
      body = body.replace(
        /startCountdown\(\s*'timer1'\s*,\s*\d+\s*\)/g,
        `startCountdown('timer1', ${Math.trunc(t1)})`
      );
    }
    if (t2 !== undefined) {
      body = body.replace(
        /startCountdown\(\s*'timer2'\s*,\s*\d+\s*\)/g,
        `startCountdown('timer2', ${Math.trunc(t2)})`
      );
    }
    $script.html(body);
    return false; // só o primeiro <script> que tem startCountdown
  });
}

function applyTimeline($: CheerioAPI, spec: Spec) {
  const tl = spec.timeline;
  if (!tl) return;

  const $section = $(".timeline-section").first();
  if (!$section.length) return;

  // Before/after image
  const $ba = $section.find(".timeline-before-after").first();
  if ($ba.length && tl.before_after_image) {
    $ba.attr("style", BG_IMAGE_STYLE(tl.before_after_image));
  }

  const $title = $section.find(".timeline-title").first();
  if ($title.length && tl.title) setText($title, tl.title);
  const $intro = $section.find(".timeline-intro").first();
  if ($intro.length && tl.intro) setText($intro, tl.intro);

  applyTimelineSteps($, $section, tl.steps);

  const $cta = $section.find(".timeline-cta").first();
  if ($cta.length) {
    if (tl.cta_href) $cta.attr("href", tl.cta_href);
    if (tl.cta_text) setText($cta, tl.cta_text);
  }
}

function applyTimelineSteps(
  $: CheerioAPI,
  $section: CheerioEl,
  steps: TimelineStepSpec[] | undefined
) {
  if (!steps || steps.length === 0) return;
  const $existing = $section.find(".timeline-step");
  if ($existing.length === 0) return;
  const templateHtml = $.html($existing.first());

  // Remove todos os steps + dividers entre eles
  $existing.each((_, el) => {
    const $el = $(el);
    const $next = $el.next();
    $el.remove();
    if ($next.hasClass("timeline-divider")) $next.remove();
  });

  const $anchor = $section.find(".timeline-cta").first();
  const dividerHtml = '<div class="timeline-divider"></div>';

  steps.forEach((step, i) => {
    const $clone = $(templateHtml).first();
    const $badge = $clone.find(".timeline-badge").first();
    const $stepTitle = $clone.find(".timeline-step-title").first();
    const $checks = $clone.find(".timeline-checks").first();

    if ($badge.length && step.badge) setText($badge, step.badge);
    if ($stepTitle.length && step.title) setText($stepTitle, step.title);
    if ($checks.length && step.checks) {
      $checks.empty();
      for (const check of step.checks) {
        $checks.append(`<li>${escapeHtml(check)}</li>`);
      }
    }

    if ($anchor.length) {
      $anchor.before($.html($clone));
      if (i < steps.length - 1) $anchor.before(dividerHtml);
    } else {
      $section.append($.html($clone));
      if (i < steps.length - 1) $section.append(dividerHtml);
    }
  });
}

function applyReviews($: CheerioAPI, reviews: ReviewSpec[] | undefined) {
  if (!reviews || reviews.length === 0) return;
  const $section = $(".reviews-section").first();
  if (!$section.length) return;
  const $cards = $section.find(".review-card");
  if ($cards.length === 0) return;

  const templateHtml = $.html($cards.first());
  $cards.remove();

  reviews.forEach((rev, i) => {
    const $clone = $(templateHtml).first();
    const $name = $clone.find(".review-name").first();
    const $date = $clone.find(".review-date").first();
    const $stars = $clone.find(".review-stars").first();
    const $text = $clone.find(".review-text").first();
    const $photo = $clone.find(".review-photo").first();

    if ($name.length && rev.name) setText($name, rev.name);
    if ($date.length && rev.date) setText($date, rev.date);
    if ($stars.length && rev.stars) setText($stars, rev.stars);
    if ($text.length && rev.text) setHtml($text, rev.text);
    if ($photo.length && rev.photo) {
      $photo.attr("style", BG_IMAGE_STYLE(rev.photo));
    }

    $section.append($.html($clone));
    void i;
  });
}

function applyFooter($: CheerioAPI, spec: Spec) {
  const ft = spec.footer;
  if (!ft) return;

  const $logo = $(".footer-logo").first();
  if ($logo.length) {
    if (ft.logo) {
      $logo.attr(
        "style",
        `background: transparent url('${ft.logo}') center/contain no-repeat; width: 120px; height: 50px;`
      );
    } else {
      $logo.remove();
    }
  }
  const $cp = $(".footer-copyright").first();
  if ($cp.length && ft.copyright) setText($cp, ft.copyright);
  const $disc = $(".footer-disclaimer").first();
  if ($disc.length && ft.disclaimer) setText($disc, ft.disclaimer);
}

/**
 * Constrói o HTML final da listicle a partir do template HTML base e de um spec.
 *
 * - Não chama nenhuma API externa.
 * - Imagens vêm de URLs/data-URIs já presentes no spec.
 *   (A geração de imagens via OpenAI fica no `/api/generate-image` e o front
 *   injeta as URLs no spec antes de chamar este builder.)
 */
export function buildListicle(baseHtml: string, spec: Spec): string {
  const $ = cheerio.load(baseHtml);

  // META
  const meta = spec.meta;
  if (meta?.lang) $("html").attr("lang", meta.lang);
  if (meta?.page_title) $("title").first().text(meta.page_title);

  applyHero($, spec.hero);
  applyListItems($, spec.list_items);
  applyOffers($, spec);
  applyCountdowns($, spec);
  applyTimeline($, spec);
  applyReviews($, spec.reviews);
  applyFooter($, spec);

  return $.html();
}
