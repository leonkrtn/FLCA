import "server-only";
import { melden } from "./ereignisse";
import { kennzeichen as kennzeichenFormat } from "./format";
import { MARKEN, markeModellTrennen } from "./rechnung/aehnlich";
import type { Empfaenger, Rechnung } from "./rechnung/rechnungen";
import { db, DbFehler } from "./supabase/admin";

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
  if (error) throw new DbFehler(error);
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

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Vorauswahl aus der Adresse (`?kunde=…&fz=…`), etwa von der Kundenseite oder vom Sprechen. Das Fahrzeug
 * nur, wenn es diesem Kunden gehört; hat er genau eins, dieses.
 */
export async function kundenWahl(kundeId: unknown, fahrzeugId?: unknown): Promise<{ kunde: KundenTreffer; fahrzeug: KundenFahrzeug | null } | null> {
  if (typeof kundeId !== "string" || !UUID.test(kundeId)) return null;
  const kunde = await kundeLaden(kundeId);
  if (!kunde) return null;
  const fahrzeug = kunde.fahrzeuge.find((f) => f.id === fahrzeugId) ?? (kunde.fahrzeuge.length === 1 ? kunde.fahrzeuge[0] : null);
  return { kunde, fahrzeug };
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

const STAMM = ["firma", "email", "strasse", "plz", "ort", "ust_id", "leitweg_id"] as const;
const gleich = (a?: string | null, b?: string | null) => (a ?? "").trim().toLowerCase() === (b ?? "").trim().toLowerCase();
/** Für ilike ohne Platzhalter: % und _ im Namen sind Zeichen, keine Muster. */
const genau = (s: string) => s.replace(/[\\%_]/g, (z) => `\\${z}`);

/**
 * Kunde zu einem Beleg ohne Kunden (Empfänger von Hand eingetippt, per Sprache ohne Treffer). Läuft beim
 * Stellen bzw. Abschließen, nicht bei jedem Speichern des Entwurfs, damit halb getippte Namen nicht in der
 * Kartei landen. Erst wird gesucht, damit niemand doppelt entsteht: gleiche E-Mail, sonst gleicher Name
 * (bzw. Firma), der zur Adresse oder zum Kennzeichen passt. Gefunden: Leere Felder der Kartei werden
 * ergänzt, nichts überschrieben. Sonst neu angelegt, mit Fahrzeug, wenn das Kennzeichen noch unbekannt ist
 * (ein bekanntes Auto wird nicht umgehängt: Wer die Rechnung bekommt, muss nicht der Halter sein).
 */
export async function kundeAusBeleg(e: Empfaenger, f: Rechnung["fahrzeug"] | null | undefined): Promise<string | null> {
  const name = e.name?.trim();
  if (!name) return null;
  const email = (e.email ?? "").trim().toLowerCase();
  const kz = kennzeichenFormat(f?.kennzeichen ?? "");
  const kzNorm = kz.replace(/[^A-ZÄÖÜ0-9]/g, "");
  const { data: auto } = kzNorm ? await db().from("fahrzeuge").select("id, kunde_id").eq("kennzeichen_norm", kzNorm).maybeSingle() : { data: null };

  type Treffer = { id: string } & Record<(typeof STAMM)[number] | "name", string>;
  let kunde: Treffer | null = null;
  if (email) {
    const { data } = await db().from("kunden").select("id, name, " + STAMM.join(", ")).ilike("email", genau(email)).limit(1).maybeSingle();
    kunde = data as unknown as Treffer | null;
  }
  if (!kunde) {
    const { data } = await db().from("kunden").select("id, name, " + STAMM.join(", ")).ilike("name", genau(name)).limit(10);
    const gleicheNamen = ((data ?? []) as unknown as Treffer[]).filter((k) => !e.firma || !k.firma || gleich(k.firma, e.firma));
    // Passt die Adresse (oder gehört das Auto ihm), ist es derselbe; ohne Adresse im Beleg reicht ein eindeutiger Name
    const passend = gleicheNamen.filter((k) => (auto?.kunde_id === k.id) || (e.strasse && gleich(k.strasse, e.strasse)) || (e.plz && gleich(k.plz, e.plz) && (!e.strasse || !k.strasse)));
    // Ein eindeutiger Name reicht auch, wenn der Beleg eine Adresse hat, die Kartei aber noch keine (Kunde kam
    // über eine Anfrage mit Name und Telefon): Dann ist es derselbe, und die Adresse wird ergänzt.
    const ohneAdresse = gleicheNamen.length === 1 && !gleicheNamen[0].strasse?.trim() && !gleicheNamen[0].plz?.trim();
    kunde = passend.length === 1 ? passend[0] : gleicheNamen.length === 1 && ((!e.strasse && !e.plz) || ohneAdresse) ? gleicheNamen[0] : null;
  }

  let id: string;
  if (kunde) {
    id = kunde.id;
    const ergaenzen = Object.fromEntries(STAMM.filter((k) => !kunde![k]?.trim() && (k === "email" ? email : e[k]?.trim())).map((k) => [k, k === "email" ? email : e[k]!.trim()]));
    if (Object.keys(ergaenzen).length) await db().from("kunden").update(ergaenzen).eq("id", id);
  } else {
    const { data: neu, error } = await db()
      .from("kunden")
      .insert({ name, ...Object.fromEntries(STAMM.map((k) => [k, k === "email" ? email : (e[k] ?? "").trim()])) })
      .select("id, nummer")
      .single();
    if (error || !neu) throw new Error(`Kunde konnte nicht angelegt werden: ${error?.message ?? "unbekannt"}`);
    id = neu.id;
    await melden("kunde.angelegt", { kunde_id: neu.id, nummer: neu.nummer, name, quelle: "beleg" });
  }

  if (kz && !auto) {
    const markeModell = [f?.marke, f?.modell].filter(Boolean).join(" ").trim();
    await db()
      .from("fahrzeuge")
      .insert({ kunde_id: id, kennzeichen: kz, marke_modell: markeModell, marke: f?.marke ?? "", modell: f?.modell ?? "", ...(f?.km ? { km_stand: f.km } : {}) });
  }
  return id;
}
