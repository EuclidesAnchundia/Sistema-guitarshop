import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Evita que el bundler intente empaquetar dependencias server-only problemáticas.
  serverExternalPackages: ["prisma", "@prisma/client"],
  // Fija la raíz usada por Next.js para el "output file tracing" en monorepos
  // Apunta a la carpeta raíz del workspace (una carpeta arriba).
  outputFileTracingRoot: path.join(__dirname, ".."),
};

export default nextConfig;
