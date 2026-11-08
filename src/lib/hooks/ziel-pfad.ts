"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";

/**
 * Pfad, der in der Navigation als aktiv gilt. Nach einem Klick ist es sofort das Ziel, nicht erst,
 * wenn die neue Seite vom Server da ist. Sonst bleibt der alte Punkt markiert, und es wirkt, als
 * hätte der Klick nichts getan. Ist die Navigation angekommen (oder kam ein anderer Wechsel dazwischen),
 * gilt wieder der echte Pfad, ganz ohne Effekt.
 */
export function useZielPfad() {
  const pfad = usePathname();
  const [klick, setKlick] = useState<{ ziel: string; von: string } | null>(null);
  const aktuell = klick && klick.von === pfad ? klick.ziel : pfad;
  const merken = (href: string, ev: React.MouseEvent) => {
    // Strg/Cmd/Umschalt öffnen einen neuen Tab, hier ändert sich dann nichts.
    if (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.button !== 0) return;
    setKlick({ ziel: href.split("?")[0], von: pfad });
  };
  return [aktuell, merken] as const;
}
