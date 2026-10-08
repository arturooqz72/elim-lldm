import type { Metadata, Viewport } from "next";
import { RadioPwa } from "@/components/radio/RadioPwa";

// La radio se instala como app aparte, "Radio Elim": su propio manifest
// (scope /escuchar), íconos y nombre en iPhone. Estos valores reemplazan a
// los del layout raíz solo en /escuchar; no tocan los de Elim English
// (/ingles) ni el manifest general del sitio.
export const metadata: Metadata = {
  title: "Radio Elim — Escucha en vivo",
  description: "Escucha Elim LLDM Radio en vivo, 24/7. Instálala como app en tu celular.",
  manifest: "/escuchar/manifest.webmanifest",
  applicationName: "Radio Elim",
  appleWebApp: {
    capable: true,
    title: "Radio Elim",
    // Barra negra sólida: el contenido empieza debajo de la hora y la batería.
    statusBarStyle: "black",
  },
  icons: {
    icon: [
      { url: "/escuchar/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/escuchar/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/escuchar/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  openGraph: {
    title: "Radio Elim — En vivo 24/7",
    description: "Escucha Elim LLDM Radio en vivo desde tu celular.",
    type: "website",
    url: "https://www.elimlldm.net/escuchar",
    images: [{ url: "https://www.elimlldm.net/escuchar/icons/icon-512.png", width: 512, height: 512 }],
  },
  other: {
    // Next solo emite "mobile-web-app-capable"; iPhone con iOS viejo lee esta.
    "apple-mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  themeColor: "#0A0A12",
};

export default function EscucharLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <RadioPwa />
    </>
  );
}
