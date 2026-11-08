import Image, { type StaticImageData } from "next/image";
import Link from "next/link";
import oelstand from "@/assets/oelstand.jpg";
import porsche from "@/assets/porsche-felge.jpg";
import reifenmaschine from "@/assets/reifenmaschine.jpg";
import schweissen from "@/assets/schweissen.jpg";
import { Pfeil } from "@/components/icons";
import { preis } from "@/lib/format";
import type { Leistung } from "@/lib/termine";

const BEREICHE: { kategorie: string; titel: string; text: string; bild: StaticImageData; alt: string; flaeche: string }[] = [
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
    flaeche: "md:col-span-6",
  },
  {
    kategorie: "aufbereitung",
    titel: "Aufbereitung",
    text: "Innenraum, Politur, Versiegelung.",
    bild: porsche,
    alt: "Porsche 911 in Blau mit schwarzen Felgen in der Halle",
    flaeche: "md:col-span-6",
  },
  {
    kategorie: "schutz",
    titel: "Rostschutz",
    text: "Hohlraum und Unterboden, damit Schweller und Boden halten.",
    bild: schweissen,
    alt: "Schweißarbeit im Dunkeln, Lichtbogen am Metall",
    flaeche: "md:col-span-12 md:aspect-[21/8]",
  },
];

/**
 * Leistungen als Bildkacheln in unterschiedlicher Größe. Auf jeder Kachel stehen die Leistungen als
 * Preis-Chips, die direkt in die Terminanfrage führen.
 */
export function Leistungsbereiche({ leistungen }: { leistungen: Leistung[] }) {
  return (
    <>
    <div className="grid gap-4 md:auto-rows-[minmax(300px,auto)] md:grid-cols-12">
      {BEREICHE.map((b) => {
        const liste = leistungen.filter((l) => l.kategorie === b.kategorie);
        if (!liste.length) return null;
        const ab = Math.min(...liste.map((l) => l.preis_cent ?? Infinity));
        return (
          <article key={b.kategorie} className={`group relative isolate flex min-h-[480px] flex-col justify-end overflow-hidden rounded-lg bg-flaeche ${b.flaeche}`}>
            <Image
              src={b.bild}
              alt={b.alt}
              fill
              sizes="(min-width: 768px) 60vw, 100vw"
              className="-z-10 object-cover transition-transform duration-700 ease-[var(--ease-ruhig)] group-hover:scale-[1.04]"
            />
            <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black via-black/75 to-black/10" />
            <div className="p-5 md:p-7">
              <div className="mb-1 flex items-baseline justify-between gap-4">
                <h3 className="schmal text-3xl text-hell md:text-4xl">{b.titel}</h3>
                {Number.isFinite(ab) ? <span className="zahlen shrink-0 text-sm text-hell/70">ab {preis(ab)}</span> : null}
              </div>
              <p className="mb-4 max-w-md text-hell/75">{b.text}</p>
              <ul className="flex flex-wrap gap-2">
                {liste.map((l) => (
                  <li key={l.id}>
                    <Link
                      href={`/termin?leistung=${l.slug}`}
                      className="inline-flex items-center gap-2 rounded-md bg-white/10 px-3.5 py-2 text-sm text-hell ring-1 ring-white/15 backdrop-blur-md transition-colors hover:bg-white/20"
                    >
                      {l.name}
                      <span className="zahlen opacity-70">{preis(l.preis_cent, l.preis_ab)}</span>
                    </Link>
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
