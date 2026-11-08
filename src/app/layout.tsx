import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { ENV } from "@/lib/env";
import "./globals.css";

const archivo = localFont({
  src: [
    { path: "../fonts/archivo-latin-wdth-normal.woff2", weight: "100 900", style: "normal" },
    { path: "../fonts/archivo-latin-ext-wdth-normal.woff2", weight: "100 900", style: "normal" },
  ],
  variable: "--font-archivo",
  display: "swap",
  declarations: [{ prop: "font-stretch", value: "62% 125%" }],
});

const plex = localFont({
  src: [
    { path: "../fonts/ibm-plex-sans-latin-400-normal.woff2", weight: "400" },
    { path: "../fonts/ibm-plex-sans-latin-500-normal.woff2", weight: "500" },
    { path: "../fonts/ibm-plex-sans-latin-600-normal.woff2", weight: "600" },
    { path: "../fonts/ibm-plex-sans-latin-ext-400-normal.woff2", weight: "400" },
    { path: "../fonts/ibm-plex-sans-latin-ext-600-normal.woff2", weight: "600" },
  ],
  variable: "--font-plex",
  display: "swap",
});

const plexMono = localFont({
  src: [
    { path: "../fonts/ibm-plex-mono-latin-400-normal.woff2", weight: "400" },
    { path: "../fonts/ibm-plex-mono-latin-500-normal.woff2", weight: "500" },
  ],
  variable: "--font-plex-mono",
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
    <html lang="de" className={`${archivo.variable} ${plex.variable} ${plexMono.variable}`}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
