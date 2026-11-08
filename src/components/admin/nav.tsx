"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavEintrag = { href: string; text: string; anzahl?: number; gruppe?: string };

export function AdminNav({ eintraege }: { eintraege: NavEintrag[] }) {
  const pfad = usePathname();
  const neueGruppe = eintraege.map((e, i) => Boolean(e.gruppe) && e.gruppe !== eintraege[i - 1]?.gruppe);
  return (
    <nav aria-label="Verwaltung" className="flex gap-1 overflow-x-auto px-3 pb-1 lg:flex-col lg:overflow-visible">
      {eintraege.map((e, i) => {
        const aktiv = e.href === "/admin" ? pfad === e.href : pfad.startsWith(e.href);
        return (
          <div key={e.href} className="contents">
            {neueGruppe[i] ? <p className="mt-4 hidden px-3 pb-1 text-xs font-semibold uppercase tracking-[0.12em] text-grau-hell lg:block">{e.gruppe}</p> : null}
            <Link
              href={e.href}
              aria-current={aktiv ? "page" : undefined}
              className={`flex items-center justify-between gap-3 whitespace-nowrap rounded-sm px-3 py-2 text-sm font-semibold transition-colors ${
                aktiv ? "bg-weiss text-tinte" : "text-boden/80 hover:bg-white/10 hover:text-weiss"
              }`}
            >
              {e.text}
              {e.anzahl ? <span className={`zahlen min-w-6 rounded-full px-1.5 text-center text-xs leading-5 ${aktiv ? "bg-rot text-weiss" : "bg-rot text-weiss"}`}>{e.anzahl}</span> : null}
            </Link>
          </div>
        );
      })}
    </nav>
  );
}
