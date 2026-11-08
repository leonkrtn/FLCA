import "server-only";
import type { Einstellungen } from "../einstellungen";
import { ENV } from "../env";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export type Baustein =
  | { art: "absatz"; text: string }
  | { art: "fakten"; zeilen: [string, string][] }
  | { art: "knopf"; text: string; url: string }
  | { art: "hinweis"; text: string };

/**
 * Einheitliches Mail-Layout: schlicht, eine Spalte, schwarzer Kopf mit Firmennamen, ein roter Knopf.
 * HTML und Text entstehen aus denselben Bausteinen, damit beide Fassungen nie auseinanderlaufen.
 */
export function mail(
  firma: Einstellungen["firma"],
  { ueberschrift, bausteine, gruss = true }: { ueberschrift: string; bausteine: Baustein[]; gruss?: boolean },
): { html: string; text: string } {
  const teile = bausteine.map((b) => {
    switch (b.art) {
      case "absatz":
        return `<p style="margin:0 0 16px">${esc(b.text).replace(/\n/g, "<br>")}</p>`;
      case "hinweis":
        return `<p style="margin:0 0 16px;padding:12px 14px;background:#f1efeb;border-left:3px solid #cc0605">${esc(b.text).replace(/\n/g, "<br>")}</p>`;
      case "fakten":
        return `<table role="presentation" style="width:100%;border-collapse:collapse;margin:0 0 20px">${b.zeilen
          .map(
            ([k, v]) =>
              `<tr><td style="padding:8px 12px 8px 0;border-bottom:1px solid #e3e0da;color:#6b6862;white-space:nowrap;vertical-align:top">${esc(k)}</td><td style="padding:8px 0;border-bottom:1px solid #e3e0da;font-weight:600">${esc(v).replace(/\n/g, "<br>")}</td></tr>`,
          )
          .join("")}</table>`;
      case "knopf":
        return `<p style="margin:8px 0 24px"><a href="${esc(b.url)}" style="display:inline-block;background:#cc0605;color:#fff;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:3px">${esc(b.text)}</a></p>`;
    }
  });

  const fuss = `${firma.name} · ${firma.inhaber}, ${firma.titel} · ${firma.strasse}, ${firma.plz} ${firma.ort} · ${firma.telefon}`;
  const html = `<!doctype html><html lang="de"><body style="margin:0;background:#ecebe7;font-family:Helvetica,Arial,sans-serif;color:#141414;font-size:15px;line-height:1.55">
<table role="presentation" style="width:100%;border-collapse:collapse"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" style="width:100%;max-width:560px;border-collapse:collapse;background:#fff">
<tr><td style="background:#151515;color:#fff;padding:18px 28px;font-weight:800;letter-spacing:.06em;font-size:14px">${esc(firma.name.toUpperCase())}</td></tr>
<tr><td style="padding:28px">
<h1 style="margin:0 0 16px;font-size:22px;line-height:1.25">${esc(ueberschrift)}</h1>
${teile.join("\n")}
${gruss ? `<p style="margin:0">Viele Grüße<br>${esc(firma.inhaber)} und Team</p>` : ""}
</td></tr>
<tr><td style="padding:16px 28px;border-top:1px solid #e3e0da;color:#6b6862;font-size:12px">${esc(fuss)}<br><a href="${esc(ENV.siteUrl)}" style="color:#6b6862">${esc(ENV.siteUrl.replace(/^https?:\/\//, ""))}</a></td></tr>
</table></td></tr></table></body></html>`;

  const text = [
    ueberschrift,
    "",
    ...bausteine.map((b) => {
      switch (b.art) {
        case "absatz":
        case "hinweis":
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
  ].join("\n");

  return { html, text };
}
