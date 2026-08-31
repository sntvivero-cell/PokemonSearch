import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Footer } from "./components/layout/Footer";
import { CookieConsentBanner } from "./components/layout/CookieConsentBanner";
import { NotificationNoticeBanner } from "./components/layout/NotificationNoticeBanner";
import { Analytics } from "@vercel/analytics/next";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// metadataBase es lo que permite que rutas relativas en openGraph.images/alternates de
// ESTE layout y de cada page.tsx se resuelvan a URLs absolutas correctas en producción
// (sin esto, Next arma el link de la imagen OG apuntando a localhost en el build).
//
// openGraph/twitter de acá son la base: cada page.tsx que define su propio openGraph
// solo necesita `title`/`description` — `images`/`siteName`/`type` se heredan de este
// objeto porque el App Router mergea los campos de openGraph/twitter que falten desde
// el layout padre, no hace falta repetirlos en cada página.
export const metadata: Metadata = {
  metadataBase: new URL("https://gotraderz.com"),
  title: "GoTraderz — Pokémon GO Trading Community Board",
  description: "Post and browse Pokémon GO trades with other trainers — Shiny, Legendary, Lucky, and Special Trades.",
  icons: {
    icon: "/icon-512.png",
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    siteName: "GoTraderz",
    type: "website",
    locale: "en_US",
    // logo-1024.png es cuadrado (1024x1024) — el tamaño ideal de una imagen OG es
    // 1200x630 (proporción 1.91:1). Funciona como preview, pero un banner diseñado a
    // ese tamaño se vería mejor al compartir en Discord/Reddit/Twitter que un logo
    // cuadrado recortado por la plataforma.
    images: [{ url: "/logo-1024.png", width: 1024, height: 1024, alt: "GoTraderz" }],
  },
  twitter: {
    card: "summary_large_image",
    images: ["/logo-1024.png"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <div className="flex flex-1 flex-col">{children}</div>
        <Footer />
        <CookieConsentBanner />
        <NotificationNoticeBanner />
        <Analytics />
      </body>
    </html>
  );
}
