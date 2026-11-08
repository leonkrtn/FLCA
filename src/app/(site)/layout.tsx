import type { Viewport } from "next";
import { Fuss } from "@/components/site/fuss";
import { Kopf } from "@/components/site/kopf";
import { MobilLeiste } from "@/components/site/mobil-leiste";
import { einstellungen } from "@/lib/einstellungen";

export const viewport: Viewport = { themeColor: "#0b0b0c" };

/** Öffentliche Website im dunklen Design (Klasse „dunkel“ dreht die Farbwerte, siehe globals.css). */
export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const e = await einstellungen();
  return (
    <div className="dunkel min-h-dvh">
      <Kopf module={e.module} telefon={e.firma.telefon} oeffnungszeiten={e.oeffnungszeiten} />
      <main>{children}</main>
      <Fuss e={e} />
      <MobilLeiste telefon={e.firma.telefon} whatsapp={e.firma.whatsapp} />
    </div>
  );
}
