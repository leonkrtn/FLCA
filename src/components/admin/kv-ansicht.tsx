import Link from "next/link";
import { Formular, Senden } from "./formular";
import { PositionenUebersicht } from "./positionen-uebersicht";
import { Feld } from "./ui";
import type { Ort } from "@/lib/aktionen/belege";
import { kvAntwortAktion, kvInRechnungAktion, kvKopierenAktion, kvVersendenAktion } from "@/lib/aktionen/kostenvoranschlaege";
import { datum, datumZeit } from "@/lib/format";
import { kvAbgelaufen, type Kostenvoranschlag } from "@/lib/rechnung/kostenvoranschlaege";

/** Abgeschlossener Kostenvoranschlag: ansehen, senden, Antwort vermerken, in eine Rechnung übernehmen. */
export function KvAnsicht({ k, ort }: { k: Kostenvoranschlag; ort: Ort }) {
  const abgelaufen = kvAbgelaufen(k);
  const umwandelbar = k.status === "offen" || k.status === "angenommen";
  return (
    <div className="grid gap-6">
      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        <a href={`/admin/kostenvoranschlaege/${k.id}/pdf`} target="_blank" className="knopf knopf-dunkel">PDF öffnen</a>
        {k.rechnung_id ? (
          <Link href={`/${ort}/rechnungen/${k.rechnung_id}`} className="knopf knopf-rahmen">Zur Rechnung</Link>
        ) : umwandelbar ? (
          <form action={kvInRechnungAktion.bind(null, k.id, ort)} className="contents">
            <button className={`knopf ${k.status === "angenommen" ? "knopf-dunkel" : "knopf-rahmen"}`}>In Rechnung übernehmen</button>
          </form>
        ) : null}
        <a href={`/k/${k.token}`} target="_blank" className="knopf knopf-rahmen">Kundenansicht</a>
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

      <PositionenUebersicht positionen={k.positionen} />

      <dl className="grid gap-y-1 text-sm sm:grid-cols-[10rem_minmax(0,1fr)]">
        <dt className="text-grau">Empfänger</dt>
        <dd>{[k.empfaenger.firma, k.empfaenger.name].filter(Boolean).join(", ")}</dd>
        {k.fahrzeug?.kennzeichen ? (
          <>
            <dt className="text-grau">Fahrzeug</dt>
            <dd>{[k.fahrzeug.kennzeichen, k.fahrzeug.modell].filter(Boolean).join(", ")}</dd>
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
          <button className="knopf knopf-rahmen knopf-klein">Als neuen Entwurf kopieren</button>
        </form>
      </details>
    </div>
  );
}
