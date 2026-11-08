import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { ENV } from "@/lib/env";
import "./globals.css";

const barlow = localFont({
  src: [
    { path: "../fonts/barlow-latin-400-normal.woff2", weight: "400" },
    { path: "../fonts/barlow-latin-500-normal.woff2", weight: "500" },
    { path: "../fonts/barlow-latin-600-normal.woff2", weight: "600" },
    { path: "../fonts/barlow-latin-ext-400-normal.woff2", weight: "400" },
    { path: "../fonts/barlow-latin-ext-500-normal.woff2", weight: "500" },
    { path: "../fonts/barlow-latin-ext-600-normal.woff2", weight: "600" },
  ],
  variable: "--font-barlow",
  display: "swap",
});

const barlowCondensed = localFont({
  src: [
    { path: "../fonts/barlow-condensed-latin-600-normal.woff2", weight: "600" },
    { path: "../fonts/barlow-condensed-latin-700-normal.woff2", weight: "700" },
    { path: "../fonts/barlow-condensed-latin-ext-600-normal.woff2", weight: "600" },
    { path: "../fonts/barlow-condensed-latin-ext-700-normal.woff2", weight: "700" },
  ],
  variable: "--font-barlow-condensed",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(ENV.siteUrl),
  title: { default: "FLC Automotive | Reifen & Kfz-Service in Dietzenbach", template: "%s | FLC Automotive" },
  description:
    "Meisterbetrieb in Dietzenbach: Radwechsel ab 40 €, Reifenmontage, Ölwechsel, Fahrzeugaufbereitung zu Festpreisen. Termin online anfragen.",
  openGraph: { type: "website", locale: "de_DE", siteName: "FLC Automotive" },
};

export const viewport: Viewport = {
  themeColor: "#ecebe7",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" className={`${barlow.variable} ${barlowCondensed.variable}`}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
