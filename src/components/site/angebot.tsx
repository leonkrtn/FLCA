import Image from "next/image";
import Link from "next/link";
import { Pfeil } from "@/components/icons";
import { countdownText, rabattText, type Angebot, type AngebotsPreis } from "@/lib/angebote/preise";
import { absaetze, datum, preis } from "@/lib/format";
import { websiteDatei } from "@/lib/supabase/admin";
import type { Leistung } from "@/lib/termine";

/**
 * Angebote auf der Website. Kein Rot: Der Hinweis nimmt den Akzent der Website (gedämpftes Hellgrau mit
 * dunkler Schrift, Token „rot“ ist dort umgestellt), der alte Preis steht durchgestrichen davor.
 */

/** „Reifensaison −20 %“ als Chip. */
export function AngebotsChip({ angebot, className = "" }: { angebot: Pick<AngebotsPreis, "titel" | "rabatt">; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-md bg-rot px-2.5 py-1 text-xs font-semibold text-auf-rot ${className}`}>
      {angebot.titel}
      <span className="zahlen">{angebot.rabatt}</span>
    </span>
  );
}

/** Preis mit Angebot: alter Preis durchgestrichen, dann der geltende. Ohne Angebot nur der Preis. */
export function AngebotsPreisText({ l, className = "" }: { l: Pick<Leistung, "preis_cent" | "preis_ab" | "angebot">; className?: string }) {
  const alt = l.angebot?.listen_cent;
  if (alt == null || l.preis_cent === null || alt === l.preis_cent) return <span className={className}>{preis(l.preis_cent, l.preis_ab)}</span>;
  return (
    <span className={className}>
      <span className="sr-only">statt </span>
      <s className="mr-1.5 opacity-60">{preis(alt, l.preis_ab)}</s>
      <span className="sr-only">jetzt </span>
      {preis(l.preis_cent, l.preis_ab)}
    </span>
  );
}

/** Die verschiedenen Angebote einer Liste von Leistungen, jedes einmal. */
export function angeboteIn(leistungen: Pick<Leistung, "angebot">[]): AngebotsPreis[] {
  return [...new Map(leistungen.flatMap((l) => (l.angebot ? [[l.angebot.id, l.angebot] as const] : []))).values()];
}

/**
 * Laufende Angebote auf der Startseite: Titel, Text, Bild, Rabatt, Countdown und Bedingungen. Führt zur
 * Terminanfrage, wenn das Angebot genau eine buchbare Leistung trifft, sonst zu den Preisen.
 */
export function AngebotsHinweise({ angebote, leistungen, heute }: { angebote: Angebot[]; leistungen: Leistung[]; heute: string }) {
  const sichtbar = angebote
    .map((a) => ({ a, getroffen: leistungen.filter((l) => l.angebot?.id === a.id) }))
    // Nur, was auf der Website gerade wirkt: Ein Angebot, das keine sichtbare Leistung (mehr) trifft, bleibt weg.
    .filter((x) => x.getroffen.length);
  if (!sichtbar.length) return null;

  return (
    <section aria-label="Angebote" className="rand grid gap-4 pt-16 md:pt-24">
      {sichtbar.map(({ a, getroffen }) => {
        const bild = websiteDatei(a.bild_pfad);
        const countdown = countdownText(a.bis, heute);
        const buchbar = getroffen.filter((l) => l.online_anfragbar);
        const ziel = buchbar.length === 1 ? { href: `/termin?leistung=${buchbar[0].slug}`, text: `${buchbar[0].name} anfragen` } : { href: "/#preise", text: "Zu den Preisen" };
        return (
          <article key={a.id} className="grid overflow-hidden rounded-lg bg-flaeche ring-1 ring-linie md:grid-cols-12">
            {bild ? (
              <div className="relative aspect-[16/9] md:col-span-5 md:aspect-auto md:min-h-72">
                <Image src={bild} alt="" fill sizes="(min-width: 768px) 40vw, 100vw" className="object-cover" />
              </div>
            ) : null}
            <div className={`flex flex-col justify-center p-6 md:p-10 ${bild ? "md:col-span-7" : "md:col-span-12"}`}>
              <p className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm uppercase tracking-[0.16em] text-grau">
                Angebot
                {countdown ? <span className="zahlen normal-case tracking-normal text-tinte">{countdown}</span> : null}
              </p>
              <h2 className="schmal text-4xl md:text-6xl">{a.titel}</h2>
              <p className="mt-4 flex flex-wrap items-center gap-3">
                <span className="zahlen rounded-md bg-rot px-3 py-1.5 text-lg font-semibold text-auf-rot">{a.art === "festpreis" ? `Festpreis ${preis(a.wert)}` : rabattText(a)}</span>
                <span className="text-sm text-grau">
                  {getroffen.map((l) => l.name).join(", ")}
                  {a.bis ? <span className="zahlen"> · bis {datum(a.bis)}</span> : null}
                </span>
              </p>
              {a.kurztext ? (
                <div className="mt-5 max-w-prose text-lg text-tinte/85">
                  {absaetze(a.kurztext).map((x) => (
                    <p key={x.slice(0, 24)}>{x}</p>
                  ))}
                </div>
              ) : null}
              <Link href={ziel.href} className="mt-7 inline-flex w-fit items-center gap-2 rounded-md px-5 py-3 font-semibold ring-1 ring-linie hover:bg-white/[0.06]">
                {ziel.text} <Pfeil className="size-4" />
              </Link>
              {a.bedingungen ? <p className="mt-6 max-w-prose text-xs text-grau">{a.bedingungen}</p> : null}
            </div>
          </article>
        );
      })}
    </section>
  );
}
