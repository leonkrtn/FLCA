import { createHash } from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase/admin";
import { freieTermine } from "@/lib/termine";
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
      let a = db().from("termine").select("id, nummer, status, beginn, ende, leistung_name, quelle, auftrag_status, kunde:kunden(id, name, email, telefon), fahrzeug:fahrzeuge(kennzeichen, marke_modell)").order("beginn", { ascending: false }).limit(limit);
      if (id) a = a.eq("id", id);
      if (q.get("status")) a = a.eq("status", q.get("status")!);
      if (q.get("von")) a = a.gte("beginn", q.get("von")!);
      if (q.get("bis")) a = a.lt("beginn", q.get("bis")!);
      const { data, error } = await a;
      return error ? fehler(400, error.message) : NextResponse.json({ daten: data });
    }
    case "kunden": {
      let a = db().from("kunden").select("id, nummer, name, firma, email, telefon, strasse, plz, ort, erstellt_am, fahrzeuge(kennzeichen, marke_modell)").order("erstellt_am", { ascending: false }).limit(limit);
      if (id) a = a.eq("id", id);
      const { data, error } = await a;
      return error ? fehler(400, error.message) : NextResponse.json({ daten: data });
    }
    case "rechnungen": {
      let a = db().from("rechnungen").select("id, nummer, status, rechnungsdatum, faellig_am, bezahlt_am, summe_netto_cent, summe_mwst_cent, summe_brutto_cent, empfaenger, termin_id, kunde_id").not("nummer", "is", null).order("gestellt_am", { ascending: false }).limit(limit);
      if (id) a = a.eq("id", id);
      if (q.get("status")) a = a.eq("status", q.get("status")!);
      const { data, error } = await a;
      return error ? fehler(400, error.message) : NextResponse.json({ daten: data });
    }
    case "ereignisse": {
      let a = db().from("ereignisse").select("id, typ, daten, erstellt_am").order("id").limit(limit);
      if (q.get("nach")) a = a.gt("id", Number(q.get("nach")) || 0);
      if (q.get("typ")) a = a.eq("typ", q.get("typ")!);
      const { data, error } = await a;
      return error ? fehler(400, error.message) : NextResponse.json({ daten: data });
    }
    case "frei": {
      const von = q.get("von") ?? "";
      if (!istDatum(von)) return fehler(400, "von=JJJJ-MM-TT fehlt");
      const { data: l } = await db().from("leistungen").select("dauer_min").eq("slug", q.get("leistung") ?? "").maybeSingle();
      if (!l) return fehler(404, "Leistung unbekannt");
      return NextResponse.json({ daten: await freieTermine(l, von, Math.min(Number(q.get("tage")) || 7, 31)) });
    }
    default:
      return fehler(404, "Unbekannt. Verfügbar: termine, kunden, rechnungen, ereignisse, frei");
  }
}
