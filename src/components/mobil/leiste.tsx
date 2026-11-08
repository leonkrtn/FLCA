"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useZielPfad } from "@/lib/hooks/ziel-pfad";

export type Tab = { href: string; text: string; icon: React.ReactNode; anzahl?: number; hervorgehoben?: boolean };

/**
 * iOS 26 rechnet bei Web-Apps auf dem Home-Bildschirm (Statusleiste „black-translucent“) die Höhe
 * des sichtbaren Bereichs um die Statusleiste zu klein. Alles, was mit `bottom: 0` unten klebt,
 * schwebt dann über einem leeren Streifen. Wir messen die Lücke (Bildschirmhöhe minus Fensterhöhe,
 * nur wenn die Seite unter die Statusleiste reicht) und legen sie als --luecke ab. Die Leiste rutscht
 * um genau so viel nach unten. Ohne Fehler im System ist die Lücke 0 und es ändert sich nichts.
 */
function useLueckeUnten() {
  useEffect(() => {
    const standalone = (navigator as Navigator & { standalone?: boolean }).standalone || matchMedia("(display-mode: standalone)").matches;
    if (!standalone) return;
    const probe = document.createElement("div");
    probe.style.cssText = "position:fixed;top:0;height:0;padding-top:env(safe-area-inset-top);visibility:hidden;pointer-events:none";
    document.body.appendChild(probe);
    const messen = () => {
      const hoch = innerHeight >= innerWidth;
      const oben = probe.offsetHeight;
      const luecke = hoch && oben > 0 ? Math.max(0, Math.min(screen.height - innerHeight, 120)) : 0;
      document.documentElement.style.setProperty("--luecke", `${luecke}px`);
    };
    messen();
    addEventListener("resize", messen);
    return () => {
      removeEventListener("resize", messen);
      probe.remove();
    };
  }, []);
}

/** Untere Tab-Leiste der Handy-Apps, mit Abstand für den Home-Balken des iPhones. */
export function TabLeiste({ tabs, dunkel }: { tabs: Tab[]; dunkel?: boolean }) {
  const [pfad, merken] = useZielPfad();
  useLueckeUnten();
  return (
    <nav
      aria-label="Bereiche"
      // Unter der Leiste läuft ihre Farbe weiter (after:), damit auch eine falsch berechnete Lücke nie hell durchscheint.
      className={`fixed inset-x-0 bottom-[calc(0px-var(--luecke,0px))] z-40 border-t pb-[env(safe-area-inset-bottom)] after:absolute after:inset-x-0 after:top-full after:h-32 after:bg-inherit ${dunkel ? "border-white/10 bg-graphit text-boden" : "border-linie bg-papier text-tinte"}`}
    >
      <div className="mx-auto grid max-w-xl" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
        {tabs.map((t) => {
          const aktiv = t.href === pfad || (t.href.split("/").length > 2 && pfad.startsWith(t.href));
          return (
            <Link
              key={t.href}
              href={t.href}
              onClick={(ev) => merken(t.href, ev)}
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
