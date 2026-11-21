import { datum, preis } from "../format";

/**
 * Angebote rechnen: welches Angebot läuft, welche Leistung es trifft und was sie dann kostet. Ohne
 * Datenbank und ohne Abhängigkeiten, damit Website, Termine und Belege (und die Tests) dieselbe Regel nutzen.
 *
 * Grundsätze: Die Preisliste bleibt unverändert, der Angebotspreis entsteht beim Anzeigen. Reduzierte Preise
 * werden auf volle Euro gerundet, damit sie zu den runden Listenpreisen passen (ein Festpreis bleibt, wie er
 * eingegeben wurde). Treffen mehrere Angebote, gilt der günstigste Preis; Rabatte werden nie addiert.
 */

export type RabattArt = "prozent" | "euro" | "festpreis";

export type Angebot = {
  id: string;
  titel: string;
  kurztext: string;
  bedingungen: string;
  bild_pfad: string | null;
  art: RabattArt;
  /** prozent: ganze Prozent; euro: Cent weniger; festpreis: Bruttopreis in Cent */
  wert: number;
  kategorien: string[];
  leistung_ids: string[];
  /** „YYYY-MM-DD“, ganze Tage in Berlin */
  von: string;
  /** null = ohne Ende, bis es ausgeschaltet wird */
  bis: string | null;
  aktiv: boolean;
};

/** Was eine Leistung über ihr laufendes Angebot weiß. */
export type AngebotsPreis = {
  id: string;
  titel: string;
  /** „−20 %“, „−10 €“, „Aktionspreis“ */
  rabatt: string;
  /** Preis laut Preisliste (für den durchgestrichenen Preis); null = dort ohne Preis */
  listen_cent: number | null;
  bis: string | null;
};

/** Am Termin festgehalten (termine.angebot_preise), Schlüssel ist die Leistung. */
export type GebuchterAngebotsPreis = { angebot_id: string; titel: string; rabatt: string; cent: number | null; listen_cent: number | null };

type Treffbar = { id: string; kategorie: string; art?: "leistung" | "position" };

export const RABATT_ARTEN: Record<RabattArt, string> = {
  prozent: "Prozent weniger",
  euro: "Euro weniger",
  festpreis: "Festpreis",
};

export function laeuft(a: Pick<Angebot, "aktiv" | "von" | "bis">, heute: string): boolean {
  return a.aktiv && a.von <= heute && (a.bis === null || heute <= a.bis);
}

/** Kategorien treffen nur Leistungen; Teile und Material kommen nur über die Einzelauswahl ins Angebot. */
export function trifft(a: Pick<Angebot, "kategorien" | "leistung_ids">, l: Treffbar): boolean {
  return a.leistung_ids.includes(l.id) || ((l.art ?? "leistung") === "leistung" && a.kategorien.includes(l.kategorie));
}

const aufEuro = (cent: number) => Math.round(cent / 100) * 100;

/** Angebotspreis zu einem Listenpreis (brutto, Cent). Nie teurer als der Listenpreis. */
export function reduziert(a: Pick<Angebot, "art" | "wert">, listen: number): number {
  const neu = a.art === "festpreis" ? a.wert : a.art === "prozent" ? aufEuro((listen * (100 - a.wert)) / 100) : aufEuro(listen - a.wert);
  return Math.min(Math.max(neu, 0), listen);
}

export function rabattText(a: Pick<Angebot, "art" | "wert">): string {
  if (a.art === "prozent") return `−${a.wert} %`;
  if (a.art === "euro") return `−${preis(a.wert)}`;
  return "Aktionspreis";
}

const hinweis = (a: Angebot, listen: number | null): AngebotsPreis => ({ id: a.id, titel: a.titel, rabatt: rabattText(a), listen_cent: listen, bis: a.bis });

/**
 * Preis einer Leistung unter den laufenden Angeboten. Ohne Listenpreis („auf Anfrage“) nennt nur ein
 * Festpreis einen Betrag, sonst bleibt es beim Hinweis „−20 %“. Ein „ab“-Preis wird wie jeder andere reduziert.
 */
export function mitAngebot(l: Treffbar & { preis_cent: number | null }, angebote: Angebot[], heute: string): { preis_cent: number | null; angebot: AngebotsPreis | null } {
  const passend = angebote.filter((a) => laeuft(a, heute) && trifft(a, l));
  if (!passend.length) return { preis_cent: l.preis_cent, angebot: null };

  if (l.preis_cent === null) {
    const fest = passend.filter((a) => a.art === "festpreis").sort((x, y) => x.wert - y.wert)[0];
    const a = fest ?? passend.filter((x) => x.art === "prozent").sort((x, y) => y.wert - x.wert)[0] ?? passend[0];
    return { preis_cent: fest ? fest.wert : null, angebot: hinweis(a, null) };
  }

  let bestes: Angebot | null = null;
  let cent = l.preis_cent;
  for (const a of passend) {
    const c = reduziert(a, l.preis_cent);
    if (c < cent) {
      bestes = a;
      cent = c;
    }
  }
  return bestes ? { preis_cent: cent, angebot: hinweis(bestes, l.preis_cent) } : { preis_cent: l.preis_cent, angebot: null };
}

/** Eine Liste (Preisliste, Leistungen der Website) mit Angebotspreisen: preis_cent ist danach der geltende Preis. */
export function angeboteAnwenden<T extends Treffbar & { preis_cent: number | null }>(liste: T[], angebote: Angebot[], heute: string): (T & { angebot: AngebotsPreis | null })[] {
  return liste.map((l) => ({ ...l, ...mitAngebot(l, angebote, heute) }));
}

/** Tage bis zum Ende, heute mitgezählt: endet heute = 1. */
export function restTage(bis: string, heute: string): number {
  return Math.round((Date.parse(`${bis}T12:00:00Z`) - Date.parse(`${heute}T12:00:00Z`)) / 86400000) + 1;
}

/** „Nur noch heute“, „Noch bis morgen“, „Noch 12 Tage“; ohne Ende oder schon vorbei: null. */
export function countdownText(bis: string | null, heute: string): string | null {
  if (!bis) return null;
  const n = restTage(bis, heute);
  if (n < 1) return null;
  if (n === 1) return "Nur noch heute";
  if (n === 2) return "Noch bis morgen";
  return `Noch ${n} Tage`;
}

/** „1.10.2026 bis 15.11.2026“, „ab 1.10.2026“ */
export function laufzeitText(a: Pick<Angebot, "von" | "bis">): string {
  return a.bis ? `${datum(a.von)} bis ${datum(a.bis)}` : `ab ${datum(a.von)}, ohne Ende`;
}
