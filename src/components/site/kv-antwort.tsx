"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { kundeAntwortet } from "@/app/(site)/k/[token]/actions";
import { LEER } from "@/lib/forms";

/**
 * Annehmen mit Rückfrage, damit ein versehentlicher Tipp auf dem Handy nichts auslöst. Annehmen ist hier eine
 * Beauftragung im Fernabsatz: Knopf „zahlungspflichtig“ (§ 312j Abs. 3 BGB), AGB mit Link (§ 305 Abs. 2 BGB) und
 * das ausdrückliche Verlangen, vor Ablauf der Widerrufsfrist zu beginnen (§ 356 Abs. 4 BGB), wie beim
 * Werkstattauftrag über den Terminlink (auftrag-erteilen.tsx).
 */
export function KvAntwort({ token }: { token: string }) {
  const [frage, setFrage] = useState<"angenommen" | "abgelehnt" | null>(null);
  const [annahme, annehmen, laeuftA] = useActionState(kundeAntwortet.bind(null, token, "angenommen"), LEER);
  const [ablehnung, ablehnen, laeuftB] = useActionState(kundeAntwortet.bind(null, token, "abgelehnt"), LEER);
  const fertig = [annahme, ablehnung].find((z) => z.status === "ok");
  const fehler = [annahme, ablehnung].find((z) => z.status === "fehler");
  const laeuft = laeuftA || laeuftB;
  if (fertig) return <p className="w-full text-lg font-semibold" role="status">{fertig.meldung}</p>;
  return (
    <div className="grid w-full gap-3">
      {frage === "angenommen" ? (
        <form action={annehmen} className="grid max-w-xl gap-4">
          <p className="font-semibold">Kostenvoranschlag annehmen und Auftrag erteilen</p>
          <label className="flex cursor-pointer items-start gap-3">
            <input type="checkbox" name="einverstanden" required className="mt-1 size-5 shrink-0 accent-tinte" />
            <span>
              Ich beauftrage die Arbeiten zu den Preisen dieses Kostenvoranschlags. Es gelten die{" "}
              <Link href="/agb" target="_blank" className="underline">
                Allgemeinen Geschäftsbedingungen
              </Link>
              .
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-3">
            <input type="checkbox" name="vorab" required className="mt-1 size-5 shrink-0 accent-tinte" />
            <span>
              Ich verlange ausdrücklich, dass Sie vor Ablauf der Widerrufsfrist mit den Arbeiten beginnen. Mir ist bekannt, dass mein Widerrufsrecht erlischt, sobald der Auftrag vollständig ausgeführt ist, und dass ich bei einem Widerruf die bis dahin erbrachten Arbeiten anteilig bezahle (
              <Link href="/widerruf" target="_blank" className="underline">
                Widerrufsbelehrung
              </Link>
              ).
            </span>
          </label>
          <div className="knopfreihe knopfreihe-frei">
            <button type="submit" disabled={laeuft} className="knopf knopf-rot">
              {laeuftA ? "Wird gesendet …" : "Zahlungspflichtig beauftragen"}
            </button>
            <button type="button" onClick={() => setFrage(null)} className="knopf knopf-rahmen">
              Zurück
            </button>
          </div>
        </form>
      ) : frage === "abgelehnt" ? (
        <form action={ablehnen} className="flex flex-wrap items-center gap-3">
          <span className="w-full font-semibold sm:w-auto">Kostenvoranschlag ablehnen?</span>
          <button type="submit" disabled={laeuft} className="knopf knopf-rot">
            {laeuftB ? "Wird gesendet …" : "Ja, ablehnen"}
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
