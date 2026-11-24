import Link from "next/link";
import { Formular, Senden } from "@/components/admin/formular";
import { Abschnitt, Feld, Kopf, Leer, Marke } from "@/components/admin/ui";
import { eingabenGesehenAktion, geraetAnlegenAktion, geraetSperrenAktion, geschicktZuruecknehmenAktion } from "@/lib/aktionen/kundenbildschirm";
import { benutzerMitRecht } from "@/lib/auth";
import { ENV } from "@/lib/env";
import { datumZeit } from "@/lib/format";
import { eingabenLaden, geraeteLaden } from "@/lib/kundenbildschirm/daten";
import { darf } from "@/lib/rollen";
import { db } from "@/lib/supabase/admin";

export const metadata = { title: "Kundenbildschirm" };

const ART = { neu: "Neuer Kunde", geaendert: "Geändert", unterschrift: "Unterschrift" } as const;

/** Läuft der Bildschirm? Er fragt alle paar Sekunden nach und meldet sich höchstens einmal pro Minute. */
const laeuft = (zuletzt: string | null) => Boolean(zuletzt && Date.now() - new Date(zuletzt).getTime() < 3 * 60_000);

/**
 * Kundenbildschirm: Gerätelinks (nur Inhaber), Kundenmodus auf diesem Rechner starten, geschickten Auftrag
 * zurücknehmen und was Kunden am Bildschirm eingetragen haben.
 */
export default async function KundenbildschirmVerwaltung() {
  const b = await benutzerMitRecht("kunden");
  const verwalten = darf(b.rolle, "einstellungen");
  const [geraete, eingaben] = await Promise.all([geraeteLaden(), eingabenLaden()]);
  const geschickt = geraete.find((g) => g.termin_id);
  const { data: auftrag } = geschickt?.termin_id
    ? await db().from("termine").select("id, auftrag_nummer, kunde:kunden(name)").eq("id", geschickt.termin_id).maybeSingle()
    : { data: null };
  const kundeName = (auftrag?.kunde as unknown as { name: string } | null)?.name;
  const offen = eingaben.filter((e) => !e.gesehen_am).length;

  return (
    <>
      <Kopf
        titel="Kundenbildschirm"
        unter="Ein Rechner im Büro, zum Kunden gedreht: Kunden tragen ihre Daten selbst ein und unterschreiben den Werkstattauftrag."
      />

      <Abschnitt titel="Geräte">
        {geraete.length ? (
          <ul className="grid gap-4">
            {geraete.map((g) => {
              const link = `${ENV.siteUrl}/kundenbildschirm/${g.schluessel}`;
              return (
                <li key={g.id} className="grid gap-3 border-b border-linie pb-4 last:border-0 last:pb-0">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="flex items-center gap-2 font-semibold">
                      {g.name}
                      <Marke ton={laeuft(g.zuletzt_gesehen) ? "ok" : "hell"}>{laeuft(g.zuletzt_gesehen) ? "Läuft" : g.zuletzt_gesehen ? `Zuletzt ${datumZeit(g.zuletzt_gesehen)}` : "Noch nie geöffnet"}</Marke>
                    </span>
                    <Link href={`/kundenbildschirm/${g.schluessel}`} className="knopf knopf-dunkel">
                      Kundenmodus hier starten
                    </Link>
                  </div>
                  <label className="block">
                    <span className="label">Gerätelink (am Kundenrechner öffnen, am besten als Startseite im Vollbild)</span>
                    <input readOnly value={link} className="feld text-sm" />
                  </label>
                  {verwalten ? (
                    <Formular aktion={geraetSperrenAktion.bind(null, g.id)} bestaetigen="Gerätelink sperren? Der Bildschirm zeigt danach nur noch einen Hinweis.">
                      <Senden art="rahmen" klein vorab="Gesperrt">Sperren</Senden>
                    </Formular>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : (
          <Leer>Noch kein Kundenbildschirm eingerichtet.{verwalten ? "" : " Den Gerätelink legt der Inhaber hier an."}</Leer>
        )}
        {verwalten ? (
          <Formular aktion={geraetAnlegenAktion} zuruecksetzen className="mt-6 flex flex-wrap items-end gap-3 border-t border-linie pt-4">
            <Feld label="Neuer Gerätelink" name="name" placeholder="Kundenbildschirm Büro" className="min-w-64 flex-1" />
            <Senden art="rahmen" vorab="Angelegt">Anlegen</Senden>
          </Formular>
        ) : null}
        <p className="mt-4 text-sm text-grau">
          Der Link öffnet nur die Kundenansicht, ohne Anmeldung. „Beenden“ unten rechts führt hierher zurück; ist der Rechner in der Verwaltung angemeldet, bleibt er es.
        </p>
      </Abschnitt>

      {geschickt ? (
        <Abschnitt titel="Zum Unterschreiben geschickt">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p>
              {auftrag ? (
                <Link href={`/admin/termine/${auftrag.id}`} className="font-semibold hover:underline">
                  {auftrag.auftrag_nummer}
                </Link>
              ) : (
                "Auftrag"
              )}
              {kundeName ? ` · ${kundeName}` : ""}
              {geschickt.geschickt_am ? <span className="text-grau"> · {datumZeit(geschickt.geschickt_am)}</span> : null}
            </p>
            <Formular aktion={geschicktZuruecknehmenAktion}>
              <Senden art="rahmen" klein vorab="Zurückgenommen">Zurücknehmen</Senden>
            </Formular>
          </div>
        </Abschnitt>
      ) : null}

      <Abschnitt
        titel="Eingaben am Bildschirm"
        aktion={
          offen ? (
            <Formular aktion={eingabenGesehenAktion}>
              <Senden art="rahmen" klein vorab="Erledigt">Alle als gesehen markieren</Senden>
            </Formular>
          ) : null
        }
      >
        {eingaben.length ? (
          <ul className="divide-y divide-linie">
            {eingaben.map((e) => (
              <li key={e.id} className="grid gap-1 py-3 sm:grid-cols-[9rem_8rem_minmax(0,1fr)] sm:gap-4">
                <span className="zahlen text-sm text-grau">{datumZeit(e.erstellt_am)}</span>
                <span>
                  <Marke ton={e.gesehen_am ? "hell" : e.art === "neu" ? "rot" : "dunkel"}>{ART[e.art]}</Marke>
                </span>
                <span className="min-w-0 break-words">
                  {e.kunde_id ? (
                    <Link href={`/admin/kunden/${e.kunde_id}`} className={`hover:underline ${e.gesehen_am ? "" : "font-semibold"}`}>
                      {e.text}
                    </Link>
                  ) : (
                    e.text
                  )}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <Leer>Noch keine Eingaben.</Leer>
        )}
      </Abschnitt>
    </>
  );
}
