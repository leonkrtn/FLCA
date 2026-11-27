import Link from "next/link";
import { Pfeil } from "@/components/icons";
import { AngebotsChip } from "@/components/site/angebot";
import { dauerText, preis } from "@/lib/format";
import type { Leistung } from "@/lib/termine";

/**
 * Preistafel der Seite „Leistungen“: jede Leistung eine Fläche ohne Rahmen und Trennstriche (Wunsch des Betreibers),
 * der Preis groß unten rechts. Gleiche Spalten am PC, am Telefon Name und Text oben, Dauer und Preis unten.
 */

/** Durchgestrichener Listenpreis, wenn ein Angebot den Preis senkt. */
function alterPreis(l: Pick<Leistung, "preis_cent" | "angebot">): number | null {
  const alt = l.angebot?.listen_cent;
  return alt != null && l.preis_cent !== null && alt !== l.preis_cent ? alt : null;
}

/**
 * Preis groß unten rechts, als käme er aus dem Boden seiner Box: Die Box hat unten keinen Innenabstand und schneidet
 * ab (overflow-hidden), die Ziffern sitzen auf ihrer Unterkante. Nur die leere Unterlänge der Schrift verschwindet
 * dabei, die Ziffern selbst bleiben ganz.
 */
export function GrossPreis({ l, gross = false, className = "" }: { l: Pick<Leistung, "preis_cent" | "preis_ab" | "angebot">; gross?: boolean; className?: string }) {
  if (l.preis_cent === null) return <span className={`schmal justify-self-end whitespace-nowrap pb-4 text-right text-xl leading-none text-grau md:text-2xl ${className}`}>auf Anfrage</span>;
  const alt = alterPreis(l);
  return (
    <span className={`zahlen flex flex-col items-end ${className}`}>
      {alt !== null ? (
        <span className="text-sm text-grau">
          <span className="sr-only">statt </span>
          <s>{preis(alt, l.preis_ab)}</s>
          <span className="sr-only"> jetzt</span>
        </span>
      ) : null}
      <span className={`schmal flex translate-y-[0.04em] items-baseline gap-1.5 whitespace-nowrap leading-[0.82] ${gross ? "text-7xl md:text-8xl" : "text-[3.25rem] md:text-6xl"}`}>
        {l.preis_ab ? <span className="text-xl normal-case text-grau">ab</span> : null}
        {preis(l.preis_cent)}
      </span>
    </span>
  );
}

const ETIKETT = "text-[11px] font-semibold uppercase leading-none tracking-[0.16em]";
/** Jede Zeile ist ein eigenes Raster: Spalten mit „auto“ wären je Zeile anders breit, deshalb feste Breiten. */
const SPALTEN = "md:grid-cols-[2.5rem_minmax(0,1fr)_minmax(0,1.4fr)_7rem_7.5rem_11rem]";

/** Spaltenköpfe der Tafel, nur am PC. */
export function TafelKopf() {
  return (
    <div className={`hidden gap-x-6 px-6 pb-3 text-grau md:grid ${SPALTEN} ${ETIKETT}`} aria-hidden>
      <span>Nr.</span>
      <span>Leistung</span>
      <span>Umfang</span>
      <span>Dauer</span>
      <span />
      <span className="text-right">Preis</span>
    </div>
  );
}

/**
 * Eine Leistung. Die ganze Fläche führt zur Beschreibung (darüber liegt ein Link, so gibt es keine Links in Links);
 * „Anfragen“ am PC liegt darüber und führt direkt in die Terminanfrage.
 */
export function LeistungsZeile({ l, nr }: { l: Leistung; nr: number }) {
  return (
    <li
      className={`relative isolate grid grid-cols-[1.75rem_minmax(0,1fr)_auto] gap-x-3 overflow-hidden rounded-lg bg-flaeche px-4 pt-4 transition-colors hover:bg-white/[0.06] md:items-center md:gap-x-6 md:px-6 md:pt-0 ${SPALTEN}`}
    >
      <Link href={`/leistungen/${l.slug}`} className="absolute inset-0 rounded-lg focus-visible:outline-offset-[-2px]">
        <span className="sr-only">{l.name}: Beschreibung</span>
      </Link>
      <span className={`zahlen pt-1 text-grau-hell md:pt-0 ${ETIKETT}`}>{String(nr).padStart(2, "0")}</span>
      <div className="col-span-2 md:col-span-1 md:py-6">
        {l.angebot ? <AngebotsChip angebot={l.angebot} className="mb-2" /> : null}
        <h3 className="text-[17px] font-semibold leading-snug">{l.name}</h3>
      </div>
      <p className="col-span-2 col-start-2 mt-1 line-clamp-2 text-sm text-grau md:col-span-1 md:col-start-auto md:mt-0 md:text-[15px]">{l.kurz || l.beschreibung}</p>
      <p className={`col-start-2 self-end pb-4 pt-3 text-grau md:col-start-auto md:self-center md:p-0 md:text-[15px] md:font-normal md:normal-case md:tracking-normal ${ETIKETT}`}>
        <span className="md:hidden">Dauer </span>
        <span className="text-tinte">{dauerText(l.dauer_min)}</span>
      </p>
      {l.online_anfragbar ? (
        <Link href={`/termin?leistung=${l.slug}`} className="knopf knopf-rot knopf-klein relative z-10 hidden w-fit md:inline-flex">
          Anfragen <Pfeil className="size-4" />
        </Link>
      ) : (
        <span className="hidden md:block" />
      )}
      <GrossPreis l={l} className="self-end" />
    </li>
  );
}

/** Laufende Angebote über den Reitern: eine Fläche je Leistung im Angebot, Preis noch größer. */
export function AngebotsStreifen({ leistungen }: { leistungen: Leistung[] }) {
  const imAngebot = leistungen.filter((l) => l.angebot);
  if (!imAngebot.length) return null;
  return (
    <ul className={`mt-8 grid gap-3 ${imAngebot.length > 1 ? "lg:grid-cols-2" : ""}`}>
      {imAngebot.map((l) => (
        <li key={l.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 overflow-hidden rounded-lg bg-flaeche px-5 pt-5 md:px-7 md:pt-6">
          <div className="pb-5 md:pb-6">
            {l.angebot ? <AngebotsChip angebot={l.angebot} /> : null}
            <h2 className="mt-3 text-lg font-semibold leading-snug">{l.name}</h2>
            <p className="mt-1 line-clamp-2 text-sm text-grau">{l.kurz || l.beschreibung}</p>
            <Link href={l.online_anfragbar ? `/termin?leistung=${l.slug}` : `/leistungen/${l.slug}`} className="knopf knopf-rot knopf-klein mt-5">
              {l.online_anfragbar ? "Anfragen" : "Mehr dazu"} <Pfeil className="size-4" />
            </Link>
          </div>
          <GrossPreis l={l} gross className="self-end" />
        </li>
      ))}
    </ul>
  );
}
