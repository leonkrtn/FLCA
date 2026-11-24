"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { Kreuz } from "@/components/icons";
import { useZielPfad } from "@/lib/hooks/ziel-pfad";

export type MenueEintrag = { href: string; text: string };

export type Tab = {
  href: string;
  text: string;
  icon: React.ReactNode;
  anzahl?: number;
  hervorgehoben?: boolean;
  /** Weitere Pfade, unter denen der Tab als aktiv gilt (z. B. Kostenvoranschläge unter „Rechnungen“) */
  auch?: string[];
  /** Statt direkt zu springen, öffnet der Tab eine kurze Auswahl über sich (das „+“). */
  menue?: MenueEintrag[];
};

/** Untere Tab-Leiste der Handy-Apps, mit Abstand für den Home-Balken des iPhones. */
export function TabLeiste({ tabs, dunkel }: { tabs: Tab[]; dunkel?: boolean }) {
  const [pfad, merken] = useZielPfad();
  // Das Menü gehört zur Seite, auf der es geöffnet wurde: Nach jedem Seitenwechsel (auch Zurück-Geste) ist es zu.
  const echterPfad = usePathname();
  const [offenAuf, setOffenAuf] = useState<string | null>(null);
  const offen = offenAuf === echterPfad;
  const setOffen = (o: boolean) => setOffenAuf(o ? echterPfad : null);
  const istAktiv = (t: Tab) => [t.href, ...(t.auch ?? [])].some((h) => h === pfad || (h.split("/").length > 2 && pfad.startsWith(`${h}/`)));
  return (
    <>
      {offen ? (
        // Abdunklung unter der Leiste: Tippen daneben schließt, das „+“ (jetzt ×) bleibt bedienbar.
        <div aria-hidden className="abdunkeln fixed inset-0 z-30 bg-black/45" onClick={() => setOffen(false)} />
      ) : null}
      <nav
        aria-label="Bereiche"
        // Unter der Leiste läuft ihre Farbe weiter (after:), damit beim Nachfedern am Seitenende nichts hell durchscheint.
        className={`fixed inset-x-0 bottom-0 z-40 border-t pb-[env(safe-area-inset-bottom)] after:absolute after:inset-x-0 after:top-full after:h-32 after:bg-inherit ${dunkel ? "border-white/10 bg-graphit text-boden" : "border-linie bg-leiste text-tinte"}`}
      >
        <div className="mx-auto grid max-w-xl" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
          {tabs.map((t) => {
            const aktiv = istAktiv(t);
            if (t.menue) {
              return <MenueTab key={t.href} tab={t} aktiv={aktiv} offen={offen} setOffen={setOffen} onWahl={(href, ev) => merken(href, ev)} />;
            }
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
    </>
  );
}

/**
 * Das „+“: öffnet eine schmale Liste direkt darüber, das Zeichen wird zum ×. Schließt bei Tipp daneben,
 * mit Escape, nach der Wahl und bei jedem Seitenwechsel (siehe offenAuf in TabLeiste). Fokus springt auf den ersten Eintrag, damit
 * es auch mit Tastatur und VoiceOver geht.
 */
function MenueTab({
  tab,
  aktiv,
  offen,
  setOffen,
  onWahl,
}: {
  tab: Tab;
  aktiv: boolean;
  offen: boolean;
  setOffen: (o: boolean) => void;
  onWahl: (href: string, ev: React.MouseEvent) => void;
}) {
  const id = useId();
  const liste = useRef<HTMLUListElement>(null);
  const knopf = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!offen) return;
    liste.current?.querySelector<HTMLAnchorElement>("a")?.focus({ preventScroll: true });
    const taste = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOffen(false);
        knopf.current?.focus();
      }
    };
    addEventListener("keydown", taste);
    return () => removeEventListener("keydown", taste);
    // setOffen wechselt mit jedem Rendern, gemeint ist nur das Öffnen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offen]);

  return (
    <div className="relative flex">
      {offen ? (
        <ul
          id={id}
          ref={liste}
          aria-label={tab.text}
          className="hochfahren absolute bottom-full left-1/2 mb-3 w-52 -translate-x-1/2 overflow-hidden rounded-lg bg-weiss text-tinte shadow-xl ring-1 ring-black/5"
        >
          {tab.menue!.map((m) => (
            <li key={m.href} className="border-b border-linie last:border-b-0">
              <Link
                href={m.href}
                onClick={(ev) => {
                  onWahl(m.href, ev);
                  setOffen(false);
                }}
                className="flex min-h-12 items-center px-4 text-[15px] font-semibold active:bg-papier"
              >
                {m.text}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
      <button
        ref={knopf}
        type="button"
        onClick={() => setOffen(!offen)}
        aria-expanded={offen}
        aria-controls={offen ? id : undefined}
        aria-label={offen ? "Schließen" : "Neu anlegen"}
        className={`relative flex min-h-14 w-full flex-col items-center justify-center gap-0.5 text-[11px] font-semibold ${aktiv || offen ? "" : "opacity-60"}`}
      >
        <span className={`flex size-9 items-center justify-center rounded-full bg-rot text-weiss transition-transform duration-150 ${offen ? "rotate-90" : ""}`}>
          {offen ? <Kreuz className="size-4" /> : tab.icon}
        </span>
      </button>
    </div>
  );
}
