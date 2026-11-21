import "server-only";
import { db } from "../supabase/admin";
import { istDatum } from "../zeit";
import { centGenau, nettoAusBruttoPreis, type Position } from "./berechnung";
import type { PaketWunsch } from "./preisgedaechtnis";
import type { Empfaenger } from "./rechnungen";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Prüft, was der Beleg-Editor schickt (Rechnung und Kostenvoranschlag). Der Editor rechnet im Browser,
 * gespeichert wird aber nur, was hier durchkommt: Texte gekürzt, Mengen und Preise als Zahlen.
 */
export function positionenAus(roh: unknown): Position[] {
  if (!Array.isArray(roh)) throw new Error("Positionen fehlen.");
  return roh.slice(0, 100).map((p): Position => {
    const satz = [0, 7, 19].includes(Number(p.mwst_satz)) ? Number(p.mwst_satz) : 19;
    const artikel_id = typeof p.artikel_id === "string" && UUID.test(p.artikel_id) ? p.artikel_id : null;
    // Rabattzeile: Prozent (0–100) oder fester Nettobetrag, gilt für alle anderen Positionen.
    if (p.rabatt) {
      const prozent = Number(p.rabatt.prozent);
      const betrag = Math.round(Number(p.rabatt.betrag_cent));
      const rabatt = Number.isFinite(prozent) && prozent > 0 ? { prozent: Math.min(Math.round(prozent * 100) / 100, 100) } : Number.isFinite(betrag) && betrag !== 0 ? { betrag_cent: betrag } : null;
      if (!rabatt) throw new Error("Bitte beim Rabatt Prozent oder Betrag angeben.");
      return { text: String(p.text ?? "").trim().slice(0, 120) || "Rabatt", menge: 1, einheit: "", einzel_netto_cent: 0, mwst_satz: 19, rabatt };
    }
    const menge = Number(p.menge);
    // Der Editor schickt netto; ein alter Entwurf, der noch brutto kommt, wird umgerechnet.
    const preis = p.einzel_netto_cent != null ? centGenau(Number(p.einzel_netto_cent)) : nettoAusBruttoPreis(Number(p.einzel_brutto_cent), satz);
    if (!String(p.text ?? "").trim()) throw new Error("Jede Position braucht eine Bezeichnung.");
    if (!Number.isFinite(menge) || menge <= 0) throw new Error(`Menge bei „${p.text}“ prüfen.`);
    if (!Number.isFinite(preis)) throw new Error(`Preis bei „${p.text}“ prüfen.`);
    const einheit = String(p.einheit ?? "Stk").slice(0, 20);
    const ek = p.ek_cent == null || p.ek_cent === "" ? null : centGenau(Number(p.ek_cent));
    const aufschlag = p.aufschlag == null || p.aufschlag === "" ? null : Number(p.aufschlag);
    return {
      text: String(p.text).slice(0, 300),
      menge: Math.round(menge * 1000) / 1000,
      einheit,
      einzel_netto_cent: preis,
      mwst_satz: satz,
      artikel_id,
      ...(einheit === "Std" && typeof p.lohnart === "string" && p.lohnart.trim() && { lohnart: p.lohnart.trim().slice(0, 40) }),
      ...(ek != null && Number.isFinite(ek) && ek > 0 && { ek_cent: ek, aufschlag: aufschlag != null && Number.isFinite(aufschlag) ? Math.round(aufschlag * 100) / 100 : null }),
    };
  });
}

/** Beim Stellen benannte Pakete: Name und die Nummern der Positionen, die dazugehören. */
export function paketeAus(roh: unknown): PaketWunsch[] {
  if (!Array.isArray(roh)) return [];
  return roh
    .slice(0, 10)
    .map((w) => ({
      name: String(w?.name ?? "").trim().slice(0, 120),
      indizes: Array.isArray(w?.indizes) ? w.indizes.map(Number).filter((i: number) => Number.isInteger(i) && i >= 0 && i < 100) : [],
    }))
    .filter((w) => w.name && w.indizes.length);
}

export const EMPFAENGER_FELDER = ["name", "firma", "strasse", "plz", "ort", "email", "ust_id", "leitweg_id"] as const;

/** Die gemeinsamen Felder eines Beleg-Entwurfs aus dem JSON des Editors. */
export function belegAus(roh: Record<string, unknown>) {
  const e = (roh.empfaenger ?? {}) as Record<string, unknown>;
  const f = (roh.fahrzeug ?? {}) as Record<string, unknown>;
  const empfaenger = Object.fromEntries(EMPFAENGER_FELDER.map((k) => [k, String(e[k] ?? "").trim().slice(0, 200)])) as Empfaenger;
  return {
    kunde_id: typeof roh.kunde_id === "string" && UUID.test(roh.kunde_id) ? roh.kunde_id : null,
    empfaenger,
    fahrzeug: {
      kennzeichen: String(f.kennzeichen ?? "").slice(0, 20),
      marke: String(f.marke ?? "").trim().slice(0, 60),
      modell: String(f.modell ?? "").trim().slice(0, 120),
      km: f.km ? Math.round(Number(f.km)) || null : null,
    },
    positionen: positionenAus(roh.positionen),
    hinweis: String(roh.hinweis ?? "").slice(0, 1000),
    datumOderNull: (k: string) => (istDatum(roh[k]) ? (roh[k] as string) : null),
  };
}

/**
 * Der Stand aus dem Editor für die PDF-Vorschau, ohne ihn zu speichern. Halb angelegte Zeilen ohne
 * Bezeichnung lässt die Vorschau weg, statt deswegen gar nichts zu zeigen; die Kundennummer kommt zum
 * gerade gewählten Kunden aus der Kartei.
 */
export async function vorschauAus(fd: FormData) {
  let roh: Record<string, unknown> = {};
  try {
    roh = JSON.parse(String(fd.get("daten") ?? "{}"));
  } catch {
    throw new Error("Die Angaben aus dem Formular sind unvollständig angekommen.");
  }
  const positionen = Array.isArray(roh.positionen) ? roh.positionen.filter((p) => p?.rabatt || String(p?.text ?? "").trim()) : [];
  const beleg = belegAus({ ...roh, positionen });
  const { data: kunde } = beleg.kunde_id ? await db().from("kunden").select("nummer").eq("id", beleg.kunde_id).maybeSingle() : { data: null };
  return { ...beleg, kunde: (kunde as { nummer: number } | null) ?? null };
}
