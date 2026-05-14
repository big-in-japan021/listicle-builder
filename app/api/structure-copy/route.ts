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

const MODEL = "claude-sonnet-4-5";

async function loadBaseHtml(template: string): Promise<string> {
  const filePath = path.join(process.cwd(), "templates", template, "base.html");
  return fs.readFile(filePath, "utf-8");
}

export async function POST(request: Request) {
  try {
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
      return NextResponse.json(
        { error: "JSON inválido no body" },
        { status: 400 }
      );
    }

    const parsed = editorInputSchema.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Input inválido", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const input = parsed.data;

    // ── Chamada à Anthropic ─────────────────────────────────────────
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const start = Date.now();
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 4096,
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
    const elapsed = Date.now() - start;
    console.log(
      `[structure-copy] Claude respondeu em ${elapsed}ms, stop=${message.stop_reason}`
    );

    const toolUse = message.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
    );
    if (!toolUse) {
      const textBlock = message.content.find(
        (b): b is Anthropic.TextBlock => b.type === "text"
      );
      console.warn(
        "[structure-copy] resposta sem tool_use, stop_reason=",
        message.stop_reason
      );
      return NextResponse.json(
        {
          error:
            "A IA respondeu sem chamar a tool. Tenta de novo ou refaz a copy.",
          debug: { stop_reason: message.stop_reason, text: textBlock?.text },
        },
        { status: 502 }
      );
    }

    const aiOutput = toolUse.input as AiOutput;

    // Sanity check mínimo na shape devolvida.
    if (
      !aiOutput?.hero?.title_html ||
      !Array.isArray(aiOutput?.list_items) ||
      aiOutput.list_items.length === 0
    ) {
      return NextResponse.json(
        {
          error:
            "A IA devolveu uma estrutura incompleta. Tenta de novo (talvez com copy maior).",
          debug: { aiOutput },
        },
        { status: 502 }
      );
    }

    // ── Monta o spec e renderiza ────────────────────────────────────
    const spec = buildSpec(input, aiOutput);
    const baseHtml = await loadBaseHtml("listicle-classica");
    const html = buildListicle(baseHtml, spec);

    return NextResponse.json({ spec, html, ai: aiOutput });
  } catch (err) {
    const errorMessage =
      err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    console.error("[structure-copy] erro inesperado:", err);
    return NextResponse.json(
      { error: `Erro interno: ${errorMessage}` },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    endpoint: "/api/structure-copy",
    method: "POST",
    model: MODEL,
  });
}
