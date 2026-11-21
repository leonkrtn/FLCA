"use client";

import { useEffect } from "react";
import { istInstalliert } from "@/lib/push-browser";

/**
 * iOS 26 berechnet bei Web-Apps auf dem Home-Bildschirm beim Start (und manchmal nach der Rückkehr aus
 * dem Hintergrund) die Fenstergröße falsch: Unter der Tab-Leiste bleibt ein Streifen frei, oben liegt die
 * Unschärfe über dem Kopf. Bei der ersten Berührung rechnet iOS neu, danach sitzt alles. Hier tut die App
 * das selbst: Seite kurz einen Pixel höher machen, einen Pixel hin- und zurückscrollen, Höhe wieder lösen.
 * Ohne den Fehler passiert dabei sichtbar nichts. Läuft nur in der installierten Web-App.
 */
export function StartAusrichtung() {
  useEffect(() => {
    if (!istInstalliert()) return;
    const html = document.documentElement;
    const anstossen = () => {
      const y = window.scrollY;
      html.style.minHeight = "calc(100% + 1px)";
      requestAnimationFrame(() => {
        window.scrollTo({ top: y + 1, behavior: "instant" });
        requestAnimationFrame(() => {
          window.scrollTo({ top: y, behavior: "instant" });
          html.style.minHeight = "";
        });
      });
    };
    // Gleich beim Start und noch einmal, wenn iOS die Startanimation fertig hat
    anstossen();
    const spaeter = setTimeout(anstossen, 450);
    const sichtbar = () => {
      if (document.visibilityState === "visible") anstossen();
    };
    addEventListener("pageshow", anstossen);
    document.addEventListener("visibilitychange", sichtbar);
    return () => {
      clearTimeout(spaeter);
      removeEventListener("pageshow", anstossen);
      document.removeEventListener("visibilitychange", sichtbar);
    };
  }, []);
  return null;
}
