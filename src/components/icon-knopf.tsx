import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";

/**
 * Knöpfe nur mit Icon, für Leisten, die in einer Zeile bleiben sollen (Mail, Editor). Was ein Icon tut, sagt ein
 * kurzer Hinweis beim Darüberfahren (Tailwind setzt für hover eine Maus voraus, am Handy bleibt er also nicht
 * hängen) und bei Tastaturfokus; Screenreader lesen das aria-label.
 */

type Lage = {
  /** unten (Standard) oder oben, wenn die Leiste am unteren Rand steht */
  seite?: "unten" | "oben";
  /** am Rand einer Leiste links oder rechts bündig, sonst würde ein mittiger Hinweis abgeschnitten */
  ausrichtung?: "mitte" | "links" | "rechts";
};

// Auf grauem Grund (Kopf des Schreibfensters) hebt sich ein grauer Hover nicht ab, dort wird er hell.
const flaeche = (klein?: boolean, aufBoden?: boolean) =>
  `grid ${klein ? "size-8" : "size-9"} shrink-0 place-items-center rounded-sm disabled:opacity-50 ${aufBoden ? "hover:bg-flaeche focus-visible:bg-flaeche" : "hover:bg-boden focus-visible:bg-boden"}`;

/** Unsichtbar über dem Icon (Auswahl, Datei): Der Tipp öffnet die Auswahl des Systems, am Handy die native Liste. */
export const unsichtbaresFeld = "absolute inset-0 size-full cursor-pointer opacity-0";

export function Hinweis({ text, seite = "unten", ausrichtung = "mitte" }: { text: string } & Lage) {
  const x = ausrichtung === "links" ? "left-0" : ausrichtung === "rechts" ? "right-0" : "left-1/2 -translate-x-1/2";
  const y = seite === "oben" ? "bottom-full mb-1" : "top-full mt-1";
  return (
    <span
      aria-hidden
      className={`pointer-events-none absolute z-30 whitespace-nowrap rounded-sm bg-tinte px-2 py-1 text-xs font-semibold text-flaeche opacity-0 transition-opacity group-hover:opacity-100 group-hover:delay-300 group-has-focus-visible:opacity-100 ${x} ${y}`}
    >
      {text}
    </span>
  );
}

export function IconKnopf({
  text,
  lage,
  klein,
  aufBoden,
  className = "",
  children,
  ...rest
}: { text: string; lage?: Lage; klein?: boolean; aufBoden?: boolean; children: ReactNode } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <span className="group relative shrink-0">
      <button type="button" aria-label={text} className={`${flaeche(klein, aufBoden)} ${className}`} {...rest}>
        {children}
      </button>
      <Hinweis text={text} {...lage} />
    </span>
  );
}

export function IconLink({
  text,
  lage,
  klein,
  className = "",
  children,
  ...rest
}: { text: string; lage?: Lage; klein?: boolean; children: ReactNode } & AnchorHTMLAttributes<HTMLAnchorElement>) {
  return (
    <span className="group relative shrink-0">
      <a aria-label={text} className={`${flaeche(klein)} ${className}`} {...rest}>
        {children}
      </a>
      <Hinweis text={text} {...lage} />
    </span>
  );
}

/** Icon mit unsichtbarem Bedienelement darüber (`<select className={unsichtbaresFeld}>`, Datei-Eingabe). */
export function IconFeld({ text, lage, klein, aktiv, icon, children }: { text: string; lage?: Lage; klein?: boolean; aktiv?: boolean; icon: ReactNode; children: ReactNode }) {
  return (
    <span className={`group relative ${flaeche(klein)} ${aktiv ? "bg-boden" : ""} has-focus-visible:bg-boden`}>
      {icon}
      {children}
      <Hinweis text={text} {...lage} />
    </span>
  );
}
