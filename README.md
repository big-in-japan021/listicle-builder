# Listicle Builder

App web (Next.js + TypeScript) que gera **listicle pages** estilo direct response
("10 Reasons Why...") a partir de copy bruta + imagens fixas, com:

- **Anthropic Claude** estruturando a copy bruta em slots do template.
- **OpenAI gpt-image-1** gerando as imagens contextuais.
- **JSZip** empacotando `index.html + img/` no navegador pra você baixar e
  hospedar onde quiser.

## Status

MVP em construção. Sprint 1 (esqueleto + deploy) concluído.

## Stack

- Next.js 16 (App Router) + TypeScript strict
- Tailwind CSS v4 + shadcn/ui
- (próximos sprints) cheerio, @anthropic-ai/sdk, openai, react-hook-form, zod, jszip
- Deploy: Vercel via GitHub
- Persistência: nenhuma (estado vive no cliente, sem backend pesado)

## Rodar local

```bash
npm install
cp .env.example .env.local   # e preencha as chaves
npm run dev
```

Abra http://localhost:3000.

## Variáveis de ambiente

Veja `.env.example`. Em produção elas vão na aba "Environment Variables" do
projeto na Vercel.

| Variável             | Para que serve                                |
| -------------------- | --------------------------------------------- |
| `OPENAI_API_KEY`     | Gerar imagens (gpt-image-1, qualidade `high`) |
| `ANTHROPIC_API_KEY`  | Estruturar copy bruta em spec (Claude)        |

## Estrutura

```
app/                 rotas e API routes
components/ui/       primitivos shadcn
lib/                 (próximos sprints) builder, clients de IA, zip
templates/
  listicle-classica/
    base.html        # HTML base do template (não regerar do zero)
    schema.json      # (sprint 2) mapeia slots → seletores
    ai-prompts.ts    # (sprint 5) prompts por slot de imagem IA
```

Adicionar template novo no futuro = criar pasta nova com 3 arquivos. Zero
mudança no código do app.
