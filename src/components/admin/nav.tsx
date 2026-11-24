"use client";

import Link from "next/link";
import { Absenden } from "@/components/admin/formular";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Zahnrad } from "@/components/icons";
import { useGemerkterKalender } from "@/lib/hooks/kalender-merken";
import { useZielPfad } from "@/lib/hooks/ziel-pfad";

const KALENDER = "/admin/kalender";

/** Pfad ist der Menüpunkt selbst oder eine Unterseite davon. Nur ganze Abschnitte: „/admin/kunden“ markiert nicht „/admin/kundenbildschirm“. */
const unter = (pfad: string, href: string) => pfad === href || pfad.startsWith(`${href}/`);

// nurMobil: am großen Bildschirm steht der Punkt woanders (Einstellungen als Zahnrad unten im Benutzerblock)
export type NavEintrag = { href: string; text: string; anzahl?: number; gruppe?: string; nurMobil?: boolean };

export function AdminNav({ eintraege }: { eintraege: NavEintrag[] }) {
  const [echterPfad, merken] = useZielPfad();
  const gemerkt = useGemerkterKalender();
  // Einen Termin, den man aus dem Kalender geöffnet hat (`?kal=…`), sieht man noch „im Kalender“
  // (nicht mehr, sobald man woanders hingeklickt hat und die Seite noch lädt)
  const such = useSearchParams();
  const pathname = usePathname();
  const ausKalender = such.has("kal") && echterPfad === pathname && echterPfad.startsWith("/admin/termine");
  const pfad = ausKalender ? KALENDER : echterPfad;
  const neueGruppe = eintraege.map((e, i) => Boolean(e.gruppe) && e.gruppe !== eintraege[i - 1]?.gruppe);
  return (
    <nav aria-label="Verwaltung" className="flex gap-0.5 quer-scrollen px-3 pb-1 lg:flex-col lg:overflow-visible">
      {eintraege.map((e, i) => {
        const aktiv = e.href === "/admin" ? pfad === e.href : unter(pfad, e.href);
        // „Kalender“ führt dorthin zurück, wo man zuletzt war (Woche, Tag oder Monat)
        const href = e.href === KALENDER && gemerkt ? gemerkt : e.href;
        return (
          <div key={e.href} className="contents">
            {neueGruppe[i] && !e.nurMobil ? <p className="mt-4 hidden px-3 pb-1 text-xs font-semibold uppercase tracking-[0.12em] text-grau-hell lg:block">{e.gruppe}</p> : null}
            <Link
              href={href}
              onClick={(ev) => merken(href, ev)}
              aria-current={aktiv ? "page" : undefined}
              className={`flex items-center justify-between gap-3 whitespace-nowrap rounded-sm px-3 py-1.5 text-sm ${e.nurMobil ? "lg:hidden" : ""} font-semibold transition-colors ${
                aktiv ? "bg-weiss text-tinte" : "text-boden/80 hover:bg-white/10 hover:text-weiss"
              }`}
            >
              {e.text}
              {e.anzahl ? <span className="zahlen min-w-6 rounded-full bg-rot px-1.5 text-center text-xs leading-5 text-weiss">{e.anzahl}</span> : null}
            </Link>
          </div>
        );
      })}
    </nav>
  );
}

/** Einstellungen am großen Bildschirm: nur das Zahnrad unten rechts im Benutzerblock, mit Fehlerzähler als Badge. */
export function EinstellungenSymbol({ href, anzahl }: { href: string; anzahl?: number }) {
  const [pfad, merken] = useZielPfad();
  const aktiv = unter(pfad, href);
  return (
    <Link
      href={href}
      onClick={(ev) => merken(href, ev)}
      aria-current={aktiv ? "page" : undefined}
      aria-label={anzahl ? `Einstellungen, ${anzahl} offene Fehler` : "Einstellungen"}
      title="Einstellungen"
      className={`relative grid size-9 shrink-0 place-items-center rounded-sm transition-colors ${
        aktiv ? "bg-weiss text-tinte" : "text-boden/80 hover:bg-white/10 hover:text-weiss"
      }`}
    >
      <Zahnrad />
      {anzahl ? (
        <span className="zahlen absolute -right-1 -top-1 min-w-4 rounded-full bg-rot px-1 text-center text-[10px] leading-4 text-weiss">{anzahl}</span>
      ) : null}
    </Link>
  );
}

/**
 * Benutzerblock unten in der Leiste: Ein Klick auf Name und Rolle öffnet nach oben ein kleines Menü mit
 * „Abmelden“. So steht Abmelden nicht offen im Menü, wo man es aus Versehen trifft.
 */
export function KontoMenue({ name, rolle, abmelden }: { name: string; rolle: string; abmelden: () => Promise<void> }) {
  const [offen, setOffen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!offen) return;
    const zu = (e: Event) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOffen(false);
    };
    document.addEventListener("pointerdown", zu);
    document.addEventListener("keydown", zu);
    return () => {
      document.removeEventListener("pointerdown", zu);
      document.removeEventListener("keydown", zu);
    };
  }, [offen]);
  return (
    <div ref={ref} className="relative min-w-0 flex-1">
      {offen ? (
        <div role="menu" className="absolute inset-x-0 bottom-full mb-2 overflow-hidden rounded-md bg-weiss py-1 text-tinte shadow-xl">
          <form action={abmelden}>
            <Absenden role="menuitem" className="block w-full px-3 py-2 text-left font-semibold hover:bg-boden">
              Abmelden
            </Absenden>
          </form>
        </div>
      ) : null}
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={offen}
        onClick={() => setOffen((o) => !o)}
        className={`-mx-2 -my-1 block w-[calc(100%+1rem)] rounded-sm px-2 py-1 text-left transition-colors ${offen ? "bg-white/10" : "hover:bg-white/10"}`}
      >
        <span className="block truncate font-semibold text-weiss">{name}</span>
        <span className="block text-grau-hell">{rolle}</span>
      </button>
    </div>
  );
}
