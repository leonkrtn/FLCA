"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { nummernkreisSpeichern } from "@/lib/aktionen/einstellungen";
import { LEER } from "@/lib/forms";
import { eingabeFehler, gleich, type Nummernkreis, nummerText, warnungen } from "@/lib/rechnung/nummernkreis";

/**
 * Nummernkreis der Rechnungen: wo die nächste Rechnung weiterzählt. Eigenes Formular, weil eine Änderung
 * erst nach einer Bestätigung im Dialog gespeichert wird, der die Folgen nennt (Lücke, Rückschritt,
 * neues Format). Der Server verlangt diese Bestätigung ebenfalls (`bestaetigt`). Die Seite gibt einen
 * `key` aus den gespeicherten Werten mit, damit die Felder nach dem Speichern neu starten.
 */
export function NummernkreisFormular({ aktuell, gestellt, letzte, jahr }: { aktuell: Nummernkreis; gestellt: number; letzte: string | null; jahr: number }) {
  const [zustand, ausfuehren] = useActionState(nummernkreisSpeichern, LEER);
  const [laeuft, starten] = useTransition();
  const [k, setK] = useState(aktuell);
  const dialog = useRef<HTMLDialogElement>(null);
  const form = useRef<HTMLFormElement>(null);

  const geaendert = !gleich(aktuell, k);
  const fehler = eingabeFehler(k);
  const zahlFeld = (v: string) => (v.trim() === "" ? NaN : Number(v.replace(/\D/g, "")));

  function absenden(bestaetigt: boolean) {
    if (!form.current) return;
    const fd = new FormData(form.current);
    if (bestaetigt) fd.set("bestaetigt", "1");
    dialog.current?.close();
    starten(() => ausfuehren(fd));
  }

  return (
    <form
      ref={form}
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (fehler || !geaendert) return;
        dialog.current?.showModal();
      }}
    >
      <p className="text-sm">
        Nächste Rechnungsnummer: <span className="zahlen font-semibold">{nummerText(aktuell, jahr)}</span>
        {letzte ? <span className="text-grau"> · zuletzt vergeben: <span className="zahlen">{letzte}</span></span> : <span className="text-grau"> · noch keine Rechnung gestellt</span>}
      </p>
      <div className="grid gap-4 sm:grid-cols-4">
        <label className="block">
          <span className="label">Präfix</span>
          <input name="praefix" value={k.praefix} maxLength={10} onChange={(e) => setK({ ...k, praefix: e.target.value })} className="feld" />
        </label>
        <label className="block">
          <span className="label">Nächste Nummer</span>
          <input name="naechste" inputMode="numeric" value={Number.isNaN(k.naechste) ? "" : k.naechste} onChange={(e) => setK({ ...k, naechste: zahlFeld(e.target.value) })} className="feld zahlen" aria-invalid={Boolean(fehler) || undefined} />
          <span className="mt-1 block text-sm text-grau">Hier zählt die nächste Rechnung weiter.</span>
        </label>
        <label className="block">
          <span className="label">Stellen</span>
          <input name="stellen" inputMode="numeric" value={Number.isNaN(k.stellen) ? "" : k.stellen} onChange={(e) => setK({ ...k, stellen: zahlFeld(e.target.value) })} className="feld zahlen" />
        </label>
        <label className="flex cursor-pointer items-start gap-3 self-end pb-3">
          <input type="checkbox" name="mit_jahr" checked={k.mit_jahr} onChange={(e) => setK({ ...k, mit_jahr: e.target.checked })} className="mt-0.5 size-5 shrink-0 accent-tinte" />
          <span className="font-semibold">Jahr in der Nummer</span>
        </label>
      </div>
      {geaendert && !fehler ? <p className="text-sm">So sieht die nächste Nummer aus: <span className="zahlen font-semibold">{nummerText(k, jahr)}</span></p> : null}
      {fehler && geaendert ? <p className="text-sm font-semibold text-rot">{fehler}</p> : null}
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={!geaendert || Boolean(fehler) || laeuft} className={`knopf knopf-dunkel ${laeuft ? "cursor-progress opacity-60" : ""} disabled:opacity-60`}>
          Nummernkreis ändern
        </button>
        {geaendert ? <button type="button" onClick={() => setK(aktuell)} className="text-sm text-grau underline">zurücksetzen</button> : null}
      </div>
      {!laeuft && zustand.meldung ? (
        <p role="status" className={`text-sm font-semibold ${zustand.status === "fehler" ? "text-rot" : "text-ok"}`}>{zustand.meldung}</p>
      ) : null}

      <dialog
        ref={dialog}
        aria-labelledby="nummernkreis-titel"
        className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-lg bg-flaeche p-0 text-tinte shadow-xl backdrop:bg-tinte/40"
      >
        <div className="grid gap-4 p-5">
          <h2 id="nummernkreis-titel" className="text-lg font-semibold">{gestellt ? "Nummernkreis wirklich ändern?" : "Nummernkreis festlegen?"}</h2>
          {gestellt ? (
            <p className="rounded-md border border-rot/40 bg-rot/5 p-3 text-sm">
              Es sind schon <span className="zahlen">{gestellt}</span> Rechnungen gestellt. Rechnungsnummern müssen fortlaufend und eindeutig sein.
              Ändern Sie den Nummernkreis nur, wenn Sie wissen warum, zum Beispiel weil Rechnungen eine Zeit lang woanders geschrieben wurden.
            </p>
          ) : null}
          <ul className="list-disc space-y-2 pl-5 text-sm">
            {warnungen(aktuell, k, gestellt, jahr).map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
          <div className="flex flex-wrap justify-end gap-3 pt-2">
            <button type="button" onClick={() => dialog.current?.close()} className="knopf knopf-rahmen">Abbrechen</button>
            <button type="button" onClick={() => absenden(true)} className={`knopf ${gestellt ? "knopf-rot" : "knopf-dunkel"}`}>{gestellt ? "Ja, ändern" : "Festlegen"}</button>
          </div>
        </div>
      </dialog>
    </form>
  );
}
