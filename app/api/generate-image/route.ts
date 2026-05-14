import OpenAI from "openai";
import { NextResponse } from "next/server";
import { z } from "zod";

import {
  promptForSlot,
  type ImageContext,
  type ImageSize,
} from "@/templates/listicle-classica/image-prompts";

export const runtime = "nodejs";
export const maxDuration = 60;

const MODEL = "gpt-image-2";

const slotInputSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("hero") }),
  z.object({ kind: z.literal("author"), name: z.string() }),
  z.object({
    kind: z.literal("list_item"),
    index: z.number(),
    title_html: z.string(),
  }),
  z.object({ kind: z.literal("review"), index: z.number(), name: z.string() }),
  z.object({ kind: z.literal("before_after") }),
]);

const requestSchema = z.object({
  slot: slotInputSchema,
  context: z.object({
    product_category: z.string().min(1),
    customer_description: z.string().min(1),
  }),
  quality: z.enum(["low", "medium", "high"]).default("low"),
});

export async function POST(request: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY não configurada." },
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

    const parsed = requestSchema.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Input inválido", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const { slot, context, quality } = parsed.data;

    const ctx: ImageContext = context;
    const { prompt, size } = promptForSlot(slot, ctx);

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const start = Date.now();

    const response = await client.images.generate({
      model: MODEL,
      prompt,
      size: size as ImageSize,
      quality,
      n: 1,
      // JPEG + 85% reduz o tamanho em ~3-5x vs PNG, evitando o limite de 4.5MB
      // de body de resposta da Vercel quando a imagem é 1536x1024 em high.
      output_format: "jpeg",
      output_compression: 85,
    });
    const elapsed = Date.now() - start;
    console.log(
      `[generate-image] slot=${slot.kind} size=${size} q=${quality} ${elapsed}ms`
    );

    const b64 = response.data?.[0]?.b64_json;
    if (!b64) {
      return NextResponse.json(
        { error: "OpenAI não devolveu imagem." },
        { status: 502 }
      );
    }

    return NextResponse.json({
      image_b64: `data:image/jpeg;base64,${b64}`,
      prompt,
      size,
      quality,
      elapsed_ms: elapsed,
    });
  } catch (err) {
    const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    console.error("[generate-image] erro:", err);
    return NextResponse.json({ error: `Erro interno: ${msg}` }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    endpoint: "/api/generate-image",
    method: "POST",
    model: MODEL,
  });
}
