/**
 * Regeln rund um Mailadressen und Gespräche, ohne Datenbank und ohne Abhängigkeiten (getestet).
 * Läuft auf dem Server (Eingang, Versand) und im Browser (Vorschau der Adresse am Mitarbeiter).
 */

/** Erlaubter Teil vor dem @: Kleinbuchstaben und Ziffern, getrennt durch einzelne Punkte, Binde- oder Unterstriche. */
export const MAIL_NAME_MUSTER = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/;

/**
 * Teil vor dem @ aus dem Namen: „Flavio Ciurli“ → „flavio.ciurli“. Erster und letzter Teil des Namens
 * (Vorname.Nachname), Umlaute ausgeschrieben, Akzente weg. Wer anders heißen soll, bekommt in der
 * Verwaltung einen eigenen Namen (`profile.mail_name`).
 */
export function mailNameAus(name: string): string {
  const teile = name
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .split(/\s+/)
    .map((t) => t.replace(/[^a-z0-9-]/g, "").replace(/-+/g, "-").replace(/^-|-$/g, ""))
    .filter(Boolean);
  if (!teile.length) return "";
  return teile.length === 1 ? teile[0] : `${teile[0]}.${teile[teile.length - 1]}`;
}

/** Eigener Name vor dem @, sonst der aus dem Namen abgeleitete. */
export function mailNameVon(p: { name: string; mail_name?: string | null }): string {
  return p.mail_name?.trim() || mailNameAus(p.name);
}

/** „Max Muster <max@beispiel.de>“ → Name und Adresse (klein geschrieben). Auch nackte Adressen. */
export function adresseZerlegen(roh: string): { name: string; adresse: string } {
  const t = roh.trim();
  const m = t.match(/^(.*?)\s*<([^<>\s]+@[^<>\s]+)>$/);
  if (m) return { name: m[1].replace(/^"|"$/g, "").trim(), adresse: m[2].toLowerCase() };
  return { name: "", adresse: t.replace(/^<|>$/g, "").toLowerCase() };
}

/** „Name <adresse>“ zum Versenden; Anführungszeichen im Namen stören den Kopf und fallen weg. */
export function absender(name: string, adresse: string): string {
  const n = name.replace(/["<>\r\n]/g, "").trim();
  return n ? `"${n}" <${adresse}>` : adresse;
}

/** Liste aus einem Eingabefeld („a@b.de, c@d.de; e@f.de“) in einzelne Adressen. */
export function adressListe(eingabe: string): string[] {
  return eingabe
    .split(/[,;\n]+/)
    .map((a) => adresseZerlegen(a).adresse)
    .filter(Boolean);
}

export function istAdresse(wert: string): boolean {
  return /^[^\s@<>",;]+@[^\s@<>",;]+\.[^\s@<>",;]{2,}$/.test(wert);
}

type Person = { id: string; name: string; mail_name?: string | null; aktiv: boolean };

/**
 * In welche Postfächer eine eingehende Mail gehört: je Person, deren Adresse unter den Empfängern ist,
 * sonst ins Firmenpostfach (null). Unbekannte Adressen der eigenen Domain (info@, termine@, Tippfehler)
 * und Mails an deaktivierte Personen landen im Firmenpostfach, damit nichts verloren geht.
 */
export function postfaecherFuer(empfaenger: string[], domain: string, personen: Person[]): (string | null)[] {
  const d = `@${domain.toLowerCase()}`;
  const eigene = empfaenger.map((e) => adresseZerlegen(e).adresse).filter((a) => a.endsWith(d));
  const ziele = new Set<string | null>();
  for (const a of eigene) {
    const lokal = a.slice(0, -d.length);
    const p = personen.find((x) => mailNameVon(x) === lokal);
    ziele.add(p?.aktiv ? p.id : null);
  }
  // Kam die Mail über eine Weiterleitung oder BCC ohne eigene Adresse im Kopf an, trotzdem ablegen
  if (!ziele.size) ziele.add(null);
  return [...ziele];
}

/** Betreff ohne „Re:“, „AW:“, „Fwd:“ usw. davor, zum Zuordnen von Antworten. */
export function betreffKern(betreff: string): string {
  let t = betreff.trim();
  for (;;) {
    const kuerzer = t.replace(/^(re|aw|antw|fw|fwd|wg|wtr|sv|vs)\s*(\[\d+\])?\s*:\s*/i, "");
    if (kuerzer === t) return t.replace(/\s+/g, " ").toLowerCase();
    t = kuerzer;
  }
}

/** Betreff einer Antwort: genau ein „AW:“ davor. */
export function antwortBetreff(betreff: string): string {
  const kern = betreff.trim().replace(/^((re|aw|antw)\s*(\[\d+\])?\s*:\s*)+/i, "");
  return `AW: ${kern || "(ohne Betreff)"}`;
}

/** Message-IDs aus „In-Reply-To“ und „References“ (je „<…>“). */
export function nachrichtenIds(...koepfe: (string | null | undefined)[]): string[] {
  return koepfe.flatMap((k) => k?.match(/<[^<>\s]+>/g) ?? []);
}

/** Der zitierte Text unter einer Antwort. */
export function zitat(text: string, von: string, wann: string): string {
  const zeilen = text.trim().split("\n").map((z) => (z ? `> ${z}` : ">"));
  return `\n\nAm ${wann} schrieb ${von}:\n${zeilen.join("\n")}`;
}

/** Text einer Mail als schlichtes HTML (Absätze, Zeilenumbrüche, zitierte Zeilen eingerückt), damit Mailprogramme sie ordentlich zeigen. */
export function textAlsHtml(text: string): string {
  const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  // Aufeinanderfolgende Zeilen mit „>“ werden ein Zitatblock, der Rest Absätze
  const gruppen: { zitat: boolean; zeilen: string[] }[] = [];
  for (const z of text.split("\n")) {
    const zitat = z.startsWith(">");
    const letzte = gruppen.at(-1);
    if (letzte && letzte.zitat === zitat) letzte.zeilen.push(zitat ? z.replace(/^>\s?/, "") : z);
    else gruppen.push({ zitat, zeilen: [zitat ? z.replace(/^>\s?/, "") : z] });
  }
  const html = gruppen.map((g) => {
    if (g.zitat) return `<blockquote style="margin:0 0 1em .8ex;border-left:1px solid #ccc;padding-left:1ex;color:#555">${esc(g.zeilen.join("\n")).replace(/\n/g, "<br>")}</blockquote>`;
    return g.zeilen
      .join("\n")
      .split(/\n{2,}/)
      .map((b) => b.replace(/^\n+|\n+$/g, ""))
      .filter(Boolean)
      .map((b) => `<p style="margin:0 0 1em">${esc(b).replace(/\n/g, "<br>")}</p>`)
      .join("");
  });
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#222">${html.join("")}</div>`;
}

/** Kurzer Vorschautext aus dem Inhalt (für die Liste). */
export function vorschau(text: string, laenge = 140): string {
  const t = text
    .split("\n")
    .filter((z) => !z.startsWith(">"))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  return t.length > laenge ? `${t.slice(0, laenge - 1)}…` : t;
}

/** Klartext aus HTML, wenn eine Mail keinen Textteil hat (für Vorschau, Suche und Zitat). */
export function htmlAlsText(html: string): string {
  return html
    .replace(/<(style|script|head)[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|li|h\d|blockquote)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Dateigröße lesbar: 1,2 MB, 340 KB. */
export function groesse(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
