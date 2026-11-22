import { datumZeit, euro } from "./format";
import { berechne, nettoAusBruttoPreis, type Position } from "./rechnung/berechnung";

/**
 * Regeln des Werkstattauftrags ohne Datenbank: Stand, Texte, Kostengrenze, Fahrzeugannahme und die
 * Positionen aus den Leistungen eines Termins. Läuft im Browser und auf dem Server; getestet.
 */

export type ErteiltWie = "unterschrift" | "online" | "kostenvoranschlag";

/** Fahrzeugannahme. Alles freiwillig; km steht am Termin, FIN, HSN, TSN und Erstzulassung am Fahrzeug. */
export type Annahme = { tank?: string; schluessel?: number | null; vorschaeden?: string };

export type AuftragFelder = {
  auftrag_nummer?: string | null;
  auftrag_angelegt_am?: string | null;
  auftrag_positionen?: Position[];
  auftrag_summe_brutto_cent?: number;
  auftrag_kostengrenze_cent?: number | null;
  auftrag_beschreibung?: string;
  annahme?: Annahme | null;
  auftrag_gesendet_am?: string | null;
  auftrag_gesendet_an?: string | null;
  auftrag_erteilt_am?: string | null;
  auftrag_erteilt_wie?: ErteiltWie | null;
  auftrag_erteilt_name?: string;
  auftrag_erteilt_brutto_cent?: number | null;
};

export const TANKSTAENDE = ["Reserve", "1/4", "1/2", "3/4", "voll"] as const;

/** kein = nicht angelegt; offen = angelegt, nicht erteilt; beim_kunden = zur Freigabe gesendet; erteilt */
export type AuftragStand = "kein" | "offen" | "beim_kunden" | "erteilt";

export function auftragStand(t: AuftragFelder): AuftragStand {
  if (!t.auftrag_nummer) return "kein";
  if (t.auftrag_erteilt_am) return "erteilt";
  return t.auftrag_gesendet_am ? "beim_kunden" : "offen";
}

export const AUFTRAG_STAND_TEXT: Record<AuftragStand, string> = {
  kein: "Kein Auftrag",
  offen: "Nicht erteilt",
  beim_kunden: "Beim Kunden",
  erteilt: "Erteilt",
};

export const AUFTRAG_STAND_TON: Record<AuftragStand, "warnung" | "hell" | "ok" | "neutral"> = {
  kein: "hell",
  offen: "warnung",
  beim_kunden: "warnung",
  erteilt: "ok",
};

const WIE: Record<ErteiltWie, string> = {
  unterschrift: "per Unterschrift",
  online: "online über den Terminlink",
  kostenvoranschlag: "durch Annahme des Kostenvoranschlags",
};

/** „Erteilt am 21.11.2026, 10:15 per Unterschrift (Max Muster)“ */
export function erteiltText(t: AuftragFelder): string {
  if (!t.auftrag_erteilt_am) return "";
  const name = t.auftrag_erteilt_name?.trim();
  return `Erteilt am ${datumZeit(t.auftrag_erteilt_am)} ${t.auftrag_erteilt_wie ? WIE[t.auftrag_erteilt_wie] : ""}${name ? ` (${name})` : ""}`.replace(/\s+/g, " ").trim();
}

/** Um so viel Cent liegt der Auftrag über der Kostengrenze; null = keine Grenze oder darunter. */
export function ueberKostengrenze(t: Pick<AuftragFelder, "auftrag_kostengrenze_cent" | "auftrag_summe_brutto_cent">): number | null {
  const grenze = t.auftrag_kostengrenze_cent;
  if (grenze == null) return null;
  const mehr = (t.auftrag_summe_brutto_cent ?? 0) - grenze;
  return mehr > 0 ? mehr : null;
}

/** Hinweis für Werkstatt und Büro, wenn der Auftrag (nach Ergänzungen) über die Grenze geht. */
export function grenzeText(t: Pick<AuftragFelder, "auftrag_kostengrenze_cent" | "auftrag_summe_brutto_cent">): string {
  const mehr = ueberKostengrenze(t);
  return mehr ? `${euro(mehr)} über der Kostengrenze von ${euro(t.auftrag_kostengrenze_cent!)}. Bitte mit dem Kunden absprechen.` : "";
}

/** Was aus Formular oder JSON kommt, auf erlaubte Werte bringen. */
export function annahmeAus(roh: { tank?: unknown; schluessel?: unknown; vorschaeden?: unknown } | null | undefined): Annahme {
  const tank = String(roh?.tank ?? "").trim();
  const schluessel = Number(String(roh?.schluessel ?? "").trim() || NaN);
  return {
    tank: (TANKSTAENDE as readonly string[]).includes(tank) ? tank : "",
    schluessel: Number.isInteger(schluessel) && schluessel >= 0 && schluessel <= 20 ? schluessel : null,
    vorschaeden: String(roh?.vorschaeden ?? "").trim().slice(0, 1500),
  };
}

type FahrzeugDaten = { fin?: string | null; hsn?: string | null; tsn?: string | null; erstzulassung?: string | null };

/** Die ausgefüllten Angaben der Annahme als Zeilen (PDF, Detailseite). Leere Angaben fallen weg. */
export function annahmeZeilen(a: Annahme | null | undefined, km: number | null | undefined, f?: FahrzeugDaten | null): [string, string][] {
  const zeilen: [string, string | null | undefined][] = [
    ["Kilometerstand", km != null ? new Intl.NumberFormat("de-DE").format(km) : ""],
    ["Tank / Ladung", a?.tank],
    ["Schlüssel", a?.schluessel != null ? String(a.schluessel) : ""],
    ["FIN", f?.fin],
    ["HSN / TSN", [f?.hsn, f?.tsn].filter(Boolean).join(" / ")],
    ["Erstzulassung", f?.erstzulassung],
    ["Vorschäden", a?.vorschaeden],
  ];
  return zeilen.filter((z): z is [string, string] => Boolean(z[1]?.trim()));
}

/** Summe brutto einer Positionsliste (gleiche Rechnung wie Beleg und PDF). */
export const bruttoVon = (positionen: Position[]) => berechne(positionen).brutto;

type LeistungFuerBeleg = { id: string; name: string; preis_cent: number | null; einheit?: string | null; mwst_satz?: number | string | null };
/** Am Termin festgehaltener Angebotspreis je Leistung (siehe angebote/preise.ts) */
type AngebotAmTermin = { titel: string; cent: number | null };

/**
 * Positionen aus den Leistungen eines Termins: jede Leistung mit ihrem Festpreis aus der Preisliste (dort
 * brutto und rund, im Beleg netto so genau, dass brutto derselbe Betrag herauskommt). Frei eingetragene
 * Arbeit steht hinter den Namen der Leistungen in leistung_name und wird eine Zeile ohne Preis. Wurde eine
 * Leistung während eines Angebots angefragt, gilt der am Termin festgehaltene Angebotspreis.
 */
export function positionenAusLeistungen(leistungen: LeistungFuerBeleg[], leistungName: string, angebote: Record<string, AngebotAmTermin> = {}): Position[] {
  const positionen: Position[] = leistungen.map((l) => {
    const a = angebote[l.id]?.cent != null ? angebote[l.id] : null;
    return {
      text: l.name,
      menge: 1,
      einheit: l.einheit ?? "Pauschal",
      einzel_netto_cent: nettoAusBruttoPreis(a?.cent ?? l.preis_cent ?? 0, Number(l.mwst_satz ?? 19)),
      mwst_satz: Number(l.mwst_satz ?? 19),
      artikel_id: l.id,
      ...(a && { angebot: a.titel }),
    };
  });
  const namen = leistungen.map((l) => l.name).join(", ");
  const name = String(leistungName ?? "");
  const frei = !namen ? name : name.startsWith(`${namen}, `) ? name.slice(namen.length + 2) : "";
  if (frei || !positionen.length) positionen.push({ text: frei || name || "Arbeit", menge: 1, einheit: "Pauschal", einzel_netto_cent: 0, mwst_satz: 19 });
  return positionen;
}

/** Erfasste Arbeitszeit eines Auftrags in Minuten; laufende Einträge zählen bis `jetzt`. */
export function arbeitsMinuten(zeiten: { beginn: string; ende: string | null }[], jetzt = Date.now()): number {
  return Math.round(zeiten.reduce((s, z) => s + Math.max(0, (z.ende ? new Date(z.ende).getTime() : jetzt) - new Date(z.beginn).getTime()), 0) / 60000);
}

/**
 * Erfasste Arbeitszeit in den Rechnungsentwurf: Lohnpositionen (Einheit „Std“) ohne Menge bekommen die Stunden,
 * auf Viertelstunden aufgerundet. Feste Preise aus der Preisliste bleiben, wie sie sind, damit nichts doppelt
 * berechnet wird. Gibt die Positionen zurück und ob etwas eingesetzt wurde.
 */
export function lohnEinsetzen(positionen: Position[], minuten: number): { positionen: Position[]; eingesetzt: boolean } {
  if (minuten <= 0) return { positionen, eingesetzt: false };
  const stunden = Math.ceil(minuten / 15) / 4;
  let eingesetzt = false;
  const neu = positionen.map((p) => {
    if (p.rabatt || p.einheit.toLowerCase() !== "std" || p.menge > 0) return p;
    eingesetzt = true;
    return { ...p, menge: stunden };
  });
  // Ohne Änderung dasselbe Array: Aufrufer erkennen daran übernommene Positionen (z. B. aus dem KV)
  return { positionen: eingesetzt ? neu : positionen, eingesetzt };
}
