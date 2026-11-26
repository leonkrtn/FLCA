import "server-only";
import type { Einstellungen } from "../einstellungen";
import { ENV } from "../env";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export type Baustein =
  | { art: "absatz"; text: string }
  | { art: "fakten"; zeilen: [string, string][] }
  | { art: "knopf"; text: string; url: string }
  | { art: "hinweis"; text: string }
  /** Kleingedrucktes, z. B. Widerrufsbelehrung: grau, kleiner, Zeilenumbrüche bleiben */
  | { art: "klein"; text: string };

/**
 * Einheitliches Mail-Layout: schlicht, eine Spalte, schwarzer Kopf mit Firmennamen, ein roter Knopf.
 * HTML und Text entstehen aus denselben Bausteinen, damit beide Fassungen nie auseinanderlaufen.
 */
export function mail(
  firma: Einstellungen["firma"],
  {
    ueberschrift,
    bausteine,
    gruss = true,
    abmelden,
  }: {
    ueberschrift: string;
    bausteine: Baustein[];
    gruss?: boolean;
    /** Werbliche Mails (Erinnerung, Bewertung): Abmeldelink im Fuß, Pflicht nach § 7 UWG */
    abmelden?: string;
  },
): { html: string; text: string } {
  const teile = bausteine.map((b) => {
    switch (b.art) {
      case "absatz":
        return `<p style="margin:0 0 16px">${esc(b.text).replace(/\n/g, "<br>")}</p>`;
      case "hinweis":
        return `<p style="margin:0 0 16px;padding:12px 14px;background:#f1efeb;border-left:3px solid #9a968f">${esc(b.text).replace(/\n/g, "<br>")}</p>`;
      case "fakten":
        return `<table role="presentation" style="width:100%;border-collapse:collapse;margin:0 0 20px">${b.zeilen
          .map(
            ([k, v]) =>
              `<tr><td style="padding:8px 12px 8px 0;border-bottom:1px solid #e3e0da;color:#6b6862;white-space:nowrap;vertical-align:top">${esc(k)}</td><td style="padding:8px 0;border-bottom:1px solid #e3e0da;font-weight:600">${esc(v).replace(/\n/g, "<br>")}</td></tr>`,
          )
          .join("")}</table>`;
      case "klein":
        return `<p style="margin:0 0 16px;color:#6b6862;font-size:12px;line-height:1.5">${esc(b.text).replace(/\n/g, "<br>")}</p>`;
      case "knopf":
        return `<p style="margin:8px 0 24px"><a href="${esc(b.url)}" style="display:inline-block;background:#2a2a2e;color:#f2f0eb;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:6px">${esc(b.text)}</a></p>`;
    }
  });

  const fuss = `${firma.name} · ${firma.inhaber}, ${firma.titel} · ${firma.strasse}, ${firma.plz} ${firma.ort} · ${firma.telefon}`;
  // Ohne Viewport-Angabe rechnet iOS-Mail die Mail breiter und verkleinert sie, sie steht dann schmal und schief
  // im Bildschirm. Auf dem Handy füllt die Karte die volle Breite (kein grauer Rand), am Rechner bleibt sie
  // lesbar schmal. Die Regeln im <style> verstehen Apple Mail und Gmail; wer sie nicht kennt, zeigt die Karte wie bisher.
  const html = `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="x-apple-disable-message-reformatting">
<style>@media (max-width:600px){body{background:#fff!important}.aussen{padding:0!important}.karte{max-width:100%!important}.kopf,.fuss{padding-left:20px!important;padding-right:20px!important}.inhalt{padding:24px 20px!important}}</style></head>
<body style="margin:0;background:#ecebe7;font-family:Helvetica,Arial,sans-serif;color:#141414;font-size:15px;line-height:1.55;-webkit-text-size-adjust:100%">
<table role="presentation" style="width:100%;border-collapse:collapse"><tr><td align="center" class="aussen" style="padding:24px 12px">
<table role="presentation" class="karte" style="width:100%;max-width:560px;border-collapse:collapse;background:#fff">
<tr><td class="kopf" style="background:#151515;color:#fff;padding:18px 28px;font-weight:800;letter-spacing:.06em;font-size:14px">${esc(firma.name.toUpperCase())}</td></tr>
<tr><td class="inhalt" style="padding:28px">
<h1 style="margin:0 0 16px;font-size:22px;line-height:1.25">${esc(ueberschrift)}</h1>
${teile.join("\n")}
${gruss ? `<p style="margin:0">Viele Grüße<br>${esc(firma.inhaber)} und Team</p>` : ""}
</td></tr>
<tr><td class="fuss" style="padding:16px 28px;border-top:1px solid #e3e0da;color:#6b6862;font-size:12px">${esc(fuss)}<br><a href="${esc(ENV.siteUrl)}" style="color:#6b6862">${esc(ENV.siteUrl.replace(/^https?:\/\//, ""))}</a>${abmelden ? `<br>Keine Erinnerungen und Bewertungsbitten mehr? <a href="${esc(abmelden)}" style="color:#6b6862">Abmelden</a>` : ""}</td></tr>
</table></td></tr></table></body></html>`;

  const text = [
    ueberschrift,
    "",
    ...bausteine.map((b) => {
      switch (b.art) {
        case "absatz":
        case "hinweis":
        case "klein":
          return `${b.text}\n`;
        case "fakten":
          return `${b.zeilen.map(([k, v]) => `${k}: ${v}`).join("\n")}\n`;
        case "knopf":
          return `${b.text}: ${b.url}\n`;
      }
    }),
    gruss ? `Viele Grüße\n${firma.inhaber} und Team\n` : "",
    "--",
    fuss,
    ...(abmelden ? [`Keine Erinnerungen und Bewertungsbitten mehr? Abmelden: ${abmelden}`] : []),
  ].join("\n");

  return { html, text };
}
