import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Garante que os arquivos do diretório templates/ vão pro bundle das
  // funções serverless (Vercel), pra /api/build conseguir ler base.html
  // e schema.json em runtime via fs.readFileSync.
  outputFileTracingIncludes: {
    "/api/build": ["./templates/**/*"],
    "/api/structure-copy": ["./templates/**/*"],
  },
};

export default nextConfig;
