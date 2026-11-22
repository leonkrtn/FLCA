"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Senden } from "@/components/admin/formular";
import { Schalter } from "@/components/admin/ui";
import { altbestandUebernehmen } from "@/lib/aktionen/altbestand";
import { LEER } from "@/lib/forms";

/**
 * Hochladen der CSV-Dateien aus den alten Rechnungen. Eigenes Formular statt `Formular`, weil nach der
 * Übernahme die Hinweise (doppelte Kennzeichen, Positionen ohne Rechnung) als Liste darunter stehen sollen.
 * Der Probelauf ist vorab an: Beim ersten Mal sieht man, was passieren würde, bevor etwas gespeichert wird.
 */
export function Datenuebernahme() {
  const [zustand, ausfuehren] = useActionState(altbestandUebernehmen, LEER);
  const hinweise = Array.isArray(zustand.daten?.hinweise) ? (zustand.daten.hinweise as string[]) : [];
  return (
    <form action={ausfuehren} className="grid max-w-2xl gap-5">
      <label className="grid gap-1">
        <span className="label">CSV-Dateien</span>
        <input type="file" name="dateien" accept=".csv,text/csv" multiple required className="feld min-h-12 py-2 file:mr-3 file:rounded-md file:border-0 file:bg-flaeche file:px-3 file:py-1.5 file:text-sm file:font-semibold" />
        <span className="text-sm text-grau">kunden.csv, rechnungen.csv und positionen.csv zusammen auswählen. Die Art erkennt das System an den Spalten, der Dateiname ist egal.</span>
      </label>
      <Schalter label="Nur Probelauf" name="probelauf" an hilfe="Prüft und zählt, speichert aber nichts. Zum Übernehmen ausschalten und noch einmal einlesen." />
      <div><Senden>Einlesen</Senden></div>
      <Rueckmeldung meldung={zustand.meldung} fehler={zustand.status === "fehler"} hinweise={hinweise} />
    </form>
  );
}

function Rueckmeldung({ meldung, fehler, hinweise }: { meldung?: string; fehler: boolean; hinweise: string[] }) {
  const { pending } = useFormStatus();
  if (pending) return <p className="text-sm text-grau">Wird eingelesen …</p>;
  if (!meldung) return null;
  return (
    <div role="status" className="grid gap-2">
      <p className={`text-sm font-semibold ${fehler ? "text-rot" : "text-ok"}`}>{meldung}</p>
      {hinweise.length ? (
        <ul className="list-disc space-y-1 pl-5 text-sm">
          {hinweise.map((h, i) => (
            <li key={i}>{h}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
