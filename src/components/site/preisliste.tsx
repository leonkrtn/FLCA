import Link from "next/link";
import { preis } from "@/lib/format";
import { KATEGORIEN } from "@/lib/inhalte";
import type { Leistung } from "@/lib/termine";

/** Preise wie auf einer Teileliste: Bezeichnung links, Betrag rechtsbündig in Ziffern gleicher Breite. */
export function Preisliste({ leistungen }: { leistungen: Leistung[] }) {
  const gruppen = Object.entries(KATEGORIEN)
    .map(([schluessel, name]) => ({ name, eintraege: leistungen.filter((l) => l.kategorie === schluessel) }))
    .filter((g) => g.eintraege.length);
  return (
    <div className="grid gap-x-16 gap-y-12 lg:grid-cols-2">
      {gruppen.map((g) => (
        <section key={g.name}>
          <h3 className="schmal mb-3 text-lg tracking-wide text-grau">{g.name}</h3>
          <ul className="border-t-2 border-tinte">
            {g.eintraege.map((l) => (
              <li key={l.id} className="border-b border-linie">
                <Link href={`/termin?leistung=${l.slug}`} className="group grid grid-cols-[1fr_auto] items-baseline gap-x-4 py-3">
                  <span>
                    <span className="font-semibold group-hover:underline">{l.name}</span>
                    <span className="block text-sm text-grau">{l.kurz}</span>
                  </span>
                  <span className={`zahlen text-right ${l.preis_cent === null ? "text-sm text-grau" : "text-lg"}`}>{preis(l.preis_cent, l.preis_ab)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
      <p className="text-sm text-grau lg:col-span-2">Alle Preise inklusive 19 % Mehrwertsteuer. Bezahlen können Sie bar oder per Überweisung.</p>
    </div>
  );
}
