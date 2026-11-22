"use client";

import { useEffect, useSyncExternalStore } from "react";
import { berlinDatum } from "@/lib/zeit";

/**
 * Zuletzt angesehene Stelle im Kalender, damit „Kalender“ im Menü dorthin zurückführt statt in die aktuelle Woche.
 * Gemerkt wird je Tab (sessionStorage) und nur für heute: Am nächsten Tag (die Web-App bleibt am iPhone oft
 * tagelang offen) beginnt der Kalender wieder bei heute, statt in einer alten Woche zu landen.
 */
const SCHLUESSEL = "kalender-ansicht";
const EREIGNIS = "kalender-ansicht";

function lesen(): string | null {
  try {
    const roh = sessionStorage.getItem(SCHLUESSEL);
    if (!roh) return null;
    const { tag, href } = JSON.parse(roh) as { tag?: string; href?: string };
    return tag === berlinDatum() && typeof href === "string" && href.startsWith("/admin/kalender") ? href : null;
  } catch {
    // Privates Fenster oder gesperrter Speicher: dann eben die aktuelle Woche
    return null;
  }
}

function abonnieren(neu: () => void) {
  window.addEventListener(EREIGNIS, neu);
  return () => window.removeEventListener(EREIGNIS, neu);
}

/** Adresse der zuletzt angesehenen Kalenderansicht oder null */
export function useGemerkterKalender(): string | null {
  return useSyncExternalStore(abonnieren, lesen, () => null);
}

/** Steht auf der Kalenderseite und merkt sich die gerade offene Ansicht. */
export function KalenderMerken({ href }: { href: string }) {
  useEffect(() => {
    try {
      sessionStorage.setItem(SCHLUESSEL, JSON.stringify({ tag: berlinDatum(), href }));
    } catch {
      // ohne Speicher kein Merken, die Seite funktioniert trotzdem
    }
    window.dispatchEvent(new Event(EREIGNIS));
  }, [href]);
  return null;
}
