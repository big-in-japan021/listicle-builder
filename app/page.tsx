import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-24">
      <div className="flex w-full max-w-xl flex-col items-center gap-8 text-center">
        <div className="flex flex-col gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Editor
          </p>
          <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
            Listicle Builder
          </h1>
          <p className="text-balance text-base text-muted-foreground sm:text-lg">
            Gera listicle pages a partir da sua copy bruta e imagens, com IA
            estruturando o conteúdo e desenhando as imagens contextuais.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Link
            href="/editor/listicle-classica"
            className={buttonVariants({ size: "lg" })}
          >
            Novo projeto
          </Link>
        </div>

        <p className="text-xs text-muted-foreground">
          MVP — template disponível: <code>listicle-classica</code>
        </p>
      </div>
    </main>
  );
}
