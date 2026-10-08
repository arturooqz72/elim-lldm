import type { Metadata, Viewport } from "next";
import { InglesPwa } from "@/components/ingles/InglesPwa";

// Elim English se instala como app aparte: su propio manifest (scope
// /ingles), íconos y nombre en iPhone. Estos valores reemplazan a los del
// layout raíz (Elim Radio) solo en las páginas de /ingles.
export const metadata: Metadata = {
  manifest: "/ingles/manifest.webmanifest",
  applicationName: "Elim English",
  appleWebApp: {
    capable: true,
    title: "Elim English",
    // Barra negra sólida: el contenido empieza debajo de la hora y la batería.
    statusBarStyle: "black",
  },
  icons: {
    icon: [
      { url: "/ingles/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/ingles/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/ingles/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  other: {
    // Next solo emite "mobile-web-app-capable"; iPhone con iOS viejo lee esta.
    "apple-mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  themeColor: "#f5c842",
};

export default function InglesLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <InglesPwa />
    </>
  );
}
