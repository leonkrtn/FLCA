"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { belegAnlegen, type BelegArt, type Ort } from "@/lib/aktionen/belege";
import type { KundenTreffer } from "@/lib/kunden";
import { KundenSuche } from "./kunden-suche";

/**
 * Erster Schritt einer neuen Rechnung bzw. eines Kostenvoranschlags: Kunde wählen, dann öffnet sich der
 * Entwurf mit Empfänger und Fahrzeug. „Ohne Kunde“ für Laufkundschaft, die nicht in der Kartei steht.
 */
export function BelegStart({ art, ort, zuletzt }: { art: BelegArt; ort: Ort; zuletzt: KundenTreffer[] }) {
  const [laeuft, starten] = useTransition();
  const [fehler, setFehler] = useState("");
  const anlegen = (kundeId: string | null, fahrzeugId: string | null) =>
    starten(async () => {
      setFehler("");
      try {
        await belegAnlegen(art, ort, kundeId, fahrzeugId);
      } catch (e) {
        // Die Weiterleitung nach dem Anlegen kommt als Ausnahme an und muss durch.
        if (e instanceof Error && e.message === "NEXT_REDIRECT") throw e;
        setFehler(e instanceof Error ? e.message : "Das hat nicht geklappt.");
      }
    });

  return (
    <div className="grid min-w-0 grid-cols-1 gap-4">
      <KundenSuche zuletzt={zuletzt} autoFocus={ort === "admin"} gesperrt={laeuft} onWahl={(w) => anlegen(w.kunde.id, w.fahrzeug?.id ?? null)} />
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" disabled={laeuft} onClick={() => anlegen(null, null)} className="knopf knopf-rahmen">
          Ohne Kunde weiter
        </button>
        <Link href={ort === "app" ? "/app/kunden/neu" : "/admin/kunden?neu=1"} className="text-sm text-grau underline">
          Neuen Kunden anlegen
        </Link>
        {laeuft ? <span className="text-sm text-grau" role="status">{art === "rechnung" ? "Rechnung" : "Kostenvoranschlag"} wird angelegt …</span> : null}
      </div>
      {fehler ? <p className="text-sm font-semibold text-rot">{fehler}</p> : null}
    </div>
  );
}
