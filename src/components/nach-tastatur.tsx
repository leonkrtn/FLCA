"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

/** So lange fährt die iPhone-Tastatur aus dem Bild, erst danach stimmt die neue Fensterhöhe. */
const TASTATUR_MS = 350;

const istEingabe = (el: Element | null) => el instanceof HTMLElement && (el.matches("input, textarea, select") || el.isContentEditable);

/** Ein Sprung an dieselbe Stelle lässt WebKit aus, deshalb erst einen Pixel daneben und zurück. */
function stelleNeuSetzen() {
  // Springt der Fokus nur ins nächste Feld, bleibt die Tastatur offen: dann nichts tun.
  if (istEingabe(document.activeElement)) return;
  const { scrollX: x, scrollY: y } = window;
  window.scrollTo(x, y + 1);
  window.scrollTo(x, y);
}

/**
 * iOS 26 rechnet das Fenster nicht neu, wenn die Tastatur zugeht (vor allem, wenn dabei die Seite wechselt, etwa
 * nach dem Speichern per `redirect`). Alles mit `fixed bottom-0` bleibt dann über der alten Tastaturkante stehen,
 * die Tab-Leiste schwebt mitten auf der Seite. Zwei Gegenmittel:
 * - Beim Absenden verlässt das Feld den Fokus. Die Tastatur ist dann schon zu, bevor die nächste Seite kommt.
 * - Nach dem Schließen der Tastatur und nach jedem Seitenwechsel ein Sprung an die Stelle, an der man schon steht.
 *   Das zwingt WebKit, das Fenster neu zu vermessen; zu sehen ist davon nichts.
 */
export function NachTastatur() {
  const pfad = usePathname();

  useEffect(() => {
    let warten: number | undefined;
    const neuVermessen = () => {
      clearTimeout(warten);
      warten = window.setTimeout(stelleNeuSetzen, TASTATUR_MS);
    };
    const absenden = () => {
      if (istEingabe(document.activeElement)) (document.activeElement as HTMLElement).blur();
    };
    let hoehe = window.visualViewport?.height ?? 0;
    const groesse = () => {
      const neu = window.visualViewport?.height ?? 0;
      // Nur wenn das sichtbare Fenster wächst (Tastatur geht zu), nicht beim Aufgehen oder Zoomen nach innen.
      if (neu > hoehe) neuVermessen();
      hoehe = neu;
    };
    // Erfassungsphase: läuft vor Reacts eigener Behandlung des Formulars, also vor der Aktion und vor einem redirect.
    document.addEventListener("submit", absenden, true);
    document.addEventListener("focusout", neuVermessen);
    window.visualViewport?.addEventListener("resize", groesse);
    return () => {
      clearTimeout(warten);
      document.removeEventListener("submit", absenden, true);
      document.removeEventListener("focusout", neuVermessen);
      window.visualViewport?.removeEventListener("resize", groesse);
    };
  }, []);

  // Nach einem Seitenwechsel mit noch offener Tastatur (redirect nach dem Speichern) ebenfalls neu vermessen.
  useEffect(() => {
    const t = window.setTimeout(stelleNeuSetzen, TASTATUR_MS);
    return () => clearTimeout(t);
  }, [pfad]);

  return null;
}
