"use client";

import { useEffect, useId, useRef, useState } from "react";
import { kundenSuchenAktion } from "@/lib/aktionen/belege";
import type { KundenFahrzeug, KundenTreffer } from "@/lib/kunden";

export type KundenWahl = { kunde: KundenTreffer; fahrzeug: KundenFahrzeug | null };

/**
 * Fahrzeug direkt klar, ohne zweiten Schritt? Kein Auto, genau ein Auto, oder die Suche nach einem
 * Kennzeichen hat genau eines getroffen. Sonst (mehrere Autos) wählt man es im zweiten Schritt.
 */
function eindeutig(k: KundenTreffer): { fahrzeug: KundenFahrzeug | null } | null {
  if (!k.fahrzeuge.length) return { fahrzeug: null };
  if (k.fahrzeuge.length === 1) return { fahrzeug: k.fahrzeuge[0] };
  if (k.passend?.length === 1) return { fahrzeug: k.fahrzeuge.find((f) => f.id === k.passend![0]) ?? null };
  return null;
}

/** Zweiter Schritt: getroffene Kennzeichen zuerst, dann die übrigen Autos, zuletzt „ohne Fahrzeug“. */
function fahrzeugZeilen(k: KundenTreffer): (KundenFahrzeug | null)[] {
  const passt = (f: KundenFahrzeug) => (k.passend?.includes(f.id) ? 0 : 1);
  return [...[...k.fahrzeuge].sort((a, b) => passt(a) - passt(b)), null];
}

/**
 * Kundensuche für neue Belege und den Editor. Sucht beim Tippen (Name, Firma, Telefon, E-Mail,
 * Kennzeichen, Kundennummer), ohne Eingabe stehen die zuletzt bearbeiteten Kunden da. Jeder Kunde steht
 * einmal in der Liste; hat er mehrere Autos, wählt man im zweiten Schritt das Fahrzeug. Mit Pfeiltasten,
 * Enter und Escape bedienbar, auf dem Handy reicht ein Tipp auf die Zeile.
 */
export function KundenSuche({
  zuletzt,
  onWahl,
  autoFocus = false,
  gesperrt = false,
  onFahrzeugwahl,
}: {
  zuletzt: KundenTreffer[];
  onWahl: (w: KundenWahl) => void;
  autoFocus?: boolean;
  gesperrt?: boolean;
  /** Meldet, ob gerade der zweite Schritt (Fahrzeug wählen) offen ist, etwa um Knöpfe daneben auszublenden. */
  onFahrzeugwahl?: (offen: boolean) => void;
}) {
  const [q, setQ] = useState("");
  const [ergebnis, setErgebnis] = useState<{ fuer: string; treffer: KundenTreffer[]; fehler?: boolean } | null>(null);
  const [aktiv, setAktiv] = useState(0);
  // Zweiter Schritt: Kunde mit mehreren Autos ist gewählt, jetzt das Fahrzeug
  const [kunde, setKundeZustand] = useState<KundenTreffer | null>(null);
  const setKunde = (k: KundenTreffer | null) => {
    setKundeZustand(k);
    onFahrzeugwahl?.(Boolean(k));
  };
  const zweiterSchritt = useRef<HTMLDivElement>(null);
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

  const liste = treffer ?? zuletzt;
  const waehlen = (k: KundenTreffer | undefined) => {
    if (!k || gesperrt) return;
    const klar = eindeutig(k);
    if (klar) return onWahl({ kunde: k, fahrzeug: klar.fahrzeug });
    setKunde(k);
    setAktiv(0);
  };
  // Im zweiten Schritt springt der Fokus auf das erste Auto, damit Tastatur und VoiceOver mitkommen.
  useEffect(() => {
    if (kunde) zweiterSchritt.current?.querySelector<HTMLButtonElement>("button[data-fahrzeug]")?.focus({ preventScroll: true });
  }, [kunde]);

  if (kunde) {
    const autos = fahrzeugZeilen(kunde);
    return (
      <div
        ref={zweiterSchritt}
        className="grid min-w-0 grid-cols-1 gap-2"
        onKeyDown={(e) => {
          const knoepfe = [...e.currentTarget.querySelectorAll<HTMLButtonElement>("button[data-fahrzeug]")];
          const i = knoepfe.indexOf(document.activeElement as HTMLButtonElement);
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            knoepfe[Math.max(0, Math.min(knoepfe.length - 1, i + (e.key === "ArrowDown" ? 1 : -1)))]?.focus();
          } else if (e.key === "Escape") {
            e.preventDefault();
            setKunde(null);
          }
        }}
      >
        <button type="button" onClick={() => setKunde(null)} className="justify-self-start text-sm text-grau underline">
          ← anderen Kunden wählen
        </button>
        <p className="min-w-0">
          <span className="block truncate font-semibold">
            {kunde.name}
            {kunde.firma ? <span className="font-normal text-grau"> · {kunde.firma}</span> : null}
          </span>
          <span className="block text-xs text-grau">Welches Fahrzeug?</span>
        </p>
        {/* Kennzeichen sind verschieden breit. Über Subgrid teilen sich alle Zeilen eine Spalte, so breit
            wie das längste Kennzeichen: Die Schilder sind gleich groß und die Modelle stehen bündig. */}
        <ul role="list" aria-label={`Fahrzeuge von ${kunde.name}`} className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 divide-y divide-linie border-y border-linie">
          {autos.map((f) => (
            <li key={f?.id ?? "ohne"} className="col-span-2 grid grid-cols-subgrid">
              <button
                type="button"
                data-fahrzeug
                disabled={gesperrt}
                onClick={() => !gesperrt && onWahl({ kunde, fahrzeug: f })}
                className="col-span-2 grid min-h-14 grid-cols-subgrid items-center px-2 py-2 text-left focus:bg-papier disabled:opacity-60 active:bg-papier"
              >
                {f ? (
                  <>
                    <span className="zahlen rounded-sm border border-linie px-2 py-0.5 text-center text-sm font-semibold">{f.kennzeichen}</span>
                    <span className="min-w-0">
                      <span className="block truncate">{f.marke_modell || "Modell nicht eingetragen"}</span>
                      {f.km_stand ? <span className="zahlen block text-sm text-grau">{f.km_stand.toLocaleString("de-DE")} km</span> : null}
                    </span>
                  </>
                ) : (
                  <span className="col-span-2 text-grau">Ohne Fahrzeug weiter</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
  }

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
        {liste.map((k, i) => {
          const klar = eindeutig(k);
          return (
            <li key={k.id} id={`${listeId}-${i}`} role="option" aria-selected={i === aktiv}>
              <button
                type="button"
                disabled={gesperrt}
                onClick={() => waehlen(k)}
                onMouseEnter={() => setAktiv(i)}
                className={`flex min-h-14 w-full items-center gap-3 px-2 py-2 text-left disabled:opacity-60 ${i === aktiv ? "bg-papier" : ""} active:bg-papier`}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">
                    {k.name}
                    {k.firma ? <span className="font-normal text-grau"> · {k.firma}</span> : null}
                  </span>
                  <span className="block truncate text-sm text-grau">
                    {[klar ? klar.fahrzeug?.marke_modell : k.fahrzeuge.map((f) => f.kennzeichen).join(", "), k.ort, k.telefon].filter(Boolean).join(" · ") || `Kunde Nr. ${k.nummer}`}
                  </span>
                </span>
                {klar?.fahrzeug ? (
                  <span className="zahlen shrink-0 rounded-sm border border-linie px-2 py-0.5 text-sm font-semibold">{klar.fahrzeug.kennzeichen}</span>
                ) : !klar ? (
                  <span className="zahlen shrink-0 rounded-sm bg-boden px-2 py-0.5 text-sm font-semibold">{k.fahrzeuge.length} Fahrzeuge ›</span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
