"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useState } from "react";
import { einstellungenSuchen, trefferLink, type SuchEintrag } from "@/lib/einstellungen-suche";

/** Sucht das Ziel auf der Seite: `#id` eines Kastens oder das Eingabefeld mit diesem `name`. */
function zielElement(ziel: string): HTMLElement | null {
  if (ziel.startsWith("#")) return document.getElementById(ziel.slice(1));
  const bereich = document.querySelector("main") ?? document;
  const feld = bereich.querySelector<HTMLElement>(`[name="${CSS.escape(ziel)}"]`);
  // Zur ganzen Zeile mit Beschriftung scrollen, nicht nur zum Eingabefeld.
  return (feld?.closest("label")?.parentElement as HTMLElement | null) ?? feld;
}

function hinscrollen(ziel: string): boolean {
  const el = zielElement(ziel);
  if (!el) return false;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  return true;
}

/**
 * Suchfeld über den Reitern der Einstellungen. Sucht beim Tippen im Browser (ohne Server) nach Feldern,
 * Alltagswörtern, Fragen, Tippfehlern und gespeicherten Werten. Ein Treffer öffnet seinen Reiter und scrollt
 * zum Feld. Mit Pfeiltasten, Enter und Escape bedienbar, auf dem Handy reicht ein Tipp.
 */
export function EinstellungenSuche({ verzeichnis, bereich, feld }: { verzeichnis: SuchEintrag[]; bereich: string; feld?: string }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [aktiv, setAktiv] = useState(0);
  const [offen, setOffen] = useState(false);
  const listeId = useId();
  const treffer = useMemo(() => (q.trim() ? einstellungenSuchen(q, verzeichnis) : []), [q, verzeichnis]);

  // Nach dem Wechsel des Reiters steht das Ziel in der Adresse (`feld`). Die Seite kann noch nachladen,
  // deshalb warten wir kurz, bis das Feld da ist.
  useEffect(() => {
    if (!feld || hinscrollen(feld)) return;
    const beobachter = new MutationObserver(() => {
      if (hinscrollen(feld)) beobachter.disconnect();
    });
    beobachter.observe(document.body, { childList: true, subtree: true });
    const ende = setTimeout(() => beobachter.disconnect(), 6000);
    return () => {
      beobachter.disconnect();
      clearTimeout(ende);
    };
  }, [feld, bereich]);

  const waehlen = (t: SuchEintrag | undefined) => {
    if (!t) return;
    setQ("");
    setOffen(false);
    // Gleicher Reiter: das Feld steht schon da, nur hinscrollen (ohne neu zu laden).
    if (t.bereich === bereich) {
      if (t.ziel) hinscrollen(t.ziel);
      else window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    router.push(trefferLink(t));
  };

  const zeigen = offen && Boolean(q.trim());
  return (
    <div className="relative mb-4 max-w-xl">
      <input
        type="search"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setAktiv(0);
          setOffen(true);
        }}
        onFocus={() => setOffen(true)}
        onBlur={() => setOffen(false)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setOffen(true);
            setAktiv((a) => Math.min(a + 1, treffer.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setAktiv((a) => Math.max(a - 1, 0));
          } else if (e.key === "Enter") {
            e.preventDefault();
            waehlen(treffer[aktiv]?.eintrag);
          } else if (e.key === "Escape") {
            setQ("");
            setOffen(false);
          }
        }}
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        enterKeyHint="search"
        placeholder="Einstellung suchen, z. B. IBAN oder „Wo ändere ich die Öffnungszeiten?“"
        aria-label="Einstellung suchen"
        role="combobox"
        aria-autocomplete="list"
        aria-controls={listeId}
        aria-expanded={zeigen}
        aria-activedescendant={zeigen && treffer.length ? `${listeId}-${aktiv}` : undefined}
        className="feld"
      />
      {zeigen ? (
        <div className="absolute inset-x-0 top-full z-30 mt-1 rounded-lg border border-linie bg-weiss shadow-lg">
          {treffer.length ? (
            <ul id={listeId} role="listbox" aria-label="Gefundene Einstellungen" className="max-h-[60vh] divide-y divide-linie overflow-y-auto">
              {treffer.map((t, i) => (
                <li key={`${t.eintrag.bereich}-${t.eintrag.ziel ?? t.eintrag.titel}`} id={`${listeId}-${i}`} role="option" aria-selected={i === aktiv}>
                  <button
                    type="button"
                    // Fokus bleibt im Suchfeld, sonst schließt sich die Liste vor dem Klick.
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => waehlen(t.eintrag)}
                    onMouseEnter={() => setAktiv(i)}
                    tabIndex={-1}
                    className={`block min-h-12 w-full px-3 py-2 text-left ${i === aktiv ? "bg-papier" : ""} active:bg-papier`}
                  >
                    <span className="block truncate font-semibold">{t.eintrag.titel}</span>
                    <span className="block truncate text-sm text-grau">
                      {[t.eintrag.bereichTitel, t.eintrag.abschnitt].filter(Boolean).join(" › ")}
                    </span>
                    {t.imWert ? <span className="block truncate text-sm">„{t.imWert}“</span> : null}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p id={listeId} className="px-3 py-3 text-sm text-grau">Keine passende Einstellung gefunden.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
