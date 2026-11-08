"use client";

import { useState } from "react";

/** Vorher-nachher-Vergleich mit einem Schieberegler (Tastatur und Touch über ein echtes range-Feld). */
export function VorherNachher({ vorher, nachher, titel }: { vorher: string; nachher: string; titel: string }) {
  const [wert, setWert] = useState(50);
  return (
    <div className="relative aspect-[4/3] select-none overflow-hidden bg-graphit">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={nachher} alt={`${titel}, nachher`} className="absolute inset-0 size-full object-cover" loading="lazy" />
      <div className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - wert}% 0 0)` }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={vorher} alt={`${titel}, vorher`} className="absolute inset-0 size-full object-cover" loading="lazy" />
      </div>
      <div className="pointer-events-none absolute inset-y-0 w-0.5 bg-flaeche" style={{ left: `${wert}%` }} />
      <span className="absolute left-3 top-3 bg-black/70 px-2 py-1 text-xs font-semibold text-hell rounded-full">Vorher</span>
      <span className="absolute right-3 top-3 bg-black/70 px-2 py-1 text-xs font-semibold text-hell rounded-full">Nachher</span>
      <input
        type="range"
        min={0}
        max={100}
        value={wert}
        onChange={(e) => setWert(Number(e.target.value))}
        aria-label={`${titel}: Vergleich vorher und nachher`}
        className="absolute inset-0 size-full cursor-ew-resize opacity-0"
      />
    </div>
  );
}
