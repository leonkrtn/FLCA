"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";

const SCHLUESSEL = "flc-cookie-hinweis";

/**
 * Hinweis zu Cookies auf der Website. Die Seite setzt nur technisch notwendige Speicherung (dieser Hinweis selbst,
 * Anmeldung im Mitarbeiterbereich), deshalb gibt es nichts einzuwilligen, nur einen Knopf zum Schließen.
 * Kommt ein Dienst dazu, der eine Einwilligung braucht (Analyse, eingebettete Karte), muss hier eine echte Auswahl
 * hin, die den Dienst erst nach Zustimmung lädt.
 */// Merkt sich das Schließen auch dann für diesen Besuch, wenn der Speicher gesperrt ist (privater Modus).
let geschlossen = false;
const hoerer = new Set<() => void>();

function gelesen(): boolean {
  if (geschlossen) return true;
  try {
    return localStorage.getItem(SCHLUESSEL) !== null;
  } catch {
    return false;
  }
}

function abonnieren(hoeren: () => void) {
  hoerer.add(hoeren);
  return () => hoerer.delete(hoeren);
}

function schliessen() {
  geschlossen = true;
  try {
    localStorage.setItem(SCHLUESSEL, "1");
  } catch {
    // gesperrter Speicher: gilt nur für diesen Besuch
  }
  for (const h of hoerer) h();
}

export function CookieHinweis() {
  // Auf dem Server gilt der Hinweis als gelesen: Der Server kennt den Speicher des Browsers nicht, sonst flackerte
  // der Hinweis bei jedem Besuch kurz auf. Im Browser erscheint er erst nach dem Hydrieren.
  const zeigen = !useSyncExternalStore(abonnieren, gelesen, () => true);


  if (!zeigen) return null;
  return (
    <div
      role="region"
      aria-label="Hinweis zu Cookies"
      className="fixed inset-x-2 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-50 rounded-lg border border-linie bg-flaeche p-4 text-sm text-tinte shadow-lg md:inset-x-auto md:bottom-4 md:right-4 md:max-w-md"
    >
      <p>
        Wir verwenden nur technisch notwendige Cookies, keine Analyse- oder Werbe-Cookies. Mehr dazu in der{" "}
        <Link href="/datenschutz" className="underline">
          Datenschutzerklärung
        </Link>
        .
      </p>
      <button type="button" onClick={schliessen} className="knopf knopf-rot mt-3 w-full md:w-auto">
        Verstanden
      </button>
    </div>
  );
}
