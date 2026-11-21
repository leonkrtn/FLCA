"use client";

import { useId, useState } from "react";
import { markeNorm } from "@/lib/rechnung/aehnlich";

export type Typen = { marken: string[]; modelle: { marke: string; modell: string }[] };

/**
 * Zwei Felder Marke und Modell mit Vorschlägen aus der Kartei. Die Modellvorschläge passen zur gewählten
 * Marke („VW“ bietet Golf, Passat …), so bleibt die Schreibweise gleich und gemerkte Preise greifen.
 *
 * Ohne `onChange` ein normales Formularfeld (name="marke"/"modell"), mit `onChange` gesteuert (Beleg-Editor).
 */
export function MarkeModell({
  typen,
  marke: markeStart = "",
  modell: modellStart = "",
  onChange,
  onFertig,
  className = "",
}: {
  typen: Typen;
  marke?: string;
  modell?: string;
  onChange?: (w: { marke: string; modell: string }) => void;
  /** Feld verlassen: der Editor lädt dann die gemerkten Preise für dieses Auto */
  onFertig?: () => void;
  className?: string;
}) {
  const id = useId();
  const [eigen, setEigen] = useState({ marke: markeStart, modell: modellStart });
  const w = onChange ? { marke: markeStart, modell: modellStart } : eigen;
  const setzen = (neu: { marke: string; modell: string }) => (onChange ? onChange(neu) : setEigen(neu));
  const norm = markeNorm(w.marke);
  const modelle = norm ? [...new Set(typen.modelle.filter((m) => markeNorm(m.marke) === norm).map((m) => m.modell))] : [];

  return (
    <div className={`grid grid-cols-2 gap-3 ${className}`}>
      <label className="block min-w-0">
        <span className="label">Marke</span>
        <input
          name={onChange ? undefined : "marke"}
          value={w.marke}
          onChange={(e) => setzen({ ...w, marke: e.target.value })}
          onBlur={onFertig}
          list={`${id}-marken`}
          autoComplete="off"
          placeholder="VW"
          className="feld"
        />
      </label>
      <label className="block min-w-0">
        <span className="label">Modell</span>
        <input
          name={onChange ? undefined : "modell"}
          value={w.modell}
          onChange={(e) => setzen({ ...w, modell: e.target.value })}
          onBlur={onFertig}
          list={`${id}-modelle`}
          autoComplete="off"
          placeholder="Golf"
          className="feld"
        />
      </label>
      <datalist id={`${id}-marken`}>
        {typen.marken.map((m) => (
          <option key={m} value={m} />
        ))}
      </datalist>
      <datalist id={`${id}-modelle`}>
        {modelle.map((m) => (
          <option key={m} value={m} />
        ))}
      </datalist>
    </div>
  );
}
