"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Ab so lange im Hintergrund holt die Seite beim Zurückkommen den neuen Stand. */
const NACH_MS = 60_000;

/**
 * Holt den aktuellen Stand vom Server, wenn man nach einer Weile zur App zurückkehrt (Home-Bildschirm, anderer
 * Tab). Eine Web-App auf dem iPhone bleibt sonst tagelang auf dem Stand vom letzten Öffnen stehen, und der
 * Router-Cache (`staleTimes` in next.config.ts) hält besuchte Seiten kurz vor. `router.refresh()` lädt nur die
 * Daten neu: Eingaben, offene Menüs und die Scrollposition bleiben, nichts flackert.
 */
export function Auffrischen() {
  const router = useRouter();
  useEffect(() => {
    let weg = document.visibilityState === "hidden" ? Date.now() : 0;
    const wechsel = () => {
      if (document.visibilityState === "hidden") weg = Date.now();
      else if (weg && Date.now() - weg > NACH_MS) {
        weg = 0;
        router.refresh();
      }
    };
    document.addEventListener("visibilitychange", wechsel);
    return () => document.removeEventListener("visibilitychange", wechsel);
  }, [router]);
  return null;
}
