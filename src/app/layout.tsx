import type { Metadata, Viewport } from "next";
import { Inter, Cinzel } from "next/font/google";
import "./globals.css";
import { AudioPlayerProvider } from "@/components/elimplay/AudioPlayerProvider";
import { GlobalPlayerBar } from "@/components/elimplay/GlobalPlayerBar";
import { PwaRegister } from "@/components/PwaRegister";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const cinzel = Cinzel({
  variable: "--font-cinzel",
  subsets: ["latin"],
  weight: ["700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Elim LLDM — Predicando la Fe al Mundo",
  description:
    "Plataforma cristiana LLDM: radio 24/7, pláticas en vivo, juegos bíblicos y archivo de grabaciones.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Elim Radio",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
  },
  openGraph: {
    title: "Elim LLDM",
    description: "Predicando la Fe al Mundo",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#D4A017",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${inter.variable} ${cinzel.variable} h-full`}>
      <body className="min-h-full flex flex-col antialiased">
        <AudioPlayerProvider>
          {children}
          <GlobalPlayerBar />
        </AudioPlayerProvider>
        <PwaRegister />
      </body>
    </html>
  );
}
