import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      // La Ruleta de retos (HTML de un solo dispositivo) se retiró el 2026-10-24.
      { source: "/juegos/ruleta-elimlldm.html", destination: "/juegos", permanent: true },
    ];
  },
};

export default nextConfig;
