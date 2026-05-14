"use client";

import { cn } from "@/lib/utils";

type PreviewIframeProps = {
  html: string | null;
  loading?: boolean;
  className?: string;
};

export function PreviewIframe({ html, loading, className }: PreviewIframeProps) {
  return (
    <div className={cn("relative h-full w-full bg-muted", className)}>
      {html ? (
        <iframe
          title="Preview da listicle"
          sandbox="allow-same-origin allow-scripts"
          srcDoc={html}
          className="h-full w-full border-0 bg-white"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
          Clique em &ldquo;Atualizar preview&rdquo; pra ver a página renderizada.
        </div>
      )}
      {loading && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-background/60 text-sm text-muted-foreground">
          Gerando preview…
        </div>
      )}
    </div>
  );
}
