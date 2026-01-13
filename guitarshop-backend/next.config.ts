import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Evita que el bundler intente empaquetar dependencias server-only problemáticas.
  serverExternalPackages: ["prisma", "@prisma/client"],
};

export default nextConfig;
