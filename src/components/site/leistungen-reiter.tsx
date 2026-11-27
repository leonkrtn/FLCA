"use client";

import { useSyncExternalStore } from "react";

/**
 * Reiter je Bereich auf der Seite „Leistungen“. Der gewählte Bereich steht in der Adresse (#bereich-service), damit
 * die Kacheln der Startseite direkt auf ihren Bereich zeigen. Gewechselt wird mit replaceState: ein normaler
 * Sprung zum Anker legte für jeden Tipp einen Eintrag im Verlauf an und störte den Zustand des Routers.
 * Alle Reiter sind gleich breit (Raster mit gleichen Spalten, so breit wie der längste Name).
 * Alle Bereiche stehen im HTML (inaktive mit hidden), Suchmaschinen und Seiten ohne Skript sehen also alles.
 */

const EREIGNIS = "leistungen-reiter";
const PRAEFIX = "#bereich-";

function abonnieren(neu: () => void) {
  window.addEventListener("hashchange", neu);
  window.addEventListener(EREIGNIS, neu);
  return () => {
    window.removeEventListener("hashchange", neu);
    window.removeEventListener(EREIGNIS, neu);
  };
}
const ausAdresse = () => (window.location.hash.startsWith(PRAEFIX) ? window.location.hash.slice(PRAEFIX.length) : "");
const aufDemServer = () => "";

export function LeistungenReiter({ bereiche }: { bereiche: { schluessel: string; kurz: string; anzahl: number; inhalt: React.ReactNode }[] }) {
  const gewuenscht = useSyncExternalStore(abonnieren, ausAdresse, aufDemServer);
  const aktiv = bereiche.some((b) => b.schluessel === gewuenscht) ? gewuenscht : bereiche[0]?.schluessel;

  const waehlen = (schluessel: string) => {
    // history.state behalten: Daran erkennt der Router seine eigenen Einträge.
    window.history.replaceState(window.history.state, "", PRAEFIX + schluessel);
    window.dispatchEvent(new Event(EREIGNIS));
  };

  return (
    <>
      <div role="tablist" aria-label="Bereiche" className="mt-10 grid auto-cols-fr grid-flow-col gap-1 quer-scrollen rounded-lg bg-flaeche p-1 [scrollbar-width:none] md:w-fit">
        {bereiche.map((b) => (
          <button
            key={b.schluessel}
            type="button"
            role="tab"
            id={`reiter-${b.schluessel}`}
            aria-selected={b.schluessel === aktiv}
            aria-controls={`tafel-${b.schluessel}`}
            onClick={() => waehlen(b.schluessel)}
            className="zahlen min-h-11 whitespace-nowrap rounded-md px-2 text-xs font-semibold uppercase tracking-[0.08em] text-grau transition-colors [-webkit-tap-highlight-color:transparent] aria-selected:bg-rot aria-selected:text-auf-rot max-[380px]:px-1 max-[380px]:text-[11px] max-[380px]:tracking-[0.04em] sm:text-[13px] sm:tracking-[0.12em] md:px-6"
          >
            {b.kurz}
            {/* Die Anzahl erst ab sm: am Telefon reicht die Breite sonst nicht für drei gleich breite Reiter */}
            <span className="ml-1.5 hidden opacity-60 sm:inline">{b.anzahl}</span>
          </button>
        ))}
      </div>
      {bereiche.map((b) => (
        <div key={b.schluessel} role="tabpanel" id={`tafel-${b.schluessel}`} aria-labelledby={`reiter-${b.schluessel}`} hidden={b.schluessel !== aktiv}>
          {b.inhalt}
        </div>
      ))}
    </>
  );
}
