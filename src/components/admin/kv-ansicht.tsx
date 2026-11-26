import Link from "next/link";
import { Absenden, Formular, Senden } from "./formular";
import { DateiKnopf } from "@/components/mobil/datei-knopf";
import { PositionenUebersicht } from "./positionen-uebersicht";
import { Auswahl, Feld } from "./ui";
import type { Ort } from "@/lib/aktionen/belege";
import { kvTerminLoesenAktion, terminAmKvVerknuepfen } from "@/lib/aktionen/auftrag";
import { kvAntwortAktion, kvKopierenAktion, kvVersendenAktion, kvZumAuftragAktion } from "@/lib/aktionen/kostenvoranschlaege";
import { datum, datumKurzText, datumZeit, zeit } from "@/lib/format";
import { kvAbgelaufen, type Kostenvoranschlag } from "@/lib/rechnung/kostenvoranschlaege";
import { fahrzeugText } from "@/lib/rechnung/aehnlich";

type TerminKurz = { id: string; nummer: number; beginn: string | null; leistung_name: string; status: string; auftrag_nummer?: string | null };

/**
 * Abgeschlossener Kostenvoranschlag: ansehen, senden, Zusage oder Absage vermerken, mit einem Termin verknüpfen.
 * Sagt der Kunde zu, wird er zum erteilten Werkstattauftrag (am Termin oder ohne Termin), und ab da läuft alles
 * über den Auftrag: Mehrarbeit, Einplanen, Rechnung. Der Kostenvoranschlag bleibt, wie der Kunde ihn bekommen hat.
 */
export function KvAnsicht({ k, ort, termin, termine }: { k: Kostenvoranschlag; ort: Ort; termin: TerminKurz | null; termine: TerminKurz[] }) {
  const abgelaufen = kvAbgelaufen(k);
  const auftrag = termin?.auftrag_nummer ? termin : null;
  const wartet = termin?.status === "ungeplant";
  // Termin gelöscht, KV war verschickt: nur noch zum Nachschlagen, ohne Kundenlink und ohne Aktionen.
  if (k.archiviert_am) {
    return (
      <div className="grid gap-6">
        <p className="text-sm text-grau">Im Archiv seit {datum(k.archiviert_am)}: Der Termin dazu wurde gelöscht. Der Kostenvoranschlag bleibt als Geschäftsbrief erhalten, der Kundenlink ist abgeschaltet.</p>
        <div className="knopfreihe knopfreihe-frei">
          <DateiKnopf art="datei" href={`/admin/kostenvoranschlaege/${k.id}/pdf`} className="knopf knopf-dunkel">PDF öffnen</DateiKnopf>
        </div>
        <PositionenUebersicht positionen={k.positionen} />
      </div>
    );
  }
  return (
    <div className="grid gap-6">
      <div className="knopfreihe knopfreihe-frei">
        {auftrag ? (
          <Link href={`/${ort}/termine/${auftrag.id}`} className="knopf knopf-dunkel">Zum Auftrag {auftrag.auftrag_nummer}</Link>
        ) : null}
        <DateiKnopf art="datei" href={`/admin/kostenvoranschlaege/${k.id}/pdf`} className={`knopf ${auftrag ? "knopf-rahmen" : "knopf-dunkel"}`}>PDF öffnen</DateiKnopf>
        {/* Rechnungen aus der Zeit, als ein KV direkt zur Rechnung wurde */}
        {k.rechnung_id ? <Link href={`/${ort}/rechnungen/${k.rechnung_id}`} className="knopf knopf-rahmen">Zur Rechnung</Link> : null}
        <DateiKnopf art="link" href={`/k/${k.token}`} className="knopf knopf-rahmen">{ort === "app" ? "Kundenlink teilen" : "Kundenansicht"}</DateiKnopf>
      </div>

      {k.status === "offen" ? (
        <div className="grid gap-2">
          <p className="text-sm text-grau">
            {abgelaufen ? `Abgelaufen am ${datum(k.gueltig_bis)}. ` : "Der Kunde kann über seinen Link annehmen. "}Hat er angerufen oder in der Werkstatt zugesagt?
          </p>
          <div className="knopfreihe knopfreihe-frei">
            <Formular aktion={kvZumAuftragAktion.bind(null, k.id, ort)} className="grid">
              <Senden art="dunkel" vorab="Wird zum Auftrag">Zugesagt: zum Auftrag machen</Senden>
            </Formular>
            <Formular aktion={kvAntwortAktion.bind(null, k.id)} className="grid">
              <Senden art="rahmen" name="antwort" value="abgelehnt" vorab="Abgelehnt">Kunde hat abgesagt</Senden>
            </Formular>
          </div>
          <p className="text-sm text-grau">
            {termin ? "Der Auftrag entsteht am verknüpften Termin." : "Ohne Termin wartet der Auftrag, bis ihr ihn einplant oder der Kunde über seinen Link eine Zeit wählt."}
          </p>
        </div>
      ) : null}

      {k.status === "angenommen" && !auftrag ? (
        // Vor der Umstellung angenommen, oder der Auftrag ließ sich gerade nicht anlegen (steht im Fehlerprotokoll)
        <Formular aktion={kvZumAuftragAktion.bind(null, k.id, ort)} className="grid gap-2">
          <p className="text-sm font-semibold text-warnung">Angenommen, aber noch ohne Werkstattauftrag.</p>
          <Senden art="dunkel" vorab="Wird zum Auftrag">Zum Auftrag machen</Senden>
        </Formular>
      ) : null}

      <section className="grid gap-2">
        <h2 className="font-semibold">Termin</h2>
        {termin && wartet ? (
          <div className="grid gap-2">
            <p>Der Auftrag {termin.auftrag_nummer} wartet auf seinen Termin.</p>
            <div className="knopfreihe knopfreihe-frei">
              <Link href={`/${ort}/termine/${termin.id}`} className="knopf knopf-rahmen">Einplanen</Link>
            </div>
          </div>
        ) : termin ? (
          <div className="flex flex-wrap items-center gap-3">
            <Link href={`/${ort}/termine/${termin.id}`} className="font-semibold hover:underline">
              {termin.beginn ? `${datumKurzText(termin.beginn)} ${zeit(termin.beginn)}` : "Abgesagt"} · {termin.leistung_name}
            </Link>
            {/* Mit Auftrag aus diesem KV bleibt die Verknüpfung: Sie ist seine Herkunft. */}
            {auftrag && k.status === "angenommen" ? null : (
              <form action={kvTerminLoesenAktion.bind(null, k.id, termin.id)}>
                <Absenden className="text-xs text-grau underline hover:text-tinte">lösen</Absenden>
              </form>
            )}
          </div>
        ) : (
          <>
            <p className="text-sm text-grau">
              {k.status === "angenommen"
                ? "Angenommen, aber noch ohne Termin. Trag einen ein, oder mach ihn oben zum Auftrag ohne Termin."
                : "Noch ohne Termin. Gehört er zu einer Anfrage oder einem Termin, hier verknüpfen: Bei der Zusage entsteht der Auftrag dann dort."}
            </p>
            <div className="knopfreihe knopfreihe-frei">
              <Link href={`${ort === "app" ? "/app/neu" : "/admin/termine/neu"}?kv=${k.id}`} className="knopf knopf-rahmen">
                Termin eintragen
              </Link>
            </div>
            {termine.length ? (
              <Formular aktion={terminAmKvVerknuepfen.bind(null, k.id)} className="grid max-w-md gap-2">
                <Auswahl
                  label="Oder vorhandenen Termin verknüpfen"
                  name="termin"
                  leer="bitte wählen"
                  optionen={termine.filter((t) => t.beginn).map((t) => [t.id, `${datumKurzText(t.beginn!)} ${zeit(t.beginn!)} · ${t.leistung_name}${t.status === "angefragt" ? " (Anfrage)" : ""}`])}
                />
                <Senden art="rahmen" klein vorab="Verknüpft">Verknüpfen</Senden>
              </Formular>
            ) : null}
          </>
        )}
      </section>

      <PositionenUebersicht positionen={k.positionen} />

      <dl className="grid gap-y-1 text-sm sm:grid-cols-[10rem_minmax(0,1fr)]">
        <dt className="text-grau">Empfänger</dt>
        <dd>{[k.empfaenger.firma, k.empfaenger.name].filter(Boolean).join(", ")}</dd>
        {k.fahrzeug?.kennzeichen ? (
          <>
            <dt className="text-grau">Fahrzeug</dt>
            <dd>{[k.fahrzeug.kennzeichen, fahrzeugText(k.fahrzeug)].filter(Boolean).join(", ")}</dd>
          </>
        ) : null}
        <dt className="text-grau">Datum</dt>
        <dd>{datum(k.datum)}</dd>
        <dt className="text-grau">Gültig bis</dt>
        <dd className={abgelaufen ? "font-semibold text-rot" : ""}>{datum(k.gueltig_bis)}</dd>
        <dt className="text-grau">Versendet</dt>
        <dd>{k.gesendet_am ? `${datumZeit(k.gesendet_am)} an ${k.gesendet_an}` : "noch nicht"}</dd>
        {k.beantwortet_am ? (
          <>
            <dt className="text-grau">{k.status === "angenommen" ? "Angenommen" : "Abgelehnt"}</dt>
            <dd>{datumZeit(k.beantwortet_am)}</dd>
          </>
        ) : null}
      </dl>

      {k.status === "offen" ? (
        <Formular aktion={kvVersendenAktion.bind(null, k.id)} className="grid max-w-md gap-2">
          <Feld label="Per E-Mail senden an" name="an" typ="email" wert={k.gesendet_an ?? k.empfaenger.email ?? ""} />
          <Senden art="rahmen" vorab="Wird gesendet">{k.gesendet_am ? "Erneut senden" : "Senden"}</Senden>
        </Formular>
      ) : null}

      <details className="text-sm">
        <summary className="cursor-pointer text-grau">Ändern …</summary>
        <form action={kvKopierenAktion.bind(null, k.id, ort)} className="mt-3">
          <p className="mb-3 max-w-md">Ein abgeschlossener Kostenvoranschlag bleibt so, wie der Kunde ihn bekommen hat. Für eine Änderung entsteht ein neuer Entwurf mit demselben Inhalt.</p>
          <Senden art="rahmen" klein>Als neuen Entwurf kopieren</Senden>
        </form>
      </details>
    </div>
  );
}
