"use client";

import Link from "next/link";
import { Zahnrad } from "@/components/icons";
import { useZielPfad } from "@/lib/hooks/ziel-pfad";

// nurMobil: am großen Bildschirm steht der Punkt woanders (Einstellungen als Zahnrad unten im Benutzerblock)
export type NavEintrag = { href: string; text: string; anzahl?: number; gruppe?: string; nurMobil?: boolean };

export function AdminNav({ eintraege }: { eintraege: NavEintrag[] }) {
  const [pfad, merken] = useZielPfad();
  const neueGruppe = eintraege.map((e, i) => Boolean(e.gruppe) && e.gruppe !== eintraege[i - 1]?.gruppe);
  return (
    <nav aria-label="Verwaltung" className="flex gap-0.5 quer-scrollen px-3 pb-1 lg:flex-col lg:overflow-visible">
      {eintraege.map((e, i) => {
        const aktiv = e.href === "/admin" ? pfad === e.href : pfad.startsWith(e.href);
        return (
          <div key={e.href} className="contents">
            {neueGruppe[i] && !e.nurMobil ? <p className="mt-4 hidden px-3 pb-1 text-xs font-semibold uppercase tracking-[0.12em] text-grau-hell lg:block">{e.gruppe}</p> : null}
            <Link
              href={e.href}
              onClick={(ev) => merken(e.href, ev)}
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
  const aktiv = pfad.startsWith(href);
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
