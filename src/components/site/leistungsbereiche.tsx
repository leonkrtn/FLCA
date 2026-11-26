import Image, { type StaticImageData } from "next/image";
import Link from "next/link";
import oelstand from "@/assets/oelstand.jpg";
import reifenmaschine from "@/assets/reifenmaschine.jpg";
import schweissen from "@/assets/schweissen.jpg";
import { Pfeil } from "@/components/icons";
import { AngebotsChip, AngebotsPreisText } from "@/components/site/angebot";
import { preis } from "@/lib/format";
import type { Leistung } from "@/lib/termine";

/** Bereiche mit Foto und Kurztext; auch die Seite „Leistungen“ nimmt sie für ihre Bildbanner. */
export const BEREICHE: { kategorie: string; titel: string; text: string; bild: StaticImageData; alt: string; flaeche: string; breit?: boolean }[] = [
  {
    kategorie: "reifen",
    titel: "Reifen",
    text: "Radwechsel in rund 30 Minuten, gewuchtet und mit Drehmoment angezogen.",
    bild: reifenmaschine,
    alt: "Reifenmontiermaschine und Wuchtmaschine in der Werkstatt in Dietzenbach",
    flaeche: "md:col-span-6 md:row-span-2",
  },
  {
    kategorie: "service",
    titel: "Service und Reparatur",
    text: "Ölwechsel, Inspektion, Bremsen, Klima. Preis vorher.",
    bild: oelstand,
    alt: "Ölstand wird mit dem Messstab und einem Tuch geprüft",
    flaeche: "md:col-span-6 md:row-span-2",
  },
  {
    kategorie: "schutz",
    titel: "Rostschutz",
    text: "Hohlraum und Unterboden, damit Schweller und Boden halten.",
    bild: schweissen,
    alt: "Schweißarbeit im Dunkeln, Lichtbogen am Metall",
    flaeche: "md:col-span-12 md:min-h-[440px]",
    breit: true,
  },
];

/**
 * Leistungen als Bildkacheln in unterschiedlicher Größe. Auf jeder Kachel stehen die Leistungen als gleich große
 * Glas-Boxen in einem festen Raster (frei umbrechende Chips unterschiedlicher Breite wirkten unruhig), jede führt
 * direkt in die Terminanfrage. Leistungen mit laufendem Angebot stehen darüber in einer breiten Box.
 */
export function Leistungsbereiche({ leistungen }: { leistungen: Leistung[] }) {
  return (
    <>
    <div className="grid gap-4 md:auto-rows-[minmax(300px,auto)] md:grid-cols-12">
      {BEREICHE.map((b) => {
        const liste = leistungen.filter((l) => l.kategorie === b.kategorie);
        if (!liste.length) return null;
        const angebote = liste.flatMap((l) => (l.angebot ? [{ l, angebot: l.angebot }] : []));
        const uebrige = liste.filter((l) => !l.angebot);
        return (
          <article key={b.kategorie} className={`group relative isolate flex min-h-[480px] flex-col justify-end overflow-hidden rounded-lg bg-flaeche ${b.flaeche}`}>
            <Image
              src={b.bild}
              alt={b.alt}
              fill
              sizes="(min-width: 768px) 60vw, 100vw"
              className="-z-10 object-cover transition-transform duration-700 ease-[var(--ease-ruhig)] group-hover:scale-[1.04]"
            />
            <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black via-black/80 to-black/10" />
            <div className="p-5 md:p-7">
              <h3 className="schmal mb-1 text-3xl text-hell md:text-4xl">{b.titel}</h3>
              <p className="mb-5 max-w-md text-hell/75">{b.text}</p>
              {/* Angebote stehen über dem Raster in voller Breite: im Raster zöge ihre Höhe alle Reihen mit hoch */}
              {angebote.length ? (
                <ul className="mb-2 grid gap-2">
                  {angebote.map(({ l, angebot }) => (
                    <li key={l.id}>
                      <AngebotsBox l={l} angebot={angebot} />
                    </li>
                  ))}
                </ul>
              ) : null}
              {/* auto-rows-fr: alle Boxen gleich hoch, auch wenn ein Name auf zwei Zeilen umbricht */}
              <ul className={`grid auto-rows-fr grid-cols-2 gap-2 ${b.breit ? "sm:grid-cols-3 lg:grid-cols-4" : ""}`}>
                {uebrige.map((l) => (
                  <li key={l.id}>
                    <LeistungsBox l={l} />
                  </li>
                ))}
              </ul>
            </div>
          </article>
        );
      })}
    </div>
      <Link href="/leistungen" className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-grau hover:text-tinte">
        Alle Leistungen mit Beschreibung <Pfeil className="size-4" />
      </Link>
    </>
  );
}

const GLAS = "h-full rounded-md text-hell ring-1 backdrop-blur-md transition-colors";

/** Eine Leistung: Name oben, Preis unten, damit die Preise einer Reihe auf einer Linie stehen. */
function LeistungsBox({ l }: { l: Leistung }) {
  return (
    <Link href={`/termin?leistung=${l.slug}`} className={`${GLAS} flex flex-col justify-between gap-3 bg-white/10 p-3.5 ring-white/15 hover:bg-white/20`}>
      <span className="hyphens-auto text-sm leading-snug">{l.name}</span>
      {l.preis_cent === null ? (
        <span className="text-sm text-hell/60">auf Anfrage</span>
      ) : (
        <span className="zahlen text-lg">{preis(l.preis_cent, l.preis_ab)}</span>
      )}
    </Link>
  );
}

/** Leistung im Angebot: volle Breite, mit Angebotschip und dem alten Preis durchgestrichen vor dem neuen. */
function AngebotsBox({ l, angebot }: { l: Leistung; angebot: NonNullable<Leistung["angebot"]> }) {
  return (
    <Link
      href={`/termin?leistung=${l.slug}`}
      className={`${GLAS} flex flex-wrap items-end justify-between gap-x-4 gap-y-3 bg-white/15 p-4 ring-white/30 hover:bg-white/25`}
    >
      <span className="flex min-w-0 flex-col items-start gap-2">
        <AngebotsChip angebot={angebot} />
        <span className="hyphens-auto text-base leading-snug">{l.name}</span>
      </span>
      <AngebotsPreisText l={l} className="schmal zahlen text-3xl leading-none [&_s]:text-lg" />
    </Link>
  );
}
