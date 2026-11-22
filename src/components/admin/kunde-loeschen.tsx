"use client";

import { useActionState, useRef } from "react";
import { useFormStatus } from "react-dom";
import { kundeLoeschen } from "@/lib/aktionen/kunden";
import { LEER } from "@/lib/forms";

export type LoeschFolgen = {
  fahrzeuge: number;
  fruehere: number;
  rechnungen: number;
  termine: number;
  notizen: number;
  /** Was das Löschen verhindert (kommender Termin, eingelagerte Räder); leer = löschbar */
  hindernisse: string[];
};

/**
 * Knopf „Löschen“ in der Kundenakte mit Bestätigung im Dialog, der sagt, was mitgelöscht wird und was
 * bleibt. Hindert etwas, ist der Löschknopf aus und der Grund steht da; die Datenbank prüft dasselbe.
 */
export function KundeLoeschen({ kundeId, name, folgen }: { kundeId: string; name: string; folgen: LoeschFolgen }) {
  const [zustand, ausfuehren] = useActionState(kundeLoeschen.bind(null, kundeId), LEER);
  const dialog = useRef<HTMLDialogElement>(null);
  const anzahl = (n: number, eins: string, mehr: string) => `${n} ${n === 1 ? eins : mehr}`;
  const weg = [
    folgen.fahrzeuge ? anzahl(folgen.fahrzeuge, "Fahrzeug", "Fahrzeuge") : "",
    folgen.fruehere ? anzahl(folgen.fruehere, "frühere Rechnung aus der Datenübernahme", "frühere Rechnungen aus der Datenübernahme") : "",
  ].filter(Boolean);
  const bleibt = [
    folgen.rechnungen ? `${anzahl(folgen.rechnungen, "Rechnung oder Kostenvoranschlag", "Rechnungen und Kostenvoranschläge")} mit der Anschrift auf dem Beleg (Aufbewahrungspflicht)` : "",
    folgen.termine ? anzahl(folgen.termine, "vergangener Termin", "vergangene Termine") : "",
    folgen.notizen ? anzahl(folgen.notizen, "Notiz", "Notizen") : "",
  ].filter(Boolean);

  return (
    <>
      <button type="button" onClick={() => dialog.current?.showModal()} className="knopf knopf-rahmen knopf-klein">Löschen</button>
      <dialog ref={dialog} aria-labelledby="kunde-loeschen-titel" className="m-auto w-[calc(100%-2rem)] max-w-md rounded-lg bg-flaeche p-0 text-tinte shadow-xl backdrop:bg-tinte/40">
        <form action={ausfuehren} className="grid gap-4 p-5">
          <h2 id="kunde-loeschen-titel" className="text-lg font-semibold">{name} löschen?</h2>
          {folgen.hindernisse.length ? (
            <div className="rounded-md border border-rot/40 bg-rot/5 p-3 text-sm">
              <p className="font-semibold">Geht gerade nicht:</p>
              <ul className="mt-1 list-disc pl-5">
                {folgen.hindernisse.map((h) => <li key={h}>{h}</li>)}
              </ul>
            </div>
          ) : (
            <p className="rounded-md border border-rot/40 bg-rot/5 p-3 text-sm">Das lässt sich nicht rückgängig machen.</p>
          )}
          <div className="grid gap-3 text-sm">
            <p><span className="font-semibold">Wird gelöscht:</span> Stammdaten{weg.length ? `, ${weg.join(", ")}` : ""}.</p>
            {bleibt.length ? <p><span className="font-semibold">Bleibt, nur ohne Verknüpfung zum Kunden:</span> {bleibt.join(", ")}.</p> : null}
          </div>
          {zustand.status === "fehler" && zustand.meldung ? <p role="status" className="text-sm font-semibold text-rot">{zustand.meldung}</p> : null}
          <div className="flex flex-wrap justify-end gap-3 pt-2">
            <button type="button" onClick={() => dialog.current?.close()} className="knopf knopf-rahmen">Abbrechen</button>
            <Loeschknopf aus={folgen.hindernisse.length > 0} />
          </div>
        </form>
      </dialog>
    </>
  );
}

function Loeschknopf({ aus }: { aus: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={aus || pending} className={`knopf knopf-rot disabled:opacity-50 ${pending ? "cursor-progress" : ""}`}>
      {pending ? "Wird gelöscht …" : "Endgültig löschen"}
    </button>
  );
}
