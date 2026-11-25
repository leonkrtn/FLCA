import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Pfeil } from "@/components/icons";
import { AngebotsChip } from "@/components/site/angebot";
import { BEREICHE } from "@/components/site/leistungsbereiche";
import { preis } from "@/lib/format";
import { KATEGORIEN, oeffentlicheLeistungen } from "@/lib/inhalte";
import type { Leistung } from "@/lib/termine";

export const revalidate = 300;
export const metadata: Metadata = { title: "Leistungen", description: "Reifenservice, Ölwechsel, Inspektion, Reparatur und Rostschutz in Dietzenbach." };

/**
 * Preis groß unten in der Karte, damit Name und Text oben die volle Breite haben. Bei einem Angebot steht der
 * Listenpreis klein durchgestrichen davor; „ab“ klein, damit die Zahl selbst groß bleibt.
 */
function Preis({ l }: { l: Leistung }) {
  if (l.preis_cent === null) return <p className="text-lg text-grau">auf Anfrage</p>;
  const alt = l.angebot?.listen_cent;
  return (
    <p className="zahlen flex flex-wrap items-baseline gap-x-2">
      {alt != null && alt !== l.preis_cent ? (
        <>
          <span className="sr-only">statt </span>
          <s className="text-grau">{preis(alt, l.preis_ab)}</s>
          <span className="sr-only">jetzt </span>
        </>
      ) : null}
      {l.preis_ab ? <span className="text-grau">ab</span> : null}
      <span className="schmal text-4xl normal-case">{preis(l.preis_cent)}</span>
    </p>
  );
}

export default async function LeistungenSeite() {
  const leistungen = await oeffentlicheLeistungen();
  return (
    <div className="rand pb-24 pt-10 md:pt-16">
      <h1 className="schmal mb-14 text-6xl md:text-8xl">Leistungen</h1>
      <div className="space-y-16 md:space-y-24">
        {Object.entries(KATEGORIEN).map(([k, name]) => {
          const liste = leistungen.filter((l) => l.kategorie === k);
          if (!liste.length) return null;
          const bereich = BEREICHE.find((b) => b.kategorie === k);
          return (
            <section key={k} aria-labelledby={`bereich-${k}`}>
              {/* Bildbanner wie die Kacheln der Startseite; ein Bereich ohne Foto bekommt nur die Überschrift */}
              {bereich ? (
                <div className="relative isolate mb-4 flex min-h-56 flex-col justify-end overflow-hidden rounded-lg bg-flaeche p-6 text-hell md:aspect-[21/6] md:min-h-0 md:p-10">
                  <Image src={bereich.bild} alt={bereich.alt} fill sizes="(min-width: 1280px) 80rem, 100vw" className="-z-10 object-cover" />
                  <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black via-black/60 to-black/10 md:bg-gradient-to-r md:from-black/85 md:via-black/50 md:to-transparent" />
                  <h2 id={`bereich-${k}`} className="schmal text-4xl md:text-6xl">
                    {name}
                  </h2>
                  <p className="mt-2 max-w-md text-hell/75">{bereich.text}</p>
                </div>
              ) : (
                <h2 id={`bereich-${k}`} className="schmal mb-5 text-3xl text-grau md:text-4xl">
                  {name}
                </h2>
              )}
              <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {liste.map((l) => (
                  <li key={l.id} className="flex flex-col rounded-lg bg-flaeche p-6 ring-1 ring-linie">
                    {l.angebot ? <AngebotsChip angebot={l.angebot} className="mb-3 w-fit" /> : null}
                    <h3 className="text-xl font-semibold">
                      <Link href={`/leistungen/${l.slug}`} className="hover:underline">
                        {l.name}
                      </Link>
                    </h3>
                    <p className="mt-2 text-grau">{l.beschreibung}</p>
                    <div className="mt-auto pt-6">
                      <Preis l={l} />
                      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-3">
                        {l.online_anfragbar ? (
                          <Link href={`/termin?leistung=${l.slug}`} className="knopf knopf-rot knopf-klein">
                            Termin anfragen
                          </Link>
                        ) : null}
                        <Link href={`/leistungen/${l.slug}`} className="group inline-flex items-center gap-2 text-sm font-semibold text-tinte/70 hover:text-tinte">
                          Details <Pfeil className="size-4 transition-transform group-hover:translate-x-1" />
                          <span className="sr-only"> zu {l.name}</span>
                        </Link>
                      </div>
                    </div>
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
