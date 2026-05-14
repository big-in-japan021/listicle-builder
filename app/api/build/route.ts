import { promises as fs } from "node:fs";
import path from "node:path";

import { NextResponse } from "next/server";
import { z } from "zod";

import { buildListicle } from "@/lib/builder";

export const runtime = "nodejs";

// Schema permissivo: aceita qualquer estrutura no spec, valida só o esqueleto.
// Validação fina dos campos individuais é responsabilidade do form (Sprint 3).
const buildInputSchema = z.object({
  template: z.string().min(1).regex(/^[a-z0-9-]+$/, {
    message: "template inválido (use só letras minúsculas, números e -)",
  }),
  spec: z.record(z.string(), z.unknown()),
});

const ALLOWED_TEMPLATES = new Set(["listicle-classica"]);

async function loadBaseHtml(template: string): Promise<string> {
  const filePath = path.join(
    process.cwd(),
    "templates",
    template,
    "base.html"
  );
  return fs.readFile(filePath, "utf-8");
}

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido no body" }, { status: 400 });
  }

  const parsed = buildInputSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Input inválido", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { template, spec } = parsed.data;
  if (!ALLOWED_TEMPLATES.has(template)) {
    return NextResponse.json(
      { error: `Template não reconhecido: ${template}` },
      { status: 400 }
    );
  }

  let baseHtml: string;
  try {
    baseHtml = await loadBaseHtml(template);
  } catch {
    return NextResponse.json(
      { error: `Não consegui carregar o base.html do template "${template}".` },
      { status: 500 }
    );
  }

  try {
    const html = buildListicle(baseHtml, spec);
    return NextResponse.json({ html });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.json(
      { error: "Falha ao construir HTML", detail: message },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      endpoint: "/api/build",
      method: "POST",
      body: { template: "listicle-classica", spec: "<Spec>" },
      templates: Array.from(ALLOWED_TEMPLATES),
    },
    { status: 200 }
  );
}
