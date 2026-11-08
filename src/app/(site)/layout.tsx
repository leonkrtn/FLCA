import { Fuss } from "@/components/site/fuss";
import { Kopf } from "@/components/site/kopf";
import { MobilLeiste } from "@/components/site/mobil-leiste";
import { einstellungen } from "@/lib/einstellungen";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const e = await einstellungen();
  return (
    <>
      <Kopf module={e.module} telefon={e.firma.telefon} oeffnungszeiten={e.oeffnungszeiten} />
      <main>{children}</main>
      <Fuss e={e} />
      <MobilLeiste telefon={e.firma.telefon} whatsapp={e.firma.whatsapp} />
    </>
  );
}
