import type { Metadata } from "next";
import { LeistungenReiter } from "@/components/site/leistungen-reiter";
import { AngebotsStreifen, LeistungsZeile, TafelKopf } from "@/components/site/preistafel";
import { KATEGORIEN, oeffentlicheLeistungen } from "@/lib/inhalte";

export const revalidate = 300;
export const metadata: Metadata = { title: "Leistungen", description: "Reifenservice, Ölwechsel, Inspektion, Reparatur und Rostschutz in Dietzenbach." };

/** Kurze Namen für die Reiter: „Service und Reparatur“ passt am Telefon nicht neben zwei andere. */
const KURZ: Record<string, string> = { service: "Service" };

const ETIKETT = "text-[11px] font-semibold uppercase leading-none tracking-[0.16em] text-grau";

/**
 * Preisliste: oben laufende Angebote, darunter ein Reiter je Bereich mit seinen Leistungen. Bewusst ohne Fotos
 * (die stehen auf der Startseite) und ohne Trennstriche, nur Flächen und Abstand.
 */
export default async function LeistungenSeite() {
  const leistungen = await oeffentlicheLeistungen();
  const bereiche = Object.entries(KATEGORIEN)
    .map(([schluessel, name]) => ({
      schluessel,
      name,
      liste: leistungen.filter((l) => l.kategorie === schluessel),
    }))
    .filter((b) => b.liste.length);

  return (
    <div className="rand pb-24 pt-10 md:pt-16">
      <div className={`flex flex-wrap justify-between gap-x-6 gap-y-2 ${ETIKETT}`}>
        <span>Preisliste</span>
        <span className="zahlen">Endpreise inkl. 19 % MwSt.</span>
      </div>
      <h1 className="schmal mt-4 text-6xl md:text-8xl">Leistungen</h1>
      <AngebotsStreifen leistungen={leistungen} />
      <LeistungenReiter
        bereiche={bereiche.map((b, i) => ({
          schluessel: b.schluessel,
          kurz: KURZ[b.schluessel] ?? b.name,
          anzahl: b.liste.length,
          inhalt: (
            <section aria-labelledby={`titel-${b.schluessel}`} className="pt-8">
              <p className={`zahlen ${ETIKETT}`}>Bereich {String(i + 1).padStart(2, "0")}</p>
              <h2 id={`titel-${b.schluessel}`} className="schmal mt-3 text-4xl md:text-5xl">
                {b.name}
              </h2>
              <div className="mt-6">
                <TafelKopf />
                <ul className="grid gap-2">
                  {b.liste.map((l, n) => (
                    <LeistungsZeile key={l.id} l={l} nr={n + 1} />
                  ))}
                </ul>
              </div>
            </section>
          ),
        }))}
      />
      <p className="mt-6 max-w-prose text-sm text-grau">Antippen für die Beschreibung. Mehreres auf einmal wählen Sie in der Terminanfrage.</p>
    </div>
  );
}
