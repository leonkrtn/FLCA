"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Kreuz, Menue } from "@/components/icons";
import { telHref } from "@/lib/format";

/**
 * Menü der Website auf dem Telefon: deckt die Seite zwischen Kopf und unterer Leiste ganz ab, statt als kleines
 * Kästchen am Knopf zu hängen. Vorher (details/summary) blieb es nach einem Tipp offen, weil der Kopf beim
 * Seitenwechsel stehen bleibt, und schloss weder beim Tippen daneben noch mit Escape.
 */
export function MobilMenue({ nav, telefon, heute }: { nav: { href: string; label: string }[]; telefon: string; heute: string }) {
  const pfad = usePathname();
  // Offen gilt nur für die Seite, auf der es geöffnet wurde: Nach einem Seitenwechsel ist es zu, ohne Effekt.
  const [offenAuf, setOffenAuf] = useState<string | null>(null);
  const offen = offenAuf === pfad;
  const schliessen = () => setOffenAuf(null);

  useEffect(() => {
    if (!offen) return;
    // Die Seite darunter scrollt nicht mit, wenn man im Menü wischt.
    const html = document.documentElement;
    const vorher = html.style.overflow;
    html.style.overflow = "hidden";
    const taste = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOffenAuf(null);
    };
    window.addEventListener("keydown", taste);
    return () => {
      html.style.overflow = vorher;
      window.removeEventListener("keydown", taste);
    };
  }, [offen]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOffenAuf(offen ? null : pfad)}
        aria-expanded={offen}
        aria-controls="mobil-menue"
        aria-label={offen ? "Menü schließen" : "Menü öffnen"}
        className="-mr-2 flex size-11 items-center justify-center rounded-md [-webkit-tap-highlight-color:transparent]"
      >
        {offen ? <Kreuz className="size-6" /> : <Menue className="size-6" />}
      </button>
      {/* Über ein Portal am body: Der Kopf hat backdrop-blur und wäre sonst der Bezugsrahmen für „fixed“, das Menü
          bliebe dann in seiner Höhe gefangen. Deshalb trägt es „dunkel“ selbst. Unter Kopf (z-40) und unterer
          Leiste (z-40), damit „Termin“, Anrufen und WhatsApp sichtbar bleiben. */}
      {offen
        ? createPortal(
            <div
              id="mobil-menue"
              className="dunkel abdunkeln fixed inset-0 z-30 flex flex-col overflow-y-auto overscroll-contain bg-boden pb-[calc(5rem+env(safe-area-inset-bottom))] pt-[calc(4rem+1px+env(safe-area-inset-top))] md:hidden"
            >
              <nav aria-label="Menü" className="rand">
                <ul>
                  {nav.map((n) => (
                    <li key={n.href} className="border-b border-linie">
                      <Link
                        href={n.href}
                        onClick={schliessen}
                        aria-current={n.href === pfad ? "page" : undefined}
                        className="schmal flex min-h-16 items-center text-3xl text-tinte aria-[current=page]:text-grau"
                      >
                        {n.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
              <a href={telHref(telefon)} className="rand mt-auto block pb-2 pt-10">
                <span className="zahlen block text-lg font-semibold">{telefon}</span>
                <span className="block text-sm text-grau">{heute}</span>
              </a>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
