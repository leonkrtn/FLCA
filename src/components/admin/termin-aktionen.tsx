"use client";

import { useState } from "react";
import type { Ergebnis } from "@/lib/forms";
import { Formular, Senden } from "./formular";

type A = (v: Ergebnis, fd: FormData) => Promise<Ergebnis>;

/** Die Entscheidungen zu einem Termin. Admin und Handy-App nutzen dieselbe Komponente. */
export function TerminAktionen({
  status,
  datum,
  uhrzeit,
  aktionen,
  gross = false,
}: {
  status: string;
  datum: string;
  uhrzeit: string;
  aktionen: { bestaetigen: A; ablehnen: A; absagen: A; verschieben: A; erledigt: A };
  gross?: boolean;
}) {
  const [offen, setOffen] = useState<"" | "ablehnen" | "absagen" | "verschieben">("");
  const breit = gross ? "w-full" : "";

  if (status === "angefragt") {
    return (
      <div className="grid gap-3">
        <Formular aktion={aktionen.bestaetigen} className="grid gap-2">
          <Senden art="dunkel" className={breit} vorab="Angenommen">
            Annehmen
          </Senden>
          <label className="flex items-center gap-2 text-sm text-grau">
            <input type="checkbox" name="ueberbuchen" className="size-4 accent-tinte" /> auch annehmen, wenn die Werkstatt zu der Zeit voll ist
          </label>
        </Formular>
        {offen === "ablehnen" ? (
          <Formular aktion={aktionen.ablehnen} className="grid gap-2">
            <label className="label" htmlFor="grund">Nachricht an den Kunden (optional)</label>
            <textarea id="grund" name="grund" rows={2} className="feld" placeholder="z. B. Am Freitag geht es ab 14 Uhr, rufen Sie gern an." />
            <Senden art="rahmen" className={breit} vorab="Abgelehnt">Ablehnen und Kunden informieren</Senden>
          </Formular>
        ) : (
          <button type="button" onClick={() => setOffen("ablehnen")} className={`knopf knopf-rahmen ${breit}`}>
            Ablehnen …
          </button>
        )}
      </div>
    );
  }

  if (status !== "bestaetigt") return null;
  return (
    <div className="grid gap-3">
      <Formular aktion={aktionen.erledigt} className={`grid gap-2 ${gross ? "" : "sm:grid-cols-2"}`}>
        <Senden art="dunkel" name="art" value="erledigt" className={breit} vorab="Erledigt">Erledigt</Senden>
        <Senden art="rahmen" name="art" value="nicht_erschienen" className={breit} vorab="Vermerkt">Nicht erschienen</Senden>
      </Formular>
      {offen === "verschieben" ? (
        <Formular aktion={aktionen.verschieben} className="grid grid-cols-2 gap-2">
          <input type="date" name="datum" defaultValue={datum} className="feld" aria-label="Neues Datum" />
          <input type="time" name="uhrzeit" defaultValue={uhrzeit} step={900} className="feld" aria-label="Neue Uhrzeit" />
          <label className="col-span-2 flex items-center gap-2 text-sm text-grau">
            <input type="checkbox" name="ueberbuchen" className="size-4 accent-tinte" /> auch wenn die Werkstatt voll ist
          </label>
          <Senden art="dunkel" className="col-span-2" vorab="Verschoben">Verschieben, Kunde bekommt Mail</Senden>
        </Formular>
      ) : null}
      {offen === "absagen" ? (
        <Formular aktion={aktionen.absagen} className="grid gap-2" bestaetigen="Termin wirklich absagen? Der Kunde bekommt eine Mail.">
          <textarea name="grund" rows={2} className="feld" placeholder="Grund (nur intern)" aria-label="Grund" />
          <Senden art="rahmen" vorab="Abgesagt">Termin absagen</Senden>
        </Formular>
      ) : null}
      {!offen ? (
        <div className={`grid gap-2 ${gross ? "grid-cols-2" : "sm:grid-cols-2"}`}>
          <button type="button" onClick={() => setOffen("verschieben")} className="knopf knopf-rahmen">Verschieben …</button>
          <button type="button" onClick={() => setOffen("absagen")} className="knopf knopf-rahmen">Absagen …</button>
        </div>
      ) : (
        <button type="button" onClick={() => setOffen("")} className="text-sm text-grau underline">abbrechen</button>
      )}
    </div>
  );
}
