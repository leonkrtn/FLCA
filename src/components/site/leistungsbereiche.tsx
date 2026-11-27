import Image, { type StaticImageData } from "next/image";
import Link from "next/link";
import oelstand from "@/assets/oelstand.jpg";
import reifenmaschine from "@/assets/reifenmaschine.jpg";
import schweissen from "@/assets/schweissen.jpg";
import { Pfeil } from "@/components/icons";
import { preis } from "@/lib/format";
import type { Leistung } from "@/lib/termine";

/** Bereiche mit Foto und Kurztext; die Seite „Leistungen“ nimmt die Texte unter ihre Reiter (ohne die Fotos). */
export const BEREICHE: { kategorie: string; titel: string; text: string; bild: StaticImageData; alt: string }[] = [
  {
    kategorie: "reifen",
    titel: "Reifen",
    text: "Radwechsel in rund 30 Minuten, gewuchtet und mit Drehmoment angezogen.",
    bild: reifenmaschine,
    alt: "Reifenmontiermaschine und Wuchtmaschine in der Werkstatt in Dietzenbach",
  },
  {
    kategorie: "service",
    titel: "Service und Reparatur",
    text: "Ölwechsel, Inspektion, Bremsen, Klima. Preis vorher.",
    bild: oelstand,
    alt: "Ölstand wird mit dem Messstab und einem Tuch geprüft",
  },
  {
    kategorie: "schutz",
    titel: "Rostschutz",
    text: "Hohlraum und Unterboden, damit Schweller und Boden halten.",
    bild: schweissen,
    alt: "Schweißarbeit im Dunkeln, Lichtbogen am Metall",
  },
];

const ETIKETT = "text-[11px] font-semibold uppercase leading-none tracking-[0.16em] text-grau";

/**
 * Startseite: nur die Bereiche, jeder mit freiem Foto (kein Text darüber), Titel, einem Satz und zwei kleinen
 * Feldern (Anzahl, günstigster Preis). Die einzelnen Preise stehen auf der Seite „Leistungen“, die Kachel führt
 * direkt zu ihrem Reiter. Ohne Rahmen und Trennstriche, nur Flächen.
 */
export function Leistungsbereiche({ leistungen }: { leistungen: Leistung[] }) {
  return (
    <>
      <div className="grid gap-10 md:grid-cols-3 md:gap-5">
        {BEREICHE.map((b, i) => {
          const liste = leistungen.filter((l) => l.kategorie === b.kategorie);
          if (!liste.length) return null;
          // Günstigster Preis des Bereichs, mit Angebot schon der Angebotspreis (preis_cent ist der geltende Preis)
          const preise = liste.flatMap((l) => (l.preis_cent === null ? [] : [l.preis_cent]));
          return (
            <Link key={b.kategorie} href={`/leistungen#bereich-${b.kategorie}`} className="group flex flex-col">
              <div className="relative aspect-[4/3] overflow-hidden rounded-lg bg-flaeche">
                <Image
                  src={b.bild}
                  alt={b.alt}
                  fill
                  sizes="(min-width: 768px) 33vw, 100vw"
                  className="object-cover transition-transform duration-700 ease-[var(--ease-ruhig)] group-hover:scale-[1.04]"
                />
                <span className="zahlen absolute left-3 top-3 rounded-md bg-black/55 px-2 py-1 text-[11px] font-semibold leading-none tracking-[0.12em] text-hell backdrop-blur-sm">
                  {String(i + 1).padStart(2, "0")}
                </span>
              </div>
              <h3 className="schmal mt-4 text-3xl md:text-4xl">{b.titel}</h3>
              <p className="mb-4 mt-1.5 text-grau">{b.text}</p>
              {/* mt-auto: die Felder stehen in allen drei Spalten auf einer Höhe, auch bei längerem Text */}
              <div className="zahlen mt-auto grid grid-cols-[1fr_1fr_3.25rem] gap-1.5">
                <span className="rounded-md bg-flaeche px-3 py-2.5">
                  <span className={`block ${ETIKETT}`}>Leistungen</span>
                  <span className="mt-1.5 block text-lg font-semibold leading-none">{liste.length}</span>
                </span>
                <span className="rounded-md bg-flaeche px-3 py-2.5">
                  <span className={`block ${ETIKETT}`}>Preise</span>
                  <span className="mt-1.5 block whitespace-nowrap text-lg font-semibold leading-none">{preise.length ? `ab ${preis(Math.min(...preise))}` : "auf Anfrage"}</span>
                </span>
                <span className="flex items-center justify-center rounded-md bg-rot text-auf-rot transition-colors group-hover:bg-rot-dunkel" aria-hidden>
                  <Pfeil className="size-5" />
                </span>
              </div>
            </Link>
          );
        })}
      </div>
      <Link href="/leistungen" className="mt-4 inline-flex items-center gap-2 py-3 text-sm font-semibold text-grau hover:text-tinte">
        Alle Leistungen mit Preisen <Pfeil className="size-4" />
      </Link>
    </>
  );
}
