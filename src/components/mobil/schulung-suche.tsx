"use client";

import Link from "next/link";
import { useState } from "react";
import { dauerText, suchen } from "@/lib/schulung/inhalt";

export type SuchLektion = {
  id: string;
  kategorie_id: string;
  titel: string;
  kurz: string;
  inhalt: string;
  schlagwoerter: string[];
  werkzeug: string;
  dauer_min: number | null;
  video: boolean;
};

/**
 * Schulung in der Team-App: Suchfeld oben, darunter die Kategorien mit ihren Lektionen. Gesucht wird sofort
 * beim Tippen, im Handy selbst (es sind wenige Lektionen, der Text ist schon da).
 */
export function SchulungSuche({ kategorien, lektionen }: { kategorien: { id: string; name: string }[]; lektionen: SuchLektion[] }) {
  const [frage, setFrage] = useState("");
  const treffer = frage.trim() ? suchen(lektionen, frage) : null;
  return (
    <>
      <div className="px-4 pb-1 pt-3">
        <input
          type="search"
          value={frage}
          onChange={(e) => setFrage(e.target.value)}
          placeholder="Suchen, z. B. Stempeln oder Reifen"
          aria-label="Schulung durchsuchen"
          enterKeyHint="search"
          className="feld"
        />
      </div>
      {treffer ? (
        <div className="grid gap-2 p-2">
          {treffer.length ? (
            treffer.map((l) => <Eintrag key={l.id} l={l} kategorie={kategorien.find((k) => k.id === l.kategorie_id)?.name} />)
          ) : (
            <p className="px-2 py-6 text-center text-grau">Nichts gefunden zu „{frage.trim()}“.</p>
          )}
        </div>
      ) : (
        <div className="grid gap-6 p-2 pb-6">
          {kategorien.map((k) => {
            const hier = lektionen.filter((l) => l.kategorie_id === k.id);
            return hier.length ? (
              <section key={k.id} className="grid gap-2">
                <h2 className="px-2 pt-2 font-semibold">{k.name}</h2>
                {hier.map((l) => (
                  <Eintrag key={l.id} l={l} />
                ))}
              </section>
            ) : null;
          })}
          {!lektionen.length ? <p className="px-2 py-6 text-center text-grau">Noch keine Lektionen. Die Werkstatt stellt sie nach und nach ein.</p> : null}
        </div>
      )}
    </>
  );
}

function Eintrag({ l, kategorie }: { l: SuchLektion; kategorie?: string }) {
  const unter = [kategorie, l.video ? "Video" : "", dauerText(l.dauer_min)].filter(Boolean).join(" · ");
  return (
    <Link href={`/team/schulung/${l.id}`} className="karte block bg-weiss px-4 py-3 active:bg-papier">
      <p className="font-semibold">{l.titel}</p>
      {l.kurz ? <p className="line-clamp-2 text-sm text-grau">{l.kurz}</p> : null}
      {unter ? <p className="zahlen mt-1 text-xs text-grau">{unter}</p> : null}
    </Link>
  );
}
