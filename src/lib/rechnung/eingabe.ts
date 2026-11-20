import "server-only";
import { istDatum } from "../zeit";
import type { Position } from "./berechnung";
import type { Empfaenger } from "./rechnungen";

/**
 * Prüft, was der Beleg-Editor schickt (Rechnung und Kostenvoranschlag). Der Editor rechnet im Browser,
 * gespeichert wird aber nur, was hier durchkommt: Texte gekürzt, Mengen und Preise als Zahlen.
 */
export function positionenAus(roh: unknown): Position[] {
  if (!Array.isArray(roh)) throw new Error("Positionen fehlen.");
  return roh.slice(0, 100).map((p) => {
    const menge = Number(p.menge);
    const preis = Math.round(Number(p.einzel_brutto_cent));
    if (!String(p.text ?? "").trim()) throw new Error("Jede Position braucht eine Bezeichnung.");
    if (!Number.isFinite(menge) || menge <= 0) throw new Error(`Menge bei „${p.text}“ prüfen.`);
    if (!Number.isFinite(preis)) throw new Error(`Preis bei „${p.text}“ prüfen.`);
    return {
      text: String(p.text).slice(0, 300),
      menge: Math.round(menge * 1000) / 1000,
      einheit: String(p.einheit ?? "Stk").slice(0, 20),
      einzel_brutto_cent: preis,
      mwst_satz: [0, 7, 19].includes(Number(p.mwst_satz)) ? Number(p.mwst_satz) : 19,
      artikel_id: typeof p.artikel_id === "string" ? p.artikel_id : null,
    };
  });
}

export const EMPFAENGER_FELDER = ["name", "firma", "strasse", "plz", "ort", "email", "ust_id", "leitweg_id"] as const;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Die gemeinsamen Felder eines Beleg-Entwurfs aus dem JSON des Editors. */
export function belegAus(roh: Record<string, unknown>) {
  const e = (roh.empfaenger ?? {}) as Record<string, unknown>;
  const f = (roh.fahrzeug ?? {}) as Record<string, unknown>;
  const empfaenger = Object.fromEntries(EMPFAENGER_FELDER.map((k) => [k, String(e[k] ?? "").trim().slice(0, 200)])) as Empfaenger;
  return {
    kunde_id: typeof roh.kunde_id === "string" && UUID.test(roh.kunde_id) ? roh.kunde_id : null,
    empfaenger,
    fahrzeug: { kennzeichen: String(f.kennzeichen ?? "").slice(0, 20), modell: String(f.modell ?? "").slice(0, 120), km: f.km ? Math.round(Number(f.km)) || null : null },
    positionen: positionenAus(roh.positionen),
    hinweis: String(roh.hinweis ?? "").slice(0, 1000),
    datumOderNull: (k: string) => (istDatum(roh[k]) ? (roh[k] as string) : null),
  };
}
