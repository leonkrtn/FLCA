import "server-only";
import type { Einstellungen } from "../einstellungen";
import { automatischeSignatur } from "../mail/signatur";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export type Baustein =
  | { art: "absatz"; text: string }
  /** Kurze Liste „Name: Wert“, nur für Hinweise ans Büro; an Kunden stehen die Angaben im Fließtext */
  | { art: "fakten"; zeilen: [string, string][] }
  /**
   * Satz mit Link. Der Teil in eckigen Klammern ist im HTML der anklickbare Text („Sie können [Ihren Termin
   * online ansehen].“), ohne Klammern der ganze Satz. Die Textfassung zeigt den Satz und darunter die Adresse,
   * weil man dort sonst nicht hinkommt.
   */
  | { art: "link"; text: string; url: string };

/**
 * Automatische Mails wie von Hand geschrieben: Absätze in normaler Schrift, kein Layout, kein Kopf, keine
 * Knöpfe; Links als Satz mit der Adresse darunter. Am Ende dieselbe Signatur wie bei Mails aus dem Postfach
 * (Einstellungen → E-Mail → Signatur, mit Logo), unterschrieben vom Inhaber. HTML und Text entstehen aus
 * denselben Absätzen. Hinweise ans Büro (`signatur: false`) gehen als reiner Text ohne Signatur.
 */
export async function mail(
  _firma: Einstellungen["firma"],
  {
    bausteine,
    signatur = true,
    abmelden,
  }: {
    bausteine: Baustein[];
    signatur?: boolean;
    /** Werbliche Mails (Erinnerung, Bewertung): Abmeldelink unter der Signatur, Pflicht nach § 7 UWG */
    abmelden?: string;
  },
): Promise<{ text: string; html?: string }> {
  const absaetze = bausteine
    .map((b): { text: string; html: string } | null => {
      switch (b.art) {
        case "absatz": {
          const t = b.text.trim();
          return t ? { text: t, html: esc(t).replace(/\n/g, "<br>") } : null;
        }
        case "fakten": {
          const z = b.zeilen.filter(([, v]) => v.trim());
          return z.length ? { text: z.map(([k, v]) => `${k}: ${v}`).join("\n"), html: z.map(([k, v]) => `${esc(k)}: ${esc(v)}`).join("<br>") } : null;
        }
        case "link": {
          const satz = b.text.trim();
          const a = (t: string) => `<a href="${esc(b.url)}" style="color:#1a5fb4">${esc(t)}</a>`;
          const teil = satz.match(/^([^[]*)\[([^\]]+)\]([^]*)$/);
          return {
            text: `${satz.replace(/[[\]]/g, "").replace(/[.:]$/, "")}:\n${b.url}`,
            html: teil ? `${esc(teil[1])}${a(teil[2])}${esc(teil[3])}` : a(satz.replace(/:$/, "")),
          };
        }
      }
    })
    .filter((x) => x !== null);

  const abmeldeText = abmelden ? `Keine Erinnerungen und Bewertungsbitten mehr? Abmelden: ${abmelden}` : "";
  const text = (s: string) =>
    [...absaetze.map((a) => a.text), s, abmeldeText]
      .filter(Boolean)
      .join("\n\n")
      // Mehr als eine Leerzeile wirkt wie ein Versehen
      .replace(/\n{3,}/g, "\n\n");

  if (!signatur) return { text: text("") };

  const sig = await automatischeSignatur();
  // Ganzes Dokument mit Viewport: ohne ihn verkleinert iOS-Mail die Mail (Fehlerbuch). Schrift und Abstände wie
  // eine Mail aus dem Postfach (`versenden` in src/lib/mail/postfach.ts).
  const html = `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0"><div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#222222">
${absaetze.map((a) => `<p style="margin:0 0 14px">${a.html}</p>`).join("\n")}
<div style="margin-top:22px">${sig.html}</div>
${abmelden ? `<p style="margin:16px 0 0;font-size:11px;color:#666666">Keine Erinnerungen und Bewertungsbitten mehr? <a href="${esc(abmelden)}" style="color:#666666">Abmelden</a></p>` : ""}
</div></body></html>`;

  return { text: text(sig.text), html };
}
