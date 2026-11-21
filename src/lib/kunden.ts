import "server-only";
import { MARKEN, markeModellTrennen } from "./rechnung/aehnlich";
import type { Empfaenger } from "./rechnung/rechnungen";
import { db } from "./supabase/admin";

export type KundenFahrzeug = { id: string; kennzeichen: string; marke_modell: string; marke: string; modell: string; km_stand: number | null };

export type KundenTreffer = {
  id: string;
  nummer: number;
  name: string;
  firma: string;
  telefon: string;
  email: string;
  strasse: string;
  plz: string;
  ort: string;
  ust_id: string;
  leitweg_id: string;
  fahrzeuge: KundenFahrzeug[];
  /** Bei einer Suche nach Kennzeichen: die Fahrzeuge, die getroffen wurden (die Auswahl zeigt dann nur diese). */
  passend?: string[];
};

const SPALTEN = "id, nummer, name, firma, telefon, email, strasse, plz, ort, ust_id, leitweg_id, fahrzeuge(id, kennzeichen, marke_modell, marke, modell, km_stand)";

/** Suchtext für PostgREST-Filter entschärfen: Komma, Klammern und % hätten dort eine Bedeutung. */
export const suchText = (q: string) => q.replace(/[,()%*\\]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);

/**
 * Kunden nach Name, Firma, Telefon, E-Mail, Kundennummer oder Kennzeichen („of ab 123“ findet „OF-AB 123“).
 * Ohne Suchtext: die zuletzt bearbeiteten Kunden. Dient der Kundenauswahl für Rechnung und Kostenvoranschlag.
 */
export async function kundenSuchen(q: string, limit = 8): Promise<KundenTreffer[]> {
  const such = suchText(q);
  let abfrage = db().from("kunden").select(SPALTEN).order("aktualisiert_am", { ascending: false }).limit(limit);
  const norm = such.toUpperCase().replace(/[^A-ZÄÖÜ0-9]/g, "");
  if (such) {
    const { data: fz } = norm.length >= 2 ? await db().from("fahrzeuge").select("kunde_id").ilike("kennzeichen_norm", `%${norm}%`).limit(50) : { data: [] };
    const ids = (fz ?? []).map((f) => f.kunde_id).filter(Boolean);
    // Telefonnummern stehen mal mit, mal ohne Leerzeichen: nur die Ziffern vergleichen wäre schöner,
    // braucht aber eine eigene Spalte. Die letzten Ziffern treffen in der Praxis fast immer.
    const ziffern = such.replace(/\D/g, "");
    abfrage = abfrage.or(
      [
        `name.ilike.%${such}%`,
        `firma.ilike.%${such}%`,
        `email.ilike.%${such}%`,
        `telefon.ilike.%${such}%`,
        ...(ziffern.length >= 4 && ziffern !== such ? [`telefon.ilike.%${ziffern.slice(-6)}%`] : []),
        ...(/^\d{5}$/.test(such) ? [`nummer.eq.${such}`] : []),
        ...(ids.length ? [`id.in.(${ids.join(",")})`] : []),
      ].join(","),
    );
  }
  const { data, error } = await abfrage;
  if (error) throw new Error(error.message);
  const passt = (f: KundenFahrzeug) => norm.length >= 2 && f.kennzeichen.toUpperCase().replace(/[^A-ZÄÖÜ0-9]/g, "").includes(norm);
  return ((data ?? []) as unknown as KundenTreffer[]).map((k) => {
    const fahrzeuge = [...(k.fahrzeuge ?? [])].sort((a, b) => a.kennzeichen.localeCompare(b.kennzeichen));
    const passend = fahrzeuge.filter(passt).map((f) => f.id);
    return { ...k, fahrzeuge, ...(passend.length ? { passend } : {}) };
  });
}

export async function kundeLaden(id: string): Promise<KundenTreffer | null> {
  const { data } = await db().from("kunden").select(SPALTEN).eq("id", id).maybeSingle();
  return (data as unknown as KundenTreffer | null) ?? null;
}

/** Empfänger eines Belegs aus den Stammdaten des Kunden. */
export function alsEmpfaenger(k: Pick<KundenTreffer, "name" | "firma" | "strasse" | "plz" | "ort" | "email" | "ust_id" | "leitweg_id">): Empfaenger {
  return { name: k.name, firma: k.firma, strasse: k.strasse, plz: k.plz, ort: k.ort, email: k.email, ust_id: k.ust_id, leitweg_id: k.leitweg_id };
}

/** Marke und Modell eines Fahrzeugs; ältere Einträge haben nur den gemeinsamen Text und werden getrennt. */
export function markeUndModell(f: Pick<KundenFahrzeug, "marke_modell"> & Partial<Pick<KundenFahrzeug, "marke" | "modell">>) {
  return f.marke?.trim() || f.modell?.trim() ? { marke: f.marke ?? "", modell: f.modell ?? "" } : markeModellTrennen(f.marke_modell);
}

export function alsBelegFahrzeug(f: KundenFahrzeug | null | undefined) {
  return f ? { kennzeichen: f.kennzeichen, ...markeUndModell(f), km: f.km_stand } : {};
}

export type FahrzeugTypen = { marken: string[]; modelle: { marke: string; modell: string }[] };

/**
 * Vorschläge für die Felder Marke und Modell: was in der Kartei und bei gemerkten Preisen schon vorkommt,
 * dazu die gängigen Marken. Wer „VW“ tippt, bekommt so immer dieselbe Schreibweise angeboten.
 */
export async function fahrzeugTypen(): Promise<FahrzeugTypen> {
  const [fz, pg] = await Promise.all([
    db().from("fahrzeuge").select("marke, modell").neq("marke", "").order("aktualisiert_am", { ascending: false }).limit(2000),
    db().from("preis_gedaechtnis").select("marke, modell").order("aktualisiert_am", { ascending: false }).limit(2000),
  ]);
  const paare = new Map<string, { marke: string; modell: string }>();
  for (const z of [...(fz.data ?? []), ...(pg.data ?? [])] as { marke: string; modell: string }[]) {
    if (z.marke?.trim() && z.modell?.trim()) paare.set(`${z.marke.toLowerCase()}|${z.modell.toLowerCase()}`, { marke: z.marke.trim(), modell: z.modell.trim() });
  }
  const modelle = [...paare.values()].sort((a, b) => a.marke.localeCompare(b.marke, "de") || a.modell.localeCompare(b.modell, "de"));
  const marken = [...new Map([...MARKEN, ...modelle.map((m) => m.marke)].map((m) => [m.toLowerCase(), m])).values()].sort((a, b) => a.localeCompare(b, "de"));
  return { marken, modelle };
}
