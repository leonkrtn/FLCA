import type { Metadata } from "next";
import Link from "next/link";
import { Pfeil } from "@/components/icons";
import { preis } from "@/lib/format";
import { KATEGORIEN, oeffentlicheLeistungen } from "@/lib/inhalte";

export const revalidate = 300;
export const metadata: Metadata = { title: "Leistungen", description: "Reifenservice, Ölwechsel, Inspektion, Reparatur und Fahrzeugaufbereitung in Dietzenbach." };

export default async function LeistungenSeite() {
  const leistungen = await oeffentlicheLeistungen();
  return (
    <div className="rand pb-24 pt-10 md:pt-16">
      <h1 className="schmal mb-14 text-6xl md:text-8xl">Leistungen</h1>
      <div className="space-y-16">
        {Object.entries(KATEGORIEN).map(([k, name]) => {
          const liste = leistungen.filter((l) => l.kategorie === k);
          if (!liste.length) return null;
          return (
            <section key={k}>
              <h2 className="schmal mb-5 text-3xl text-grau">{name}</h2>
              <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {liste.map((l) => (
                  <li key={l.id}>
                    <Link
                      href={`/leistungen/${l.slug}`}
                      className="group flex h-full flex-col justify-between gap-6 rounded-lg bg-flaeche p-6 ring-1 ring-linie transition-colors hover:ring-grau-hell"
                    >
                      <span>
                        <span className="flex items-start justify-between gap-4">
                          <span className="text-xl font-semibold">{l.name}</span>
                          <span className={`zahlen shrink-0 rounded-md px-3 py-1 text-sm ${l.preis_cent === null ? "text-grau ring-1 ring-linie" : "bg-white/[0.07] text-tinte"}`}>
                            {preis(l.preis_cent, l.preis_ab)}
                          </span>
                        </span>
                        <span className="mt-3 block text-grau">{l.beschreibung}</span>
                      </span>
                      <span className="inline-flex items-center gap-2 text-sm font-semibold text-tinte/70 group-hover:text-tinte">
                        Details und Termin <Pfeil className="size-4 transition-transform group-hover:translate-x-1" />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
