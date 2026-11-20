"use client";

import { useActionState, useState } from "react";
import { kundeAntwortet } from "@/app/(site)/k/[token]/actions";
import { LEER } from "@/lib/forms";

/** Annehmen mit Rückfrage, damit ein versehentlicher Tipp auf dem Handy nichts auslöst. */
export function KvAntwort({ token }: { token: string }) {
  const [frage, setFrage] = useState<"angenommen" | "abgelehnt" | null>(null);
  const [annahme, annehmen, laeuftA] = useActionState(kundeAntwortet.bind(null, token, "angenommen"), LEER);
  const [ablehnung, ablehnen, laeuftB] = useActionState(kundeAntwortet.bind(null, token, "abgelehnt"), LEER);
  const fertig = [annahme, ablehnung].find((z) => z.status === "ok");
  const fehler = [annahme, ablehnung].find((z) => z.status === "fehler");
  if (fertig) return <p className="w-full text-lg font-semibold" role="status">{fertig.meldung}</p>;
  return (
    <div className="grid w-full gap-3">
      {frage ? (
        <form action={frage === "angenommen" ? annehmen : ablehnen} className="flex flex-wrap items-center gap-3">
          <span className="w-full font-semibold sm:w-auto">{frage === "angenommen" ? "Kostenvoranschlag verbindlich annehmen?" : "Kostenvoranschlag ablehnen?"}</span>
          <button type="submit" disabled={laeuftA || laeuftB} className="knopf knopf-rot">
            {laeuftA || laeuftB ? "Wird gesendet …" : frage === "angenommen" ? "Ja, annehmen" : "Ja, ablehnen"}
          </button>
          <button type="button" onClick={() => setFrage(null)} className="knopf knopf-rahmen">
            Zurück
          </button>
        </form>
      ) : (
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={() => setFrage("angenommen")} className="knopf knopf-rot">
            Annehmen
          </button>
          <button type="button" onClick={() => setFrage("abgelehnt")} className="knopf knopf-rahmen">
            Ablehnen
          </button>
        </div>
      )}
      {fehler ? <p className="text-fehler">{fehler.meldung}</p> : null}
    </div>
  );
}
