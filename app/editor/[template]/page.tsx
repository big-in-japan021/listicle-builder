import { notFound } from "next/navigation";

import { EditorShell } from "@/components/editor/editor-shell";

const ALLOWED_TEMPLATES = new Set(["listicle-classica"]);

export default async function EditorPage({
  params,
}: {
  params: Promise<{ template: string }>;
}) {
  const { template } = await params;
  if (!ALLOWED_TEMPLATES.has(template)) notFound();

  return <EditorShell templateName={template} />;
}
