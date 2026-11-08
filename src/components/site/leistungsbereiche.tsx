import Image, { type StaticImageData } from "next/image";
import Link from "next/link";
import oelstand from "@/assets/oelstand.jpg";
import porsche from "@/assets/porsche-felge.jpg";
import reifenmaschine from "@/assets/reifenmaschine.jpg";
import schweissen from "@/assets/schweissen.jpg";
import { preis } from "@/lib/format";
import type { Leistung } from "@/lib/termine";

const BEREICHE: { kategorie: string; titel: string; text: string; bild: StaticImageData; alt: string }[] = [
  {
    kategorie: "reifen",
    titel: "Reifen",
    text: "Radwechsel dauert rund 30 Minuten, Sie können dabei warten. Gewuchtet wird immer, angezogen mit dem Drehmomentschlüssel.",
    bild: reifenmaschine,
    alt: "Reifenmontiermaschine und Wuchtmaschine in der Werkstatt in Dietzenbach",
  },
  {
    kategorie: "service",
    titel: "Service und Reparatur",
    text: "Ölwechsel mit Markenöl, Inspektion nach Herstellervorgabe, Bremsen, Fahrwerk, Klima. Bei Reparaturen nennen wir den Preis, bevor wir anfangen.",
    bild: oelstand,
    alt: "Ölstand wird mit dem Messstab und einem Tuch geprüft",
  },
  {
    kategorie: "aufbereitung",
    titel: "Aufbereitung",
    text: "Vom gründlich gereinigten Innenraum bis zur Politur mit Versiegelung. Das Auto bleibt dafür meist einen Tag bei uns.",
    bild: porsche,
    alt: "Porsche 911 in Blau mit schwarzen Felgen nach der Aufbereitung",
  },
  {
    kategorie: "schutz",
    titel: "Rostschutz",
    text: "Hohlraumversiegelung und Unterbodenschutz halten Rost von Schwellern, Türen und Boden fern. Rechnen Sie mit einem ganzen Tag.",
    bild: schweissen,
    alt: "Schweißarbeit im Dunkeln, Lichtbogen am Metall",
  },
];

/**
 * Leistungen nach Bereich, jeweils mit Foto und Preisliste. Die Seiten wechseln von Bereich zu Bereich,
 * damit die Seite nicht wie ein Raster gleicher Kästen wirkt.
 */
export function Leistungsbereiche({ leistungen }: { leistungen: Leistung[] }) {
  return (
    <div className="grid gap-16 md:gap-24">
      {BEREICHE.map((b, i) => {
        const liste = leistungen.filter((l) => l.kategorie === b.kategorie);
        if (!liste.length) return null;
        return (
          <section key={b.kategorie} aria-labelledby={`bereich-${b.kategorie}`} className="grid gap-6 md:grid-cols-12 md:gap-12">
            <div className={`relative aspect-[4/3] overflow-hidden bg-graphit md:col-span-5 md:aspect-auto md:min-h-[420px] ${i % 2 ? "md:order-2 md:col-start-8" : ""}`}>
              <Image src={b.bild} alt={b.alt} fill sizes="(min-width: 768px) 40vw, 100vw" className="object-cover" />
            </div>
            <div className={`md:col-span-7 md:self-center ${i % 2 ? "md:order-1" : ""}`}>
              <h3 id={`bereich-${b.kategorie}`} className="schmal mb-2 text-3xl">
                {b.titel}
              </h3>
              <p className="mb-5 max-w-xl text-grau">{b.text}</p>
              <ul className="border-t-2 border-tinte">
                {liste.map((l) => (
                  <li key={l.id} className="border-b border-linie">
                    <Link href={`/termin?leistung=${l.slug}`} className="group grid grid-cols-[1fr_auto] items-baseline gap-x-4 py-3">
                      <span>
                        <span className="font-semibold group-hover:underline">{l.name}</span>
                        <span className="block text-sm text-grau">{l.kurz}</span>
                      </span>
                      <span className={`zahlen text-right ${l.preis_cent === null ? "text-sm text-grau" : "text-lg font-medium"}`}>{preis(l.preis_cent, l.preis_ab)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        );
      })}
    </div>
  );
}
