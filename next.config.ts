import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // App Service corre "next start" (servidor Node) — NO usar output:"export"
  // output: "export" fue eliminado para habilitar API Routes y SSR.
  output: "standalone",
  images: {
    unoptimized: true,
  },
};

export default nextConfig;