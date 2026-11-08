"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type Tab = { href: string; text: string; icon: React.ReactNode; anzahl?: number; hervorgehoben?: boolean };

/** Untere Tab-Leiste der Handy-Apps, mit Abstand für den Home-Balken des iPhones. */
export function TabLeiste({ tabs, dunkel }: { tabs: Tab[]; dunkel?: boolean }) {
  const pfad = usePathname();
  return (
    <nav
      aria-label="Bereiche"
      className={`fixed inset-x-0 bottom-0 z-40 border-t pb-[env(safe-area-inset-bottom)] ${dunkel ? "border-white/10 bg-graphit text-boden" : "border-linie bg-papier text-tinte"}`}
    >
      <div className="mx-auto grid max-w-xl" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
        {tabs.map((t) => {
          const aktiv = t.href === pfad || (t.href.split("/").length > 2 && pfad.startsWith(t.href));
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={aktiv ? "page" : undefined}
              className={`relative flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold ${aktiv ? "" : "opacity-60"}`}
            >
              <span className={t.hervorgehoben ? "flex size-9 items-center justify-center rounded-full bg-rot text-weiss" : ""}>{t.icon}</span>
              {t.hervorgehoben ? null : t.text}
              {t.anzahl ? <span className="zahlen absolute right-[calc(50%-1.25rem)] top-1.5 min-w-5 rounded-full bg-rot px-1 text-center text-[11px] leading-5 text-weiss">{t.anzahl}</span> : null}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
