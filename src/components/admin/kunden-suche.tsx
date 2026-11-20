"use client";

import { useEffect, useId, useRef, useState } from "react";
import { kundenSuchenAktion } from "@/lib/aktionen/belege";
import type { KundenFahrzeug, KundenTreffer } from "@/lib/kunden";

export type KundenWahl = { kunde: KundenTreffer; fahrzeug: KundenFahrzeug | null };

/**
 * Eine Zeile je Fahrzeug: Ein Tipp wählt Kunde und Auto zugleich, ohne zweiten Schritt. Wurde nach einem
 * Kennzeichen gesucht, stehen nur die getroffenen Fahrzeuge da, nicht die übrigen Autos desselben Kunden.
 */
function zeilen(kunden: KundenTreffer[]): KundenWahl[] {
  return kunden.flatMap((kunde): KundenWahl[] => {
    const fahrzeuge = kunde.passend?.length ? kunde.fahrzeuge.filter((f) => kunde.passend!.includes(f.id)) : kunde.fahrzeuge;
    return fahrzeuge.length ? fahrzeuge.map((fahrzeug) => ({ kunde, fahrzeug })) : [{ kunde, fahrzeug: null }];
  });
}

/**
 * Kundensuche für neue Belege und den Editor. Sucht beim Tippen (Name, Firma, Telefon, E-Mail,
 * Kennzeichen, Kundennummer), ohne Eingabe stehen die zuletzt bearbeiteten Kunden da. Mit Pfeiltasten
 * und Enter bedienbar, auf dem Handy reicht ein Tipp auf die Zeile.
 */
export function KundenSuche({
  zuletzt,
  onWahl,
  autoFocus = false,
  gesperrt = false,
}: {
  zuletzt: KundenTreffer[];
  onWahl: (w: KundenWahl) => void;
  autoFocus?: boolean;
  gesperrt?: boolean;
}) {
  const [q, setQ] = useState("");
  const [ergebnis, setErgebnis] = useState<{ fuer: string; treffer: KundenTreffer[]; fehler?: boolean } | null>(null);
  const [aktiv, setAktiv] = useState(0);
  const lauf = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const listeId = useId();
  useEffect(() => () => clearTimeout(timer.current), []);

  // Gesucht wird kurz nach dem letzten Tastendruck. Nur die Antwort auf die letzte Eingabe zählt,
  // langsamere ältere Antworten fallen weg.
  const eingabe = (wert: string) => {
    setQ(wert);
    setAktiv(0);
    clearTimeout(timer.current);
    const such = wert.trim();
    const nr = ++lauf.current;
    if (!such) return;
    timer.current = setTimeout(async () => {
      try {
        const treffer = await kundenSuchenAktion(such);
        if (nr === lauf.current) setErgebnis({ fuer: such, treffer });
      } catch {
        if (nr === lauf.current) setErgebnis({ fuer: such, treffer: [], fehler: true });
      }
    }, 140);
  };
  const such = q.trim();
  const laedt = Boolean(such) && ergebnis?.fuer !== such;
  const treffer = such ? (ergebnis?.treffer ?? null) : null;

  const liste = zeilen(treffer ?? zuletzt);
  const waehlen = (w: KundenWahl | undefined) => {
    if (w && !gesperrt) onWahl(w);
  };

  // grid-cols-1 heißt minmax(0, 1fr): Lange, abgeschnittene Namen dürfen die Spalte nicht aufziehen.
  return (
    <div className="grid min-w-0 grid-cols-1 gap-2">
      <div className="relative">
        <input
          type="search"
          value={q}
          onChange={(e) => eingabe(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setAktiv((a) => Math.min(a + 1, liste.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setAktiv((a) => Math.max(a - 1, 0));
            } else if (e.key === "Enter") {
              e.preventDefault();
              waehlen(liste[aktiv]);
            }
          }}
          // Auf dem Handy springt sonst die Tastatur bei jedem Öffnen auf; dort tippt man ohnehin zuerst.
          autoFocus={autoFocus}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="search"
          placeholder="Name, Kennzeichen, Telefon …"
          aria-label="Kunde suchen"
          aria-controls={listeId}
          aria-activedescendant={liste.length ? `${listeId}-${aktiv}` : undefined}
          role="combobox"
          aria-expanded
          className="feld pr-20"
        />
        {laedt ? <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-grau">sucht …</span> : null}
      </div>
      <p className="text-xs text-grau" aria-live="polite">
        {!treffer ? (laedt ? "Sucht …" : "Zuletzt bearbeitet") : ergebnis?.fehler ? "Die Suche hat nicht geklappt. Bitte noch einmal tippen." : liste.length ? "Treffer" : laedt ? "Sucht …" : "Kein Kunde gefunden"}
      </p>
      <ul id={listeId} role="listbox" aria-label="Kunden" className="divide-y divide-linie border-y border-linie">
        {liste.map((w, i) => (
          <li key={`${w.kunde.id}-${w.fahrzeug?.id ?? "ohne"}`} id={`${listeId}-${i}`} role="option" aria-selected={i === aktiv}>
            <button
              type="button"
              disabled={gesperrt}
              onClick={() => waehlen(w)}
              onMouseEnter={() => setAktiv(i)}
              className={`flex min-h-14 w-full items-center gap-3 px-2 py-2 text-left disabled:opacity-60 ${i === aktiv ? "bg-papier" : ""} active:bg-papier`}
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">
                  {w.kunde.name}
                  {w.kunde.firma ? <span className="font-normal text-grau"> · {w.kunde.firma}</span> : null}
                </span>
                <span className="block truncate text-sm text-grau">
                  {[w.fahrzeug?.marke_modell, w.kunde.ort, w.kunde.telefon].filter(Boolean).join(" · ") || `Kunde Nr. ${w.kunde.nummer}`}
                </span>
              </span>
              {w.fahrzeug ? <span className="zahlen shrink-0 rounded-sm border border-linie px-2 py-0.5 text-sm font-semibold">{w.fahrzeug.kennzeichen}</span> : null}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
