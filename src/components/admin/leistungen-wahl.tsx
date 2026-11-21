"use client";

import { useState } from "react";

const dauerText = (min: number) => (min >= 60 ? `${Math.floor(min / 60)} Std.${min % 60 ? ` ${min % 60} Min.` : ""}` : `${min} Min.`);

/**
 * Leistungen für einen Termin, beliebig viele. Jede gewählte Leistung geht als eigenes Feld „leistung“ mit,
 * die Server Action liest sie mit getAll. Die Dauer rechnet sich aus der Summe; nur wer zusätzlich etwas frei
 * einträgt oder es anders weiß, gibt sie von Hand an.
 */
export function LeistungenWahl({ leistungen, kompakt = false }: { leistungen: { id: string; name: string; dauer_min: number }[]; kompakt?: boolean }) {
  const [gewaehlt, setGewaehlt] = useState<string[]>([]);
  const summe = leistungen.filter((l) => gewaehlt.includes(l.id)).reduce((s, l) => s + l.dauer_min, 0);

  return (
    <>
      <fieldset className={kompakt ? "" : "sm:col-span-2"}>
        <legend className="label">
          Leistungen <span className="font-normal text-grau">(eine oder mehrere)</span>
        </legend>
        <div className={`grid gap-1.5 ${kompakt ? "" : "sm:grid-cols-2 lg:grid-cols-3"}`}>
          {leistungen.map((l) => {
            const an = gewaehlt.includes(l.id);
            return (
              <label
                key={l.id}
                className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-md border px-3 py-2 text-sm transition-colors ${
                  an ? "border-tinte bg-papier" : "border-linie bg-flaeche hover:border-grau-hell"
                }`}
              >
                <input
                  type="checkbox"
                  name="leistung"
                  value={l.id}
                  checked={an}
                  onChange={(e) => setGewaehlt((alt) => (e.target.checked ? [...alt, l.id] : alt.filter((x) => x !== l.id)))}
                  className="size-4 shrink-0 accent-tinte"
                />
                <span className="min-w-0 flex-1">{l.name}</span>
                <span className="zahlen shrink-0 text-grau">{dauerText(l.dauer_min)}</span>
              </label>
            );
          })}
        </div>
        <p className="mt-2 text-sm text-grau" aria-live="polite">
          {gewaehlt.length ? (
            <>
              {gewaehlt.length} {gewaehlt.length === 1 ? "Leistung" : "Leistungen"}, zusammen <span className="zahlen">{dauerText(summe)}</span>
            </>
          ) : (
            "Nichts gewählt: unten eintragen, was gemacht wird."
          )}
        </p>
      </fieldset>
      <label className="block">
        <span className="label">{gewaehlt.length ? "Dazu noch (optional)" : "Andere Leistung"}</span>
        <input name="leistung_frei" placeholder="z. B. Bremsen vorne" className="feld" maxLength={120} />
      </label>
      <label className="block">
        <span className="label">Dauer gesamt in Minuten</span>
        <input name="dauer" inputMode="numeric" placeholder={String(summe || 60)} className="feld" />
        <span className="mt-1 block text-sm text-grau">Leer lassen = {summe ? "Summe der Leistungen" : "60 Minuten"}</span>
      </label>
    </>
  );
}
