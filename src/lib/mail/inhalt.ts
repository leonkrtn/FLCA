/**
 * Inhalt von Mails ohne Datenbank und ohne Abhängigkeiten (getestet): HTML aus dem Editor bereinigen,
 * den mitzitierten Verlauf einer Antwort abschneiden (Unterhaltungsansicht), Signatur und Zitate bauen.
 * Läuft im Browser (Editor, Vorschau) und auf dem Server (vor dem Senden wird immer bereinigt).
 */

export function esc(t: string): string {
  return t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// ---------------------------------------------------------------------------
// Bereinigen: Was der Editor liefert (oder jemand von Hand schickt), darf nur Formatierung enthalten
// ---------------------------------------------------------------------------

const ERLAUBT = new Set(["p", "br", "div", "span", "b", "strong", "i", "em", "u", "ul", "ol", "li", "a", "blockquote", "img", "table", "tbody", "tr", "td", "hr", "font"]);
// Inhalt fällt mit weg, nicht nur der Tag
const MIT_INHALT_WEG = /<(script|style|iframe|object|embed|head|title|template|svg|math|noscript|textarea|select|button)\b[\s\S]*?<\/\1\s*>/gi;
const STIL_ERLAUBT: Record<string, RegExp> = {
  "font-size": /^(\d{1,2}(\.\d)?(px|pt|em|rem)|small|medium|large|x-large)$/,
  "font-weight": /^(bold|normal|[1-9]00)$/,
  "font-style": /^(italic|normal)$/,
  "text-decoration": /^(underline|none|line-through)$/,
  color: /^(#[0-9a-f]{3,6}|rgb\(\d{1,3},\s*\d{1,3},\s*\d{1,3}\))$/i,
  margin: /^[\d.\s]+(px|em)?( [\d.]+(px|em)?){0,3}$/,
  "margin-top": /^[\d.]+(px|em)$/,
  "margin-bottom": /^[\d.]+(px|em)$/,
  "padding-left": /^[\d.]+(px|em|ex)$/,
  "border-left": /^[\d.]+px solid #[0-9a-f]{3,6}$/i,
  "line-height": /^[\d.]+$/,
  "vertical-align": /^(top|middle)$/,
  "font-family": /^[\w\s,"'-]{1,80}$/,
  width: /^\d{1,3}(px|%)$/,
  height: /^\d{1,3}px$/,
};

function attribut(attrs: string, name: string): string | null {
  const m = attrs.match(new RegExp(`\\s${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));
  return m ? (m[2] ?? m[3] ?? m[4] ?? "") : null;
}

function stilBereinigen(stil: string): string {
  return stil
    .split(";")
    .map((t) => t.split(":"))
    .filter(([k, ...v]) => k && v.length && STIL_ERLAUBT[k.trim().toLowerCase()]?.test(v.join(":").trim()))
    .map(([k, ...v]) => `${k.trim().toLowerCase()}:${v.join(":").trim()}`)
    .join(";");
}

/**
 * Lässt nur einfache Formatierung durch: Absätze, fett, kursiv, unterstrichen, Listen, Links (http, https,
 * mailto, tel), Zitate, Tabellen und Bilder für die Signatur (nur https). Keine Skripte, keine Ereignis-
 * Attribute, keine fremden Stile.
 */
export function htmlBereinigen(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(MIT_INHALT_WEG, "")
    .replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)([^>]*)>/g, (ganz, roh: string, attrs: string) => {
      const tag = roh.toLowerCase();
      if (!ERLAUBT.has(tag)) return "";
      if (ganz.startsWith("</")) return `</${tag}>`;
      const teile: string[] = [];
      const stil = attribut(attrs, "style");
      if (stil) {
        const s = stilBereinigen(stil);
        if (s) teile.push(`style="${esc(s)}"`);
      }
      if (tag === "a") {
        const href = attribut(attrs, "href")?.trim() ?? "";
        if (/^(https?:|mailto:|tel:)/i.test(href)) teile.push(`href="${esc(href)}"`);
      }
      if (tag === "img") {
        const src = attribut(attrs, "src")?.trim() ?? "";
        if (!/^https:\/\//i.test(src)) return "";
        teile.push(`src="${esc(src)}"`);
        const alt = attribut(attrs, "alt");
        if (alt !== null) teile.push(`alt="${esc(alt)}"`);
        for (const n of ["width", "height"]) {
          const w = attribut(attrs, n);
          if (w && /^\d{1,4}$/.test(w)) teile.push(`${n}="${w}"`);
        }
      }
      if (tag === "td") {
        for (const n of ["colspan", "valign"]) {
          const w = attribut(attrs, n);
          if (w && /^(\d{1,2}|top|middle)$/.test(w)) teile.push(`${n}="${w}"`);
        }
      }
      if (tag === "font") {
        const size = attribut(attrs, "size");
        if (size && /^[1-7]$/.test(size)) teile.push(`size="${size}"`);
      }
      return `<${tag}${teile.length ? ` ${teile.join(" ")}` : ""}>`;
    });
}

/** Ist im HTML überhaupt Text (ohne Tags und Leerzeichen)? */
export function hatText(html: string): boolean {
  return html.replace(/<img\b[^>]*>/gi, "x").replace(/<[^>]+>/g, "").replace(/&nbsp;|\s/g, "").length > 0;
}

// ---------------------------------------------------------------------------
// Verlauf abschneiden: In der Unterhaltungsansicht steht der alte Verlauf schon darüber
// ---------------------------------------------------------------------------

/** Wo in einer HTML-Mail der zitierte Verlauf beginnt (Gmail, Outlook, Apple Mail, Thunderbird, GMX/Web.de). */
const HTML_MARKEN: RegExp[] = [
  /<div[^>]*class=["'][^"']*gmail_quote/i,
  /<div[^>]*id=["']?(appendonsend|divRplyFwdMsg|mail-editor-reference-message-container)/i,
  /<hr[^>]*id=["']?stopSpelling/i,
  /<div[^>]*style=["'][^"']*border:\s*none;\s*border-top:\s*solid\s*#?[a-z0-9]+\s*1\.0pt/i,
  /<blockquote[^>]*type=["']cite/i,
  /<div[^>]*class=["'][^"']*(moz-cite-prefix|yahoo_quoted|OutlookMessageHeader)/i,
  /-{3,}\s*(Original Message|Ursprüngliche Nachricht|Originalnachricht)\s*-{3,}/i,
  // „Am 01.12.2026 um 09:30 schrieb Max Muster <max@…>:“ / „On Tue, … wrote:“ (Tags dazwischen erlaubt)
  /(?:<(?!\/)[^>]+>\s*)*(Am|On)\s(?:[^<]|<[^>]+>){5,300}?\s(schrieb|wrote)(?:[^<]|<[^>]+>){0,200}?:/i,
  // Kopfblock von Outlook als Text: „Von: … Gesendet: …“
  /(?:<(?!\/)[^>]+>\s*)*(Von|From):\s*(?:<[^>]+>\s*)*[^<]{1,200}(?:<[^>]+>\s*)*(Gesendet|Sent|Datum|Date):/i,
];

const TEXT_MARKEN: RegExp[] = [
  /^-{3,}\s*(Original Message|Ursprüngliche Nachricht|Originalnachricht)/im,
  /^(Am|On)\s.{5,300}?(schrieb|wrote).{0,200}?:\s*$/im,
  /^(Von|From):\s.+\n(.*\n){0,2}(Gesendet|Sent|Datum|Date):/im,
  /^>.*(\n>.*)+\s*$/m,
];

/**
 * Teilt eine Mail in das Neue und den mitzitierten Verlauf. Schneidet nur ab, wenn davor noch Text steht;
 * sonst (reine Weiterleitung, nur Zitat) bleibt alles „neu“.
 */
export function verlaufAbschneiden(inhalt: string, html: boolean): { neu: string; verlauf: string } {
  const marken = html ? HTML_MARKEN : TEXT_MARKEN;
  let schnitt = -1;
  for (const m of marken) {
    const i = inhalt.search(m);
    if (i > 0 && (schnitt < 0 || i < schnitt)) schnitt = i;
  }
  if (schnitt < 0) return { neu: inhalt, verlauf: "" };
  const neu = inhalt.slice(0, schnitt);
  const sichtbar = html ? hatText(neu) : neu.trim().length > 0;
  return sichtbar ? { neu: html ? neu : neu.trimEnd(), verlauf: inhalt.slice(schnitt) } : { neu: inhalt, verlauf: "" };
}

// ---------------------------------------------------------------------------
// Zitat, Weiterleitung, Signatur
// ---------------------------------------------------------------------------

/** Kopf über der zitierten Mail bei Antwort und Weiterleitung, wie Outlook. */
export function zitatHtml(m: { von: string; vonName: string; an: string[]; cc: string[]; wann: string; betreff: string; html: string }, weiterleitung: boolean): string {
  const kopf = weiterleitung
    ? `<p style="margin:0">-------- Weitergeleitete Nachricht --------<br><b>Von:</b> ${esc(m.vonName ? `${m.vonName} <${m.von}>` : m.von)}<br><b>Gesendet:</b> ${esc(m.wann)}<br><b>An:</b> ${esc(m.an.join(", "))}${m.cc.length ? `<br><b>Cc:</b> ${esc(m.cc.join(", "))}` : ""}<br><b>Betreff:</b> ${esc(m.betreff)}</p>`
    : `<p style="margin:0">Am ${esc(m.wann)} schrieb ${esc(m.vonName || m.von)}:</p>`;
  return `<div data-zitat="1"><p><br></p>${kopf}<blockquote style="margin:0 0 0 .8ex;border-left:1px solid #cccccc;padding-left:1ex">${m.html}</blockquote></div>`;
}

export type SignaturDaten = {
  gruss: string;
  name: string;
  job: string;
  telefon: string;
  email: string;
  firma: { name: string; strasse: string; plz: string; ort: string; inhaber: string; titel: string; rechtsform: string; steuernummer: string; ustId: string };
  website: string;
  oeffnungszeiten: string;
  logoUrl: string;
  pflichtangaben: boolean;
};

/** Signatur als HTML (in jedem Mailprogramm lesbar: Tabelle, Inline-Stile, Logo als Bild von der Website). */
export function signaturHtml(d: SignaturDaten): string {
  const grau = "color:#666666";
  const zeilen: string[] = [];
  if (d.gruss) zeilen.push(`<p style="margin:0 0 10px">${esc(d.gruss)}</p>`);
  const kopf = [`<b>${esc(d.name)}</b>`, d.job ? `<span style="${grau}">${esc(d.job)}</span>` : ""].filter(Boolean).join("<br>");
  const kontakt = [
    d.telefon ? `Telefon ${esc(d.telefon)}` : "",
    d.email ? `<a href="mailto:${esc(d.email)}" style="color:#222222">${esc(d.email)}</a>` : "",
    d.website ? `<a href="${esc(d.website)}" style="color:#222222">${esc(d.website.replace(/^https?:\/\//, ""))}</a>` : "",
  ].filter(Boolean);
  const firma = [`<b>${esc(d.firma.name)}</b>`, [d.firma.strasse, [d.firma.plz, d.firma.ort].filter(Boolean).join(" ")].filter(Boolean).map(esc).join(", ")].filter(Boolean);
  const text = [kopf, kontakt.join("<br>"), firma.join("<br>"), d.oeffnungszeiten ? `<span style="${grau}">${esc(d.oeffnungszeiten)}</span>` : ""].filter(Boolean).join('<br><span style="line-height:.6"><br></span>');
  const logo = d.logoUrl ? `<td valign="top" style="padding-left:0"><img src="${esc(d.logoUrl)}" alt="${esc(d.firma.name)}" width="120" style="width:120px"></td>` : "";
  zeilen.push(
    `<table style="font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.45;color:#222222"><tbody><tr>${logo}<td valign="top"${logo ? ' style="padding-left:14px;border-left:1px solid #dddddd"' : ""}>${text}</td></tr></tbody></table>`,
  );
  if (d.pflichtangaben) {
    const p = [
      [d.firma.name, d.firma.rechtsform].filter(Boolean).join(", "),
      d.firma.inhaber ? `Inhaber: ${d.firma.inhaber}${d.firma.titel ? ` (${d.firma.titel})` : ""}` : "",
      d.firma.steuernummer ? `Steuernummer ${d.firma.steuernummer}` : "",
      d.firma.ustId ? `USt-IdNr. ${d.firma.ustId}` : "",
    ].filter(Boolean);
    zeilen.push(`<p style="margin:10px 0 0;font-size:11px;${grau}">${p.map(esc).join(" · ")}</p>`);
  }
  return `<div data-signatur="1" style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#222222">${zeilen.join("")}</div>`;
}

const TAGE = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

/** Öffnungszeiten kurz für die Signatur: „Mo–Fr 08:30–13:00, 14:00–18:00 · Sa 09:00–13:00“. */
export function oeffnungszeitenKurz(o: Record<string, [string, string][]>): string {
  const gruppen: { von: number; bis: number; text: string }[] = [];
  for (let i = 0; i < 7; i++) {
    const f = o[String(i + 1)] ?? [];
    const text = f.map(([a, b]) => `${a}–${b}`).join(", ");
    const letzte = gruppen.at(-1);
    if (letzte && letzte.text === text && letzte.bis === i - 1) letzte.bis = i;
    else gruppen.push({ von: i, bis: i, text });
  }
  return gruppen
    .filter((g) => g.text)
    .map((g) => `${TAGE[g.von]}${g.bis > g.von ? `–${TAGE[g.bis]}` : ""} ${g.text}`)
    .join(" · ");
}

/** Farben der Kategorien (Namen, damit die Oberfläche sie in beiden Welten passend zeichnet). */
export const KATEGORIE_FARBEN: Record<string, { name: string; hex: string }> = {
  rot: { name: "Rot", hex: "#d64545" },
  orange: { name: "Orange", hex: "#e08a2e" },
  gelb: { name: "Gelb", hex: "#d4b22a" },
  gruen: { name: "Grün", hex: "#3f9a5a" },
  blau: { name: "Blau", hex: "#3b74c9" },
  lila: { name: "Lila", hex: "#8a5cc2" },
  grau: { name: "Grau", hex: "#8a8a8a" },
};
