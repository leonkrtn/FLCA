import "server-only";
import { db } from "../supabase/admin";
import { besterTreffer, fahrzeugSchluessel, markeModellTrennen, textNorm } from "./aehnlich";
import { istAlt, istRabatt, type Position } from "./berechnung";
import type { Rechnung } from "./rechnungen";

/** Ein gemerkter Preis: die Position, wie sie zuletzt bei diesem Fahrzeugtyp berechnet wurde. */
export type Gemerkt = {
  id: string;
  marke: string;
  modell: string;
  text: string;
  text_norm: string;
  einheit: string;
  menge: number;
  einzel_netto_cent: number;
  mwst_satz: number;
  lohnart: string | null;
  ek_cent: number | null;
  aufschlag: number | null;
  artikel_id: string | null;
  aktualisiert_am: string;
};

export type Paket = {
  id: string;
  name: string;
  marke: string;
  modell: string;
  marke_norm: string;
  modell_norm: string;
  positionen: Position[];
  aktualisiert_am: string;
};

/** Beim Stellen benannt: ein Paket aus den Positionen mit diesen Nummern (Index im Beleg). */
export type PaketWunsch = { name: string; indizes: number[] };

const zahlOderNull = (x: unknown) => (x == null ? null : Number(x));

function alsGemerkt(z: Record<string, unknown>): Gemerkt {
  return {
    ...(z as unknown as Gemerkt),
    menge: Number(z.menge),
    einzel_netto_cent: Number(z.einzel_netto_cent),
    mwst_satz: Number(z.mwst_satz),
    ek_cent: zahlOderNull(z.ek_cent),
    aufschlag: zahlOderNull(z.aufschlag),
  };
}

/** Marke und Modell eines Belegs. Ältere Belege kennen nur den gemeinsamen Text „VW Golf“. */
export function belegTyp(f: Rechnung["fahrzeug"] | null | undefined): { marke: string; modell: string } {
  if (!f) return { marke: "", modell: "" };
  return f.marke?.trim() ? { marke: f.marke.trim(), modell: (f.modell ?? "").trim() } : markeModellTrennen(f.modell ?? "");
}

/** Gemerkte Preise für Marke + Modell, jüngste zuerst. Ohne Marke oder Modell: keine (dann gilt nur die Preisliste). */
export async function gemerktFuer(marke: string, modell: string): Promise<Gemerkt[]> {
  const s = fahrzeugSchluessel(marke, modell);
  if (!s) return [];
  const { data, error } = await db()
    .from("preis_gedaechtnis")
    .select("*")
    .eq("marke_norm", s.marke_norm)
    .eq("modell_norm", s.modell_norm)
    .order("aktualisiert_am", { ascending: false })
    .limit(1000);
  if (error) throw new Error(error.message);
  return (data ?? []).map(alsGemerkt);
}

export async function paketeListe(): Promise<Paket[]> {
  const { data, error } = await db().from("pakete").select("*").order("aktualisiert_am", { ascending: false }).limit(500);
  if (error) throw new Error(error.message);
  return (data ?? []) as Paket[];
}

/** Bezeichnungen für die Vorschläge beim Tippen: alles, was schon einmal berechnet wurde, jüngste zuerst. */
export async function bezeichnungen(): Promise<string[]> {
  const { data } = await db().from("preis_gedaechtnis").select("text").order("aktualisiert_am", { ascending: false }).limit(1500);
  const gesehen = new Map<string, string>();
  for (const z of data ?? []) {
    const n = textNorm(z.text);
    if (n && !gesehen.has(n)) gesehen.set(n, z.text);
  }
  return [...gesehen.values()].slice(0, 400);
}

/** Was von einer Position gemerkt wird (ohne Rabatt, ohne alte Brutto-Positionen, ohne Preis 0). */
/** Ein Angebotspreis gilt nur auf Zeit; gemerkt würde er nach dem Angebot als Preis für das Auto wieder auftauchen. */
function merkbar(p: Position): boolean {
  return !istRabatt(p) && !istAlt(p) && !p.angebot && Boolean(p.text?.trim()) && (p.einzel_netto_cent ?? 0) > 0 && p.menge > 0;
}

/**
 * Nach dem Stellen einer Rechnung: jede Position für Marke + Modell merken, der jüngste Preis gewinnt.
 * Gleiche oder sehr ähnliche Bezeichnungen überschreiben den älteren Eintrag, statt einen zweiten anzulegen.
 * Dazu die beim Stellen benannten Pakete. Stornos merken nichts.
 *
 * Läuft nach dem Stellen und darf es nie scheitern lassen: Fehler landen im Log.
 */
export async function merken(r: Rechnung, pakete: PaketWunsch[] = []): Promise<void> {
  if (r.storno_zu || r.status === "entwurf") return;
  const typ = belegTyp(r.fahrzeug);
  const s = fahrzeugSchluessel(typ.marke, typ.modell);

  if (s) {
    const vorhanden = await gemerktFuer(typ.marke, typ.modell);
    // Kommt dieselbe Bezeichnung zweimal vor, zählt die letzte Zeile.
    const jeText = new Map<string, Position>();
    for (const p of r.positionen.filter(merkbar)) jeText.set(textNorm(p.text), p);

    for (const [text_norm, p] of jeText) {
      const zeile = {
        marke: typ.marke,
        modell: typ.modell,
        ...s,
        text: p.text.trim().slice(0, 300),
        einheit: p.einheit,
        menge: p.menge,
        einzel_netto_cent: p.einzel_netto_cent,
        mwst_satz: p.mwst_satz,
        lohnart: p.einheit === "Std" ? (p.lohnart ?? null) : null,
        ek_cent: p.ek_cent ?? null,
        aufschlag: p.ek_cent != null ? (p.aufschlag ?? null) : null,
        artikel_id: p.artikel_id ?? null,
        rechnung_id: r.id,
      };
      const treffer = vorhanden.find((v) => v.text_norm === text_norm) ?? besterTreffer(p.text, vorhanden);
      const { error } = treffer
        ? await db().from("preis_gedaechtnis").update({ ...zeile, text_norm: treffer.text_norm }).eq("id", treffer.id)
        : await db().from("preis_gedaechtnis").upsert({ ...zeile, text_norm }, { onConflict: "marke_norm,modell_norm,text_norm" });
      if (error) console.error("Preis nicht gemerkt", p.text, error.message);
    }

    // Altbestand ohne getrennte Marke/Modell: beim ersten Beleg nachtragen, ohne dass jemand die Kartei pflegt.
    const kz = (r.fahrzeug?.kennzeichen ?? "").toUpperCase().replace(/[^A-ZÄÖÜ0-9]/g, "");
    if (kz) {
      await db()
        .from("fahrzeuge")
        .update({ marke: typ.marke, modell: typ.modell, marke_modell: `${typ.marke} ${typ.modell}`.trim() })
        .eq("kennzeichen_norm", kz)
        .eq("marke", "");
    }
  }

  for (const w of pakete) {
    const name = w.name.trim().slice(0, 120);
    const positionen = [...new Set(w.indizes)]
      .filter((i) => Number.isInteger(i) && i >= 0 && i < r.positionen.length)
      .sort((a, b) => a - b)
      .map((i) => r.positionen[i])
      .filter((p) => !istRabatt(p) && !istAlt(p));
    if (!name || !positionen.length) continue;
    const { error } = await db()
      .from("pakete")
      .upsert(
        {
          name,
          name_norm: textNorm(name),
          marke: s ? typ.marke : "",
          modell: s ? typ.modell : "",
          marke_norm: s?.marke_norm ?? "",
          modell_norm: s?.modell_norm ?? "",
          positionen,
          rechnung_id: r.id,
        },
        { onConflict: "name_norm,marke_norm,modell_norm" },
      );
    if (error) console.error("Paket nicht gemerkt", name, error.message);
  }
}
