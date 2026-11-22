import { createHash } from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";
import { db, dbRoh } from "@/lib/supabase/admin";
import { freieTermine, gesamtDauer, MAX_LEISTUNGEN } from "@/lib/termine";
import { istDatum } from "@/lib/zeit";

/**
 * Offene Schnittstelle für Automatisierungen (n8n, Make, eigene Skripte). Zugriff mit API-Schlüssel aus
 * Einstellungen → Schnittstellen. Antworten sind JSON, Listen haben höchstens 500 Einträge.
 */
async function schluesselPruefen(request: NextRequest): Promise<string[] | null> {
  const roh = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!/^flc_[0-9a-f]{48}$/.test(roh)) return null;
  const hash = createHash("sha256").update(roh).digest("hex");
  const { data } = await db().from("api_schluessel").select("id, rechte").eq("hash", hash).is("widerrufen_am", null).maybeSingle();
  if (!data) return null;
  await db().from("api_schluessel").update({ zuletzt_benutzt: new Date().toISOString() }).eq("id", data.id);
  return data.rechte as string[];
}

const fehler = (status: number, text: string) => NextResponse.json({ fehler: text }, { status });

export async function GET(request: NextRequest, { params }: { params: Promise<{ pfad: string[] }> }) {
  const rechte = await schluesselPruefen(request);
  if (!rechte?.includes("lesen")) return fehler(401, "API-Schlüssel fehlt oder ist ungültig");
  const [ressource, id] = (await params).pfad;
  const q = request.nextUrl.searchParams;
  const limit = Math.min(Number(q.get("limit")) || 100, 500);

  switch (ressource) {
    case "termine": {
      let a = dbRoh().from("termine").select("id, nummer, status, beginn, ende, leistung_name, quelle, auftrag_status, kunde:kunden(id, name, email, telefon), fahrzeug:fahrzeuge(kennzeichen, marke_modell)").order("beginn", { ascending: false }).limit(limit);
      if (id) a = a.eq("id", id);
      if (q.get("status")) a = a.eq("status", q.get("status")!);
      if (q.get("von")) a = a.gte("beginn", q.get("von")!);
      if (q.get("bis")) a = a.lt("beginn", q.get("bis")!);
      const { data, error } = await a;
      return error ? fehler(400, error.message) : NextResponse.json({ daten: data });
    }
    case "kunden": {
      let a = dbRoh().from("kunden").select("id, nummer, name, firma, email, telefon, strasse, plz, ort, erstellt_am, fahrzeuge(kennzeichen, marke_modell)").order("erstellt_am", { ascending: false }).limit(limit);
      if (id) a = a.eq("id", id);
      const { data, error } = await a;
      return error ? fehler(400, error.message) : NextResponse.json({ daten: data });
    }
    case "rechnungen": {
      let a = dbRoh().from("rechnungen").select("id, nummer, status, rechnungsdatum, faellig_am, bezahlt_am, summe_netto_cent, summe_mwst_cent, summe_brutto_cent, empfaenger, termin_id, kunde_id").not("nummer", "is", null).order("gestellt_am", { ascending: false }).limit(limit);
      if (id) a = a.eq("id", id);
      if (q.get("status")) a = a.eq("status", q.get("status")!);
      const { data, error } = await a;
      return error ? fehler(400, error.message) : NextResponse.json({ daten: data });
    }
    case "ereignisse": {
      let a = dbRoh().from("ereignisse").select("id, typ, daten, erstellt_am").order("id").limit(limit);
      if (q.get("nach")) a = a.gt("id", Number(q.get("nach")) || 0);
      if (q.get("typ")) a = a.eq("typ", q.get("typ")!);
      const { data, error } = await a;
      return error ? fehler(400, error.message) : NextResponse.json({ daten: data });
    }
    case "frei": {
      const von = q.get("von") ?? "";
      if (!istDatum(von)) return fehler(400, "von=JJJJ-MM-TT fehlt");
      // Mehrere Leistungen mit Komma: leistung=radwechsel,oelwechsel (Dauer ist die Summe)
      const slugs = [...new Set((q.get("leistung") ?? "").split(",").map((x) => x.trim()).filter(Boolean))].slice(0, MAX_LEISTUNGEN);
      const { data: l } = slugs.length ? await db().from("leistungen").select("id, dauer_min").in("slug", slugs) : { data: [] };
      if (!l?.length || l.length !== slugs.length) return fehler(404, "Leistung unbekannt");
      return NextResponse.json({ daten: await freieTermine({ dauer_min: gesamtDauer(l), ids: l.map((x) => x.id as string) }, von, Math.min(Number(q.get("tage")) || 7, 31)) });
    }
    default:
      return fehler(404, "Unbekannt. Verfügbar: termine, kunden, rechnungen, ereignisse, frei");
  }
}
