import Link from "next/link";
import { Formular, Senden } from "@/components/admin/formular";
import { Kopf, Leer, Marke } from "@/components/admin/ui";
import { angebotSchalten } from "@/lib/aktionen/angebote";
import { alleAngebote } from "@/lib/angebote/daten";
import { type Angebot, countdownText, laeuft, laufzeitText, rabattText } from "@/lib/angebote/preise";
import { benutzerMitRecht } from "@/lib/auth";
import { preis } from "@/lib/format";
import { KATEGORIEN } from "@/lib/inhalte";
import { berlinDatum } from "@/lib/zeit";

export const metadata = { title: "Angebote" };

const geltung = (a: Angebot) =>
  [...a.kategorien.map((k) => KATEGORIEN[k] ?? k), a.leistung_ids.length ? `${a.leistung_ids.length} ${a.leistung_ids.length === 1 ? "Position" : "Positionen"} einzeln` : ""].filter(Boolean).join(", ");

/**
 * Angebote: zeitlich begrenzte Preise auf die Preisliste. Gruppiert nach dem, was gerade wirkt, damit auf
 * einen Blick klar ist, welche Preise Website und Belege heute nehmen.
 */
export default async function AngeboteSeite() {
  await benutzerMitRecht("angebote");
  const { angebote, unmigriert } = await alleAngebote();
  const heute = berlinDatum();

  const gruppen = [
    { titel: "Läuft jetzt", hinweis: "wirkt auf Website, Terminanfragen und neue Belege", eintraege: angebote.filter((a) => laeuft(a, heute)) },
    { titel: "Geplant", hinweis: "startet von selbst", eintraege: angebote.filter((a) => a.aktiv && a.von > heute) },
    { titel: "Aus oder abgelaufen", hinweis: "wirkt nicht", eintraege: angebote.filter((a) => !a.aktiv || (a.bis !== null && a.bis < heute)) },
  ].filter((g) => g.eintraege.length);

  return (
    <>
      <Kopf titel="Angebote" unter="Zeitlich begrenzte Preise, z. B. Reifensaison −20 %. Die Preisliste bleibt unverändert, der Angebotspreis gilt nur in der Laufzeit.">
        <Link href="/admin/angebote/neu" className="knopf knopf-dunkel">
          Neues Angebot
        </Link>
      </Kopf>

      {unmigriert ? (
        <p className="mb-6 border-l-2 border-rot bg-weiss px-4 py-3">
          Die Datenbank ist noch nicht auf dem neuen Stand. Bitte im Supabase SQL-Editor <span className="font-semibold">supabase/migrations/20261122120000_angebote.sql</span> ausführen.
        </p>
      ) : null}

      {gruppen.length ? (
        gruppen.map((g) => (
          <section key={g.titel} className="mb-8 bg-weiss">
            <div className="flex h-12 items-center justify-between gap-4 border-b border-linie px-4 md:px-6">
              <h2 className="truncate font-semibold">
                {g.titel} <span className="font-normal tabular-nums text-grau">{g.eintraege.length}</span>
              </h2>
              <span className="hidden truncate text-sm text-grau sm:block">{g.hinweis}</span>
            </div>
            <ul className="divide-y divide-linie">
              {g.eintraege.map((a) => {
                const rest = laeuft(a, heute) ? countdownText(a.bis, heute) : null;
                return (
                  <li key={a.id} className="flex min-h-16 items-center gap-4 px-4 py-3 md:px-6">
                    <Link href={`/admin/angebote/${a.id}`} className={`min-w-0 flex-1 hover:underline ${a.aktiv ? "" : "text-grau"}`}>
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="truncate font-semibold">{a.titel}</span>
                        <Marke ton={a.aktiv ? "dunkel" : "hell"}>
                          <span className="tabular-nums">{a.art === "festpreis" ? `Festpreis ${preis(a.wert)}` : rabattText(a)}</span>
                        </Marke>
                        {!a.aktiv ? <Marke ton="hell">aus</Marke> : null}
                      </span>
                      <span className="block truncate text-sm text-grau">
                        <span className="tabular-nums">{laufzeitText(a)}</span>
                        {rest ? <span className="tabular-nums"> · {rest}</span> : null} · {geltung(a)}
                      </span>
                    </Link>
                    <Formular aktion={angebotSchalten.bind(null, a.id, !a.aktiv)} className="shrink-0 text-right">
                      <Senden art="rahmen" klein vorab={a.aktiv ? "Aus" : "An"}>
                        {a.aktiv ? "Ausschalten" : "Einschalten"}
                      </Senden>
                    </Formular>
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      ) : (
        <div className="bg-weiss">
          <Leer>Noch keine Angebote. Legen Sie das erste an, z. B. Reifensaison −20 % auf alles unter Reifen.</Leer>
        </div>
      )}
    </>
  );
}
