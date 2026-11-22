import Link from "next/link";
import { Absenden, Formular, Senden } from "./formular";
import { DateiKnopf } from "@/components/mobil/datei-knopf";
import { PositionenUebersicht } from "./positionen-uebersicht";
import { Auswahl, Feld } from "./ui";
import type { Ort } from "@/lib/aktionen/belege";
import { kvTerminLoesenAktion, terminAmKvVerknuepfen } from "@/lib/aktionen/auftrag";
import { kvAntwortAktion, kvInRechnungAktion, kvKopierenAktion, kvVersendenAktion } from "@/lib/aktionen/kostenvoranschlaege";
import { datum, datumKurzText, datumZeit, zeit } from "@/lib/format";
import { kvAbgelaufen, type Kostenvoranschlag } from "@/lib/rechnung/kostenvoranschlaege";
import { fahrzeugText } from "@/lib/rechnung/aehnlich";

type TerminKurz = { id: string; nummer: number; beginn: string; leistung_name: string; status: string };

/**
 * Abgeschlossener Kostenvoranschlag: ansehen, senden, Antwort vermerken, mit einem Termin verknüpfen (dann wird
 * er bei Annahme zum erteilten Werkstattauftrag) und in eine Rechnung übernehmen.
 */
export function KvAnsicht({ k, ort, termin, termine }: { k: Kostenvoranschlag; ort: Ort; termin: TerminKurz | null; termine: TerminKurz[] }) {
  const abgelaufen = kvAbgelaufen(k);
  const umwandelbar = k.status === "offen" || k.status === "angenommen";
  return (
    <div className="grid gap-6">
      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        <DateiKnopf art="datei" href={`/admin/kostenvoranschlaege/${k.id}/pdf`} className="knopf knopf-dunkel">PDF öffnen</DateiKnopf>
        {k.rechnung_id ? (
          <Link href={`/${ort}/rechnungen/${k.rechnung_id}`} className="knopf knopf-rahmen">Zur Rechnung</Link>
        ) : umwandelbar ? (
          <form action={kvInRechnungAktion.bind(null, k.id, ort)} className="contents">
            <Senden art={k.status === "angenommen" ? "dunkel" : "rahmen"}>In Rechnung übernehmen</Senden>
          </form>
        ) : null}
        <DateiKnopf art="link" href={`/k/${k.token}`} className="knopf knopf-rahmen">{ort === "app" ? "Kundenlink teilen" : "Kundenansicht"}</DateiKnopf>
      </div>

      {k.status === "offen" ? (
        <Formular aktion={kvAntwortAktion.bind(null, k.id)} className="grid gap-2">
          <p className="text-sm text-grau">
            {abgelaufen ? `Abgelaufen am ${datum(k.gueltig_bis)}. ` : "Der Kunde kann über seinen Link annehmen. "}Hat er angerufen oder in der Werkstatt zugesagt?
          </p>
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <Senden art="rahmen" name="antwort" value="angenommen" vorab="Angenommen">Kunde hat zugesagt</Senden>
            <Senden art="rahmen" name="antwort" value="abgelehnt" vorab="Abgelehnt">Kunde hat abgesagt</Senden>
          </div>
        </Formular>
      ) : null}

      <section className="grid gap-2">
        <h2 className="font-semibold">Termin</h2>
        {termin ? (
          <div className="flex flex-wrap items-center gap-3">
            <Link href={`/${ort}/termine/${termin.id}`} className="font-semibold hover:underline">
              Nr. {termin.nummer} · {datumKurzText(termin.beginn)} {zeit(termin.beginn)} · {termin.leistung_name}
            </Link>
            <form action={kvTerminLoesenAktion.bind(null, k.id, termin.id)}>
              <Absenden className="text-xs text-grau underline hover:text-tinte">lösen</Absenden>
            </form>
          </div>
        ) : (
          <>
            <p className="text-sm text-grau">
              {k.status === "angenommen"
                ? "Angenommen, aber noch ohne Termin. Der Kunde kann über seinen Link einen wählen, oder du trägst ihn ein."
                : "Noch ohne Termin. Mit Termin wird der Kostenvoranschlag bei Annahme zum erteilten Werkstattauftrag."}
            </p>
            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
              <Link href={`${ort === "app" ? "/app/neu" : "/admin/termine/neu"}?kv=${k.id}`} className={`knopf ${k.status === "angenommen" ? "knopf-dunkel" : "knopf-rahmen"}`}>
                Termin eintragen
              </Link>
            </div>
            {termine.length ? (
              <Formular aktion={terminAmKvVerknuepfen.bind(null, k.id)} className="grid max-w-md gap-2">
                <Auswahl
                  label="Oder vorhandenen Termin verknüpfen"
                  name="termin"
                  leer="bitte wählen"
                  optionen={termine.map((t) => [t.id, `Nr. ${t.nummer} · ${datumKurzText(t.beginn)} ${zeit(t.beginn)} · ${t.leistung_name}${t.status === "angefragt" ? " (Anfrage)" : ""}`])}
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
