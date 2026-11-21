"use client";

import { useState, useTransition } from "react";
import { KundenSuche } from "./kunden-suche";
import type { Ergebnis } from "@/lib/forms";
import type { KundenTreffer } from "@/lib/kunden";

/**
 * Bestehenden Termin an einen anderen (oder überhaupt einen) Kunden aus der Kartei hängen. Gespeichert wird
 * sofort beim Wählen; Mails gehen dafür keine raus.
 */
export function TerminKundeAendern({
  hatKunde,
  zuletzt,
  aktion,
}: {
  hatKunde: boolean;
  zuletzt: KundenTreffer[];
  aktion: (kundeId: string, fahrzeugId: string | null) => Promise<Ergebnis>;
}) {
  const [offen, setOffen] = useState(false);
  const [laeuft, starten] = useTransition();
  const [ergebnis, setErgebnis] = useState<Ergebnis | null>(null);

  return (
    <div className="mt-4 grid gap-2">
      <button type="button" onClick={() => setOffen((o) => !o)} aria-expanded={offen} className="knopf knopf-rahmen knopf-klein justify-self-start">
        {offen ? "Suche schließen" : hatKunde ? "Anderen Kunden verknüpfen" : "Kunde aus der Kartei verknüpfen"}
      </button>
      {offen ? (
        <div className="rounded-md border border-linie p-3">
          <KundenSuche
            zuletzt={zuletzt}
            autoFocus
            gesperrt={laeuft}
            onWahl={(w) =>
              starten(async () => {
                const e = await aktion(w.kunde.id, w.fahrzeug?.id ?? null);
                setErgebnis(e);
                if (e.status === "ok") setOffen(false);
              })
            }
          />
        </div>
      ) : null}
      {ergebnis?.meldung && !laeuft ? (
        <p role="status" className={`text-sm font-semibold ${ergebnis.status === "fehler" ? "text-rot" : "text-ok"}`}>
          {ergebnis.meldung}
        </p>
      ) : null}
    </div>
  );
}
