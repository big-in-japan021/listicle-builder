// Configuração do tool use do Claude pra estruturar a copy bruta no spec deste template.

/** Tipo do JSON que o Claude devolve via tool call `fill_listicle_spec`. */
export type AiOutput = {
  page_title: string;
  /** Descrição curta do público-alvo (usada nos prompts de imagem). Ex: "mulher 35-55 anos, brasileira, cabelo médio". */
  target_customer: string;
  /** Categoria do produto, em poucas palavras. Ex: "suplemento natural para perda de peso". */
  product_category: string;
  hero: {
    title_html: string;
    social_proof: string;
    summary_html: string;
    author_name: string;
  };
  list_items: Array<{
    number: string;
    title_html: string;
    text_html: string;
    emoji_list?: string[];
    image_prompt: string;
  }>;
  timeline: {
    title: string;
    intro: string;
    steps: Array<{
      badge: string;
      title: string;
      checks: string[];
    }>;
  };
  footer: {
    copyright: string;
    disclaimer: string;
  };
};

/** JSON Schema do `input_schema` da tool — Claude precisa seguir essa forma. */
export const fillListicleSpecTool = {
  name: "fill_listicle_spec",
  description:
    "Preenche a estrutura de uma listicle de performance a partir da copy bruta fornecida pelo usuário. Distribui o conteúdo em hero, itens numerados, timeline de 3 etapas e footer.",
  input_schema: {
    type: "object" as const,
    properties: {
      page_title: {
        type: "string",
        description:
          "Título da aba do navegador. Pode ser igual ao headline ou uma versão mais curta dele.",
      },
      target_customer: {
        type: "string",
        description:
          'Descrição curta (5-15 palavras) do público-alvo da copy, EM INGLÊS (sempre). Detalhes: gênero, faixa etária, aparência típica, contexto cultural se relevante. Ex: "Brazilian woman, 35-55 years old, natural skin tone, mid-length hair". Usado pra gerar imagens contextualmente coerentes.',
      },
      product_category: {
        type: "string",
        description:
          'Categoria do produto, EM INGLÊS, em 3-7 palavras. Ex: "natural weight loss supplement for women 30+", "anti-aging skincare for mature skin". Usado pra gerar imagens contextualmente coerentes.',
      },
      hero: {
        type: "object",
        properties: {
          title_html: {
            type: "string",
            description:
              'Headline principal (H1). Use <span class="highlight">...</span> nas 1-3 palavras-chave de impacto. Sem outros tags (<p>, <h1>, etc).',
          },
          social_proof: {
            type: "string",
            description:
              'Frase curta de prova social, ex: "+200.000 clientes satisfeitos". Se a copy não der números, sugira algo plausível e modesto. Sem HTML.',
          },
          summary_html: {
            type: "string",
            description:
              'Resumo curto (1-2 parágrafos <p>) que abre a página. Começa com <span class="label">Resumo</span>: (ou "Summary" / "Resumen" conforme idioma). Use <strong>...</strong> pra destaque. PRESERVA quebras simples do texto original como <br> dentro do mesmo <p> (não consolida frases que o user separou em linhas).',
          },
          author_name: {
            type: "string",
            description:
              'Nome plausível de jornalista/especialista no idioma da copy. Não usar o nome do produto. Ex: "Ana Beatriz Lima" (PT), "Sarah Mitchell" (EN), "Lucía Ramírez" (ES).',
          },
        },
        required: ["title_html", "social_proof", "summary_html", "author_name"],
      },
      list_items: {
        type: "array",
        minItems: 6,
        maxItems: 10,
        description:
          "Lista de motivos/benefícios numerados. Crie entre 6 e 10. Cada item distribui pedaços da copy bruta.",
        items: {
          type: "object",
          properties: {
            number: {
              type: "string",
              description: 'Número do item, começando em "1".',
            },
            title_html: {
              type: "string",
              description:
                'Título do item — 1 frase curta com 1 <span class="highlight">...</span> na palavra-chave. Sem <p>.',
            },
            text_html: {
              type: "string",
              description:
                "Texto descritivo do item em HTML. **PRESERVE A ESTRUTURA DE QUEBRAS DO TEXTO ORIGINAL:** linha em branco → <p>s separados; Enter simples sem linha em branco → <br> dentro do mesmo <p>. NÃO consolide múltiplas frases curtas num único parágrafo se elas estavam em linhas separadas. Use <strong> e <span class=\"highlight\"> com moderação.",
            },
            emoji_list: {
              type: "array",
              items: { type: "string" },
              description:
                'Opcional. Use somente quando o item naturalmente pede uma lista de bullets (ex: "depois de 7 dias os usuários relatam: X, Y, Z"). 3 a 5 strings, cada uma começando com emoji.',
            },
            image_prompt: {
              type: "string",
              description:
                "Prompt EM INGLÊS (sempre) descrevendo a imagem ideal pra ilustrar ESSE item específico. Adapte ao conteúdo do item — se for sobre benefício físico use lifestyle/pessoa; se for sobre garantia use trust badge / seal; se for sobre ingredientes naturais use close-up de ingredientes; se for sobre prova social use grupo de pessoas felizes; etc. 20-40 palavras, descritivo e visual. NÃO inclua estilo (lighting, photorealistic, etc) — isso é injetado depois. Foque no SUJEITO e CENA.",
            },
          },
          required: ["number", "title_html", "text_html", "image_prompt"],
        },
      },
      timeline: {
        type: "object",
        properties: {
          title: {
            type: "string",
            description:
              'Título da seção, ex: "SUA JORNADA DE TRANSFORMAÇÃO" (PT), "YOUR TRANSFORMATION JOURNEY" (EN).',
          },
          intro: {
            type: "string",
            description:
              "1 frase introdutória da timeline. Sem HTML.",
          },
          steps: {
            type: "array",
            minItems: 3,
            maxItems: 3,
            description: "Exatamente 3 etapas, distribuídas no tempo (ex: Dias 1-3, Dia 10, 30 Dias+).",
            items: {
              type: "object",
              properties: {
                badge: {
                  type: "string",
                  description:
                    'Marcador de tempo. Ex: "Dias 1–3" (PT), "Days 1–3" (EN), "Días 1–3" (ES).',
                },
                title: {
                  type: "string",
                  description:
                    'Título curto da etapa (2-3 palavras). Ex: "Equilíbrio Imediato".',
                },
                checks: {
                  type: "array",
                  items: { type: "string" },
                  minItems: 2,
                  maxItems: 4,
                  description: "2 a 4 frases curtas sobre o que acontece nessa etapa. Sem HTML.",
                },
              },
              required: ["badge", "title", "checks"],
            },
          },
        },
        required: ["title", "intro", "steps"],
      },
      footer: {
        type: "object",
        properties: {
          copyright: {
            type: "string",
            description: 'Ex: "© 2026 {NOME_DO_PRODUTO}. Todos os direitos reservados."',
          },
          disclaimer: {
            type: "string",
            description:
              "Disclaimer legal apropriado pra categoria do produto. Use texto genérico (sem links). Suplemento → fale sobre não-avaliação pela Anvisa/FDA. Infoproduto → resultados não-garantidos. Cosmético → patch test recomendado.",
          },
        },
        required: ["copyright", "disclaimer"],
      },
    },
    required: [
      "page_title",
      "target_customer",
      "product_category",
      "hero",
      "list_items",
      "timeline",
      "footer",
    ],
  },
};

/** System prompt do Claude. */
export const systemPrompt = `Você é um especialista em copy de listicle de performance estilo direct response ("10 Reasons Why..."), no padrão usado pra vender suplementos, cosméticos e infoprodutos.

Você recebe:
- Uma COPY BRUTA (rascunho do copywriter, pode estar desorganizada)
- O NOME do produto
- O IDIOMA esperado da página (pt-BR, en, ou es)

Sua função é destrinchar a copy nos slots de um template de listicle e devolver tudo via tool call \`fill_listicle_spec\`.

REGRAS RÍGIDAS:

1. **Idioma:** sempre use o IDIOMA da copy bruta (e do parâmetro lang) em todas as saídas. Não traduza.

2. **Sem invenção de fatos:** se a copy não traz uma informação, não invente. Pode parafrasear o que está lá. Para prova social, autor e disclaimer (que não vêm na copy bruta) você pode sugerir algo plausível e genérico.

3. **HTML correto — CRÍTICO:** os campos *_html devem ser HTML válido. Use:
   - <p>...</p> em CADA bloco do texto. Considera-se bloco TUDO QUE ESTIVER SEPARADO POR LINHA EM BRANCO no texto original. NÃO junte vários blocos num único <p>.
   - <br> **DENTRO** de um <p> pra cada quebra de linha simples (Enter sem deixar linha em branco) que o usuário fez. É CRÍTICO preservar a cadência visual do texto original — se o usuário escreveu 3 frases curtas em linhas separadas (sem linha em branco entre elas), ELAS DEVEM VIRAR \`<p>Frase 1.<br>Frase 2.<br>Frase 3.</p>\`. **NUNCA** transforme isso em \`<p>Frase 1. Frase 2. Frase 3.</p>\` — você perde o ritmo.
   - <strong>...</strong> pra negrito de ênfase
   - <span class="highlight">palavra</span> pra palavra-chave em destaque visual (laranja-lima). Use SOMENTE em 1 a 3 palavras-chave por bloco. Nada de <span class="highlight"> em frase inteira.
   - <span class="label">Resumo</span> (ou "Summary"/"Resumen") só no INÍCIO do summary_html.
   - Não use <h1>, <h2>, <div>, <ul>, ou classes/atributos diferentes dos listados acima.
   - **REGRA DE QUEBRA:** linha em branco no original → \`</p><p>\`. Enter sem linha em branco → \`<br>\`. Texto contínuo sem quebra → não adicione nada.

4. **list_items:** ENTRE 6 e 10 itens. Cada item distribui um pedaço/argumento da copy bruta. Mantém o tom (urgência, intimidade, dados numéricos) do original. Se a copy tem 4 argumentos, complemente com 2-3 derivados (sem inventar fatos novos — derive variações de ângulo dos argumentos existentes).

5. **emoji_list:** SOMENTE quando o item naturalmente pede uma lista (ex: "depois de 7 dias os usuários relatam: X, Y, Z" → vira ul de bullets). Use em no máximo 1-2 itens da listicle.

6. **timeline.steps:** SEMPRE 3 etapas. Distribui a transformação no tempo. Se a copy não fala em dias específicos, use padrão "Dias 1–3 / Dia 10 / 30 Dias+". Checks curtos (não copia texto inteiro).

7. **author_name:** nome plausível de jornalista/redatora no idioma da copy. NÃO usar o nome do produto.

8. **footer.disclaimer:** texto legal genérico apropriado pra categoria. Se for um suplemento/health, mencione não-avaliação pela autoridade local (Anvisa pra PT, FDA pra EN). Sem links.

9. **target_customer e product_category:** sempre EM INGLÊS, mesmo se a copy for em PT/ES. Esses campos não aparecem na página renderizada — eles servem só pra alimentar prompts de imagem de outra IA (gpt-image-2) que produz melhor em inglês. Descreva o público-alvo de forma específica e visual (ex: "Brazilian woman, 35-55, natural skin tone, candid expression").

10. **list_items[].image_prompt:** sempre EM INGLÊS. Descreva o SUJEITO e a CENA da imagem ideal pra ilustrar AQUELE item específico. Não force "person matching the demographic" em todo item — varia com o conteúdo:
    - Item sobre benefício físico/transformação → use lifestyle photo da customer demographic
    - Item sobre garantia/refund → "premium gold seal / trust badge / certificate of authenticity"
    - Item sobre ingredientes/natural → "close-up of botanical ingredients on wooden surface"
    - Item sobre prova social/reviews → "diverse group of happy customers / 5-star rating cards"
    - Item sobre energia/sono → cena lifestyle correspondente (alarm clock, morning routine, etc.)
    - Item sobre antes/depois → side-by-side composition
    Foque em SUJEITO e CENA. NÃO inclua "photorealistic", "natural lighting" — esses estilos são injetados pelo sistema antes de mandar pra IA de imagem. 20-40 palavras por prompt.

DEVOLVA SEMPRE via tool call \`fill_listicle_spec\`. Não responda em texto direto.`;
