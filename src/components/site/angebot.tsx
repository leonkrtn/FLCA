import Image from "next/image";
import Link from "next/link";
import { Pfeil } from "@/components/icons";
import { countdownKnapp, rabattText, type Angebot, type AngebotsPreis } from "@/lib/angebote/preise";
import { absaetze, datum, preis, tagMonat } from "@/lib/format";
import { websiteDatei } from "@/lib/supabase/admin";
import type { Leistung } from "@/lib/termine";

/**
 * Angebote auf der Website. Kein Rot: Der Hinweis nimmt den Akzent der Website (gedämpftes Hellgrau mit
 * dunkler Schrift, Token „rot“ ist dort umgestellt), der alte Preis steht durchgestrichen davor.
 */

/**
 * „Angebot · bis 30.11.“ als Chip. Name und Art des Angebots stehen nicht darin: nebeneinander lasen sie sich
 * wie ein Wort („Radwechsel-Angebot Aktionspreis“), und was es kostet, zeigt der Preis daneben.
 */
export function AngebotsChip({ angebot, className = "" }: { angebot: Pick<AngebotsPreis, "bis">; className?: string }) {
  return (
    <span className={`zahlen inline-flex w-fit items-center whitespace-nowrap rounded-md bg-rot px-2 py-1 text-[11px] font-semibold uppercase leading-none tracking-[0.12em] text-auf-rot ${className}`}>
      Angebot{angebot.bis ? ` · bis ${tagMonat(angebot.bis)}` : ""}
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

/** Die große Zahl einer Angebotskarte: „−20 %“, „−10 €“ oder beim Festpreis der Preis selbst. */
function grosseZahl(a: Pick<Angebot, "art" | "wert">): string {
  return a.art === "festpreis" ? preis(a.wert) : rabattText(a);
}

/**
 * Laufende Angebote auf der Startseite als flache Streifen (eines allein über die volle Breite, mehrere
 * nebeneinander): oben der Titel, darunter Leistungen, Text und Weg zur Anfrage, rechts daneben groß der Rabatt. Ein
 * eigenes Bild liegt abgedunkelt im Hintergrund, ohne Bild trägt die Zahl den Streifen. Der Countdown erscheint erst kurz vor Ende (`countdownKnapp`), vorher genügt das Enddatum. Führt
 * zur Terminanfrage, wenn das Angebot genau eine buchbare Leistung trifft, sonst zu den Preisen.
 */
export function AngebotsHinweise({ angebote, leistungen, heute }: { angebote: Angebot[]; leistungen: Leistung[]; heute: string }) {
  const sichtbar = angebote
    .map((a) => ({ a, getroffen: leistungen.filter((l) => l.angebot?.id === a.id) }))
    // Nur, was auf der Website gerade wirkt: Ein Angebot, das keine sichtbare Leistung (mehr) trifft, bleibt weg.
    .filter((x) => x.getroffen.length);
  if (!sichtbar.length) return null;

  return (
    <section aria-label="Angebote" className={`rand grid gap-4 pt-16 md:pt-24 ${sichtbar.length > 1 ? "lg:grid-cols-2" : ""}`}>
      {sichtbar.map(({ a, getroffen }) => {
        const bild = websiteDatei(a.bild_pfad);
        const countdown = countdownKnapp(a.bis, heute);
        const buchbar = getroffen.filter((l) => l.online_anfragbar);
        const ziel = buchbar.length === 1 ? { href: `/termin?leistung=${buchbar[0].slug}`, text: `${buchbar[0].name} anfragen` } : { href: "/#preise", text: "Zu den Preisen" };
        return (
          <article key={a.id} className="relative isolate flex flex-col overflow-hidden rounded-lg bg-flaeche ring-1 ring-linie">
            {/* Das Bild liegt hinter dem Text: als eigener Streifen darüber machte es die Karte doppelt so hoch */}
            {bild ? (
              <>
                <Image src={bild} alt="" fill sizes="(min-width: 1024px) 50vw, 100vw" className="-z-10 object-cover" />
                <div className="absolute inset-0 -z-10 bg-gradient-to-r from-black/90 via-black/75 to-black/55" />
              </>
            ) : null}
            <div className="flex flex-1 flex-col p-6 md:p-8">
              <p className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm uppercase tracking-[0.16em] text-grau">
                Angebot
                {countdown ? <span className="zahlen rounded-md bg-rot px-2 py-0.5 font-semibold normal-case tracking-normal text-auf-rot">{countdown}</span> : null}
              </p>
              {/* Titel über die volle Breite: neben der großen Zahl bräche „Reifensaison“ mitten im Wort um */}
              <h2 className="schmal hyphens-auto text-4xl md:text-5xl">{a.titel}</h2>
              <div className="mt-auto flex flex-col gap-6 pt-4 sm:flex-row sm:items-end sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm text-grau">
                    {getroffen.map((l) => l.name).join(", ")}
                    {a.bis ? <span className="zahlen"> · bis {datum(a.bis)}</span> : null}
                  </p>
                  {a.kurztext ? (
                    <div className="mt-4 max-w-prose text-tinte/85">
                      {absaetze(a.kurztext).map((x) => (
                        <p key={x.slice(0, 24)}>{x}</p>
                      ))}
                    </div>
                  ) : null}
                  <Link href={ziel.href} className="mt-6 inline-flex w-fit items-center gap-2 rounded-md px-4 py-2.5 text-sm font-semibold ring-1 ring-linie hover:bg-white/[0.06]">
                    {ziel.text} <Pfeil className="size-4" />
                  </Link>
                  {a.bedingungen ? <p className="mt-5 max-w-prose text-xs text-grau">{a.bedingungen}</p> : null}
                </div>
                {/* Auf dem Telefon direkt unter dem Titel, ab sm unten rechts */}
                <p className="order-first shrink-0 sm:order-none sm:text-right">
                  {a.art === "festpreis" ? <span className="block text-sm uppercase tracking-[0.16em] text-grau">Festpreis</span> : null}
                  <span className="schmal zahlen block whitespace-nowrap text-7xl leading-[0.85] md:text-8xl">
                    <span className="sr-only">{a.art === "festpreis" ? "" : "Rabatt "}</span>
                    {grosseZahl(a)}
                  </span>
                </p>
              </div>
            </div>
          </article>
        );
      })}
    </section>
  );
}
