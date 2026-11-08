import type { Metadata } from "next";
import { Buchung } from "@/components/site/buchung";
import { einstellungen } from "@/lib/einstellungen";
import { telHref } from "@/lib/format";
import { oeffentlicheLeistungen } from "@/lib/inhalte";

export const metadata: Metadata = {
  title: "Termin anfragen",
  description: "Leistung wählen, freien Termin wählen, fertig. Wir bestätigen meist noch am selben Tag.",
};

export default async function TerminSeite({ searchParams }: { searchParams: Promise<{ leistung?: string }> }) {
  const [{ leistung }, leistungen, e] = await Promise.all([searchParams, oeffentlicheLeistungen(), einstellungen()]);
  const buchbar = leistungen.filter((l) => l.online_anfragbar);
  const vorauswahl = buchbar.find((l) => l.slug === leistung)?.id ?? null;

  return (
    <div className="rand pb-24 pt-8 md:pt-14">
      <div className="mb-8 max-w-2xl md:mb-12">
        <h1 className="schmal text-4xl md:text-5xl">Termin anfragen</h1>
        <p className="mt-3 text-grau">
          Sie sehen nur Zeiten, die wirklich frei sind. Wir halten Ihren Termin {e.buchung.haltenStd} Stunden fest und bestätigen ihn per E-Mail, meist noch am selben Tag.
        </p>
      </div>
      {e.buchung.aktiv ? (
        <Buchung
          leistungen={buchbar.map((l) => ({ id: l.id, slug: l.slug, name: l.name, kurz: l.kurz, preis_cent: l.preis_cent, preis_ab: l.preis_ab, dauer_min: l.dauer_min, kategorie: l.kategorie }))}
          vorauswahl={vorauswahl}
          telefon={e.firma.telefon}
        />
      ) : (
        <p className="max-w-xl bg-papier p-6">
          Online-Anfragen sind gerade pausiert. Rufen Sie uns an:{" "}
          <a href={telHref(e.firma.telefon)} className="font-semibold underline">
            {e.firma.telefon}
          </a>
        </p>
      )}
    </div>
  );
}
