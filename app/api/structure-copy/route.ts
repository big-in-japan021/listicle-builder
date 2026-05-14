import { promises as fs } from "node:fs";
import path from "node:path";

import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

import { buildListicle } from "@/lib/builder";
import { editorInputSchema } from "@/lib/editor-input";
import {
  fillListicleSpecTool,
  systemPrompt,
  type AiOutput,
} from "@/templates/listicle-classica/ai-prompts";
import { buildSpec } from "@/templates/listicle-classica/build-spec";

export const runtime = "nodejs";
export const maxDuration = 60;

const MODEL = "claude-sonnet-4-6";

async function loadBaseHtml(template: string): Promise<string> {
  const filePath = path.join(process.cwd(), "templates", template, "base.html");
  return fs.readFile(filePath, "utf-8");
}

export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      {
        error:
          "Chave ANTHROPIC_API_KEY não configurada. Configure nas env vars da Vercel.",
      },
      { status: 500 }
    );
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido no body" }, { status: 400 });
  }

  const parsed = editorInputSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Input inválido", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const input = parsed.data;

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  let aiOutput: AiOutput;
  try {
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 8000,
      system: systemPrompt,
      tools: [fillListicleSpecTool],
      tool_choice: { type: "tool", name: fillListicleSpecTool.name },
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: [
                `PRODUTO: ${input.product.name}`,
                `IDIOMA esperado: ${input.lang}`,
                "",
                "COPY BRUTA:",
                "```",
                input.copy_raw,
                "```",
                "",
                "Estruture essa copy no template e devolva via tool call.",
              ].join("\n"),
            },
          ],
        },
      ],
    });

    const toolUse = message.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
    );
    if (!toolUse) {
      return NextResponse.json(
        {
          error: "A IA não devolveu via tool call (resposta inesperada). Tenta de novo.",
        },
        { status: 502 }
      );
    }
    aiOutput = toolUse.input as AiOutput;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro desconhecido na API da Anthropic";
    return NextResponse.json(
      { error: `Falha ao chamar a IA: ${msg}` },
      { status: 502 }
    );
  }

  const spec = buildSpec(input, aiOutput);

  let html: string;
  try {
    const baseHtml = await loadBaseHtml("listicle-classica");
    html = buildListicle(baseHtml, spec);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.json(
      { error: `IA OK mas falhei na renderização: ${msg}` },
      { status: 500 }
    );
  }

  return NextResponse.json({ spec, html, ai: aiOutput });
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    endpoint: "/api/structure-copy",
    method: "POST",
    model: MODEL,
  });
}
