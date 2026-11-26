import "server-only";
import type { Einstellungen } from "../einstellungen";
import { ENV } from "../env";

export type Baustein =
  | { art: "absatz"; text: string }
  /** Kurze Liste „Name: Wert“, nur für Hinweise ans Büro; an Kunden stehen die Angaben im Fließtext */
  | { art: "fakten"; zeilen: [string, string][] }
  /** Satz und darunter die Adresse auf eigener Zeile; Mailprogramme machen sie von selbst anklickbar */
  | { art: "link"; text: string; url: string };

/**
 * Automatische Mails als schlichte Textmail, wie von Hand geschrieben: Absätze, Links auf eigener Zeile, Gruß
 * und darunter die Signatur der Firma. Kein HTML und kein Layout, damit sie beim Kunden wie eine persönliche
 * Mail ankommt. Leere Absätze fallen weg.
 */
export function mail(
  firma: Einstellungen["firma"],
  {
    bausteine,
    gruss = true,
    abmelden,
  }: {
    bausteine: Baustein[];
    /** Gruß am Ende: Text aus den Mailtexten (`mailTexte().gruss`), `true` = Standard, `false` = keiner */
    gruss?: boolean | string;
    /** Werbliche Mails (Erinnerung, Bewertung): Abmeldelink unter der Signatur, Pflicht nach § 7 UWG */
    abmelden?: string;
  },
): { text: string } {
  const grussText = gruss === false ? "" : typeof gruss === "string" ? gruss.trim() : `Viele Grüße\n${firma.inhaber} und Team`;
  const absaetze = bausteine
    .map((b) => {
      switch (b.art) {
        case "absatz":
          return b.text.trim();
        case "fakten":
          return b.zeilen
            .filter(([, v]) => v.trim())
            .map(([k, v]) => `${k}: ${v}`)
            .join("\n");
        case "link":
          return `${b.text.trim().replace(/:$/, "")}:\n${b.url}`;
      }
    })
    .filter(Boolean);

  const signatur = [
    `${firma.name} · ${firma.inhaber}, ${firma.titel} · ${firma.strasse}, ${firma.plz} ${firma.ort} · ${firma.telefon}`,
    ENV.siteUrl.replace(/^https?:\/\//, ""),
    ...(abmelden ? [`Keine Erinnerungen und Bewertungsbitten mehr? Abmelden: ${abmelden}`] : []),
  ];

  const text = [...absaetze, ...(grussText ? [grussText] : []), `--\n${signatur.join("\n")}`]
    .join("\n\n")
    // Mehr als eine Leerzeile wirkt wie ein Versehen
    .replace(/\n{3,}/g, "\n\n");

  return { text };
}
