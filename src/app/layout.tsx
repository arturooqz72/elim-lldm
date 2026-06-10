import type { Metadata } from "next";
import { Inter, Cinzel } from "next/font/google";
import "./globals.css";
import { AudioPlayerProvider } from "@/components/elimplay/AudioPlayerProvider";
import { GlobalPlayerBar } from "@/components/elimplay/GlobalPlayerBar";

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
  openGraph: {
    title: "Elim LLDM",
    description: "Predicando la Fe al Mundo",
    type: "website",
  },
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
      </body>
    </html>
  );
}
