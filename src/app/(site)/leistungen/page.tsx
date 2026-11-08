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
    <div className="rand pb-24 pt-8 md:pt-14">
      <h1 className="schmal mb-12 text-4xl md:text-5xl">Leistungen</h1>
      <div className="space-y-14">
        {Object.entries(KATEGORIEN).map(([k, name]) => {
          const liste = leistungen.filter((l) => l.kategorie === k);
          if (!liste.length) return null;
          return (
            <section key={k} className="grid gap-6 md:grid-cols-12">
              <h2 className="schmal text-2xl text-grau md:col-span-3">{name}</h2>
              <ul className="border-t-2 border-tinte md:col-span-9">
                {liste.map((l) => (
                  <li key={l.id} className="border-b border-linie">
                    <Link href={`/leistungen/${l.slug}`} className="group grid grid-cols-[1fr_auto] gap-x-6 gap-y-1 py-5 md:grid-cols-[1fr_8rem_auto]">
                      <span>
                        <span className="text-lg font-semibold group-hover:underline">{l.name}</span>
                        <span className="mt-1 block max-w-prose text-grau">{l.beschreibung}</span>
                      </span>
                      <span className="zahlen self-start text-right text-lg">{preis(l.preis_cent, l.preis_ab)}</span>
                      <Pfeil className="hidden size-5 self-start text-grau group-hover:text-tinte md:block" />
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
