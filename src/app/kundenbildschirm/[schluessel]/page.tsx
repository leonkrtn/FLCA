import type { Metadata, Viewport } from "next";
import { Kundenbildschirm } from "@/components/kundenbildschirm/bildschirm";
import { Logo } from "@/components/logo";
import { einstellungen } from "@/lib/einstellungen";
import { geraetPerSchluessel } from "@/lib/kundenbildschirm/daten";
import { rechtstext } from "@/lib/rechtstexte";

export const metadata: Metadata = { title: "Kundenbildschirm", robots: { index: false, follow: false } };
export const viewport: Viewport = { themeColor: "#ffffff" };

/**
 * Kundenbildschirm im Büro. Offen ohne Anmeldung, aber nur mit gültigem Geräteschlüssel; gesperrte oder falsche
 * Schlüssel sehen nur einen Hinweis und nichts aus der Kartei.
 */
export default async function KundenbildschirmSeite({ params }: { params: Promise<{ schluessel: string }> }) {
  const { schluessel } = await params;
  const geraet = await geraetPerSchluessel(schluessel);
  if (!geraet) {
    return (
      <main className="grid min-h-dvh place-items-center bg-boden p-6 text-center text-tinte">
        <div className="grid justify-items-center gap-4">
          <Logo className="h-16 w-auto" />
          <p className="text-xl font-semibold">Dieser Bildschirm ist nicht freigeschaltet.</p>
          <p className="text-grau">Den Link gibt es in der Verwaltung unter „Kundenbildschirm“.</p>
        </div>
      </main>
    );
  }
  const [{ firma }, datenschutz, agb] = await Promise.all([einstellungen(), rechtstext("datenschutz"), rechtstext("agb")]);
  return <Kundenbildschirm schluessel={schluessel} firma={firma.name} datenschutz={datenschutz.html} agb={agb.html} />;
}
