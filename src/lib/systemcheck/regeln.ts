// Regeln des Systemchecks ohne Datenbank und ohne Dienste (getestet in regeln.test.ts).
import { fehlerText } from "../fehler";
import { adresseZerlegen, istAdresse } from "../mail/adressen";

export type Stand = "ok" | "warnung" | "fehler";

export type Pruefung = { gruppe: string; name: string; stand: Stand; text: string; ms: number };

/** Gelb statt Rot: läuft, aber etwas fehlt oder ist nicht prüfbar (z. B. Dienst nicht eingerichtet). */
export class Warnung extends Error {
  name = "Warnung";
}

/**
 * Länger wartet keine Prüfung, sonst hält eine hängende Verbindung den ganzen Check auf. Knapp bemessen, weil
 * der Nachtlauf im Takt steckt (Vercel bricht den nach 60 s ab) und die Gruppen nacheinander laufen.
 */
export const GRENZE_MS = 10_000;

/**
 * Führt eine Einzelprüfung aus. Was `fn` zurückgibt, ist der Text für Grün; eine `Warnung` macht Gelb, jeder
 * andere Fehler Rot mit seiner Meldung. `ursache` behält den Fehler selbst fürs Fehlerprotokoll (Code, Tabelle).
 */
export async function pruefen(gruppe: string, name: string, fn: () => Promise<string | void>, grenzeMs = GRENZE_MS): Promise<Pruefung & { ursache?: unknown }> {
  const start = Date.now();
  let uhr: ReturnType<typeof setTimeout> | undefined;
  try {
    const text = await Promise.race([
      fn(),
      new Promise<never>((_, nein) => {
        uhr = setTimeout(() => nein(new Error(`Keine Antwort nach ${Math.round(grenzeMs / 1000)} Sekunden.`)), grenzeMs);
      }),
    ]);
    return { gruppe, name, stand: "ok", text: text || "", ms: Date.now() - start };
  } catch (fehler) {
    const warnung = fehler instanceof Warnung;
    return { gruppe, name, stand: warnung ? "warnung" : "fehler", text: fehlerText(fehler), ms: Date.now() - start, ursache: warnung ? undefined : fehler };
  } finally {
    clearTimeout(uhr);
  }
}

export function zaehlen(liste: Pick<Pruefung, "stand">[]): { rot: number; gelb: number; gruen: number } {
  return {
    rot: liste.filter((p) => p.stand === "fehler").length,
    gelb: liste.filter((p) => p.stand === "warnung").length,
    gruen: liste.filter((p) => p.stand === "ok").length,
  };
}

/** Text der Push-Nachricht nach dem Nachtlauf: welche Prüfungen rot sind (gekürzt). */
export function pushText(liste: Pick<Pruefung, "gruppe" | "name" | "stand">[]): string {
  const rot = liste.filter((p) => p.stand === "fehler").map((p) => `${p.gruppe}: ${p.name}`);
  const gezeigt = rot.slice(0, 4).join(", ");
  return rot.length > 4 ? `${gezeigt} und ${rot.length - 4} weitere` : gezeigt;
}

type PruefMail = {
  an: string | string[];
  betreff: string;
  html: string;
  text: string;
  von?: string;
  cc?: string[];
  bcc?: string[];
  anhaenge?: { dateiname: string; inhalt: Buffer; typ?: string }[];
};

/** Resend nimmt höchstens 40 MB je Mail an (mit Anhängen). */
const MAIL_GRENZE = 40 * 1024 * 1024;

/**
 * Was an einer Mail nicht stimmt, bevor sie rausgeht (Testmodus von `mailer()`): Empfänger, Absender,
 * Betreff, Inhalt und Anhänge. Leer = würde so gesendet.
 */
export function mailPruefen(mail: PruefMail): string[] {
  const fehler: string[] = [];
  const an = [mail.an].flat().filter(Boolean);
  if (!an.length) fehler.push("Kein Empfänger.");
  for (const roh of [...an, ...(mail.cc ?? []), ...(mail.bcc ?? [])]) {
    if (!istAdresse(adresseZerlegen(roh).adresse)) fehler.push(`Ungültige Adresse: ${roh}`);
  }
  if (mail.von !== undefined && !istAdresse(adresseZerlegen(mail.von).adresse)) fehler.push(`Ungültiger Absender: ${mail.von || "(leer)"}`);
  if (!mail.betreff.trim()) fehler.push("Betreff fehlt.");
  if (!mail.text.trim()) fehler.push("Textfassung fehlt.");
  if (!mail.html.trim()) fehler.push("HTML-Fassung fehlt.");
  // Ohne Viewport wird die Mail auf dem iPhone schmal (Fehlerbuch): Mails nur über mail() bauen.
  else if (!/name=["']?viewport/i.test(mail.html)) fehler.push("HTML ohne Viewport (nicht über mail() gebaut).");
  let groesse = Buffer.byteLength(mail.html) + Buffer.byteLength(mail.text);
  for (const a of mail.anhaenge ?? []) {
    groesse += a.inhalt.length;
    if (!a.dateiname.trim()) fehler.push("Anhang ohne Dateinamen.");
    if (!a.inhalt.length) fehler.push(`Anhang ${a.dateiname} ist leer.`);
    else if ((a.typ === "application/pdf" || a.dateiname.toLowerCase().endsWith(".pdf")) && a.inhalt.subarray(0, 5).toString("latin1") !== "%PDF-") {
      fehler.push(`Anhang ${a.dateiname} ist kein gültiges PDF.`);
    }
  }
  if (groesse > MAIL_GRENZE) fehler.push(`Mail ist mit ${Math.round(groesse / 1024 / 1024)} MB zu groß (höchstens 40 MB).`);
  return fehler;
}

/** Was an der Adresse eines Webhooks nicht stimmt (Testmodus von `zustellen()`). */
export function webhookPruefen(url: string): string[] {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return [`Keine gültige Adresse: ${url}`];
  }
  const fehler: string[] = [];
  if (u.protocol !== "https:") fehler.push(`Nur https ist erlaubt: ${url}`);
  if (/^(localhost|127\.|10\.|192\.168\.|0\.0\.0\.0)/.test(u.hostname)) fehler.push(`Interne Adresse, von Vercel aus nicht erreichbar: ${url}`);
  return fehler;
}
