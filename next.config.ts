import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      // La Ruleta de retos (HTML de un solo dispositivo) se retiró el 2026-10-24.
      { source: "/juegos/ruleta-elimlldm.html", destination: "/juegos", permanent: true },
      // Elim Arena (/arena) y Trivia en Vivo (/trivia) se retiraron en la
      // Fase 3 de la Sala de Espera; Trivia en línea y Ruleta cubren su
      // función. Los enlaces viejos llevan a /juegos en vez de dar 404.
      { source: "/arena", destination: "/juegos", permanent: false },
      { source: "/arena/:path*", destination: "/juegos", permanent: false },
      { source: "/trivia", destination: "/juegos", permanent: false },
      { source: "/trivia/:path*", destination: "/juegos", permanent: false },
    ];
  },
};

export default nextConfig;
