import { promises as fs } from "node:fs";
import path from "node:path";

import { notFound } from "next/navigation";

import { EditorShell } from "@/components/editor/editor-shell";
import type { TemplateSchema } from "@/lib/template-schema";

const ALLOWED_TEMPLATES = new Set(["listicle-classica"]);

async function loadSchema(template: string): Promise<TemplateSchema | null> {
  if (!ALLOWED_TEMPLATES.has(template)) return null;
  const filePath = path.join(
    process.cwd(),
    "templates",
    template,
    "schema.json"
  );
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    return JSON.parse(raw) as TemplateSchema;
  } catch {
    return null;
  }
}

export default async function EditorPage({
  params,
}: {
  params: Promise<{ template: string }>;
}) {
  const { template } = await params;
  const schema = await loadSchema(template);
  if (!schema) notFound();

  return <EditorShell schema={schema} templateName={template} />;
}
