import { type NextRequest, NextResponse } from "next/server";
import { KONFIGURIERT } from "@/lib/env";
import { db } from "@/lib/supabase/admin";
import { kvPerToken } from "@/lib/rechnung/kostenvoranschlaege";
import { bedarfAusPositionen, freieTermine, gesamtDauer, MAX_LEISTUNGEN } from "@/lib/termine";
import { istDatum } from "@/lib/zeit";

/**
 * GET /api/termine/frei?leistung=<slug|id>[,<slug|id>…]&von=YYYY-MM-DD&tage=14 – freie Startzeiten je Tag.
 * Mehrere Leistungen werden nacheinander erledigt, gesucht wird also ein Zeitraum für die Summe der Dauern.
 * Mit ?kv=<Token> statt ?leistung: freie Zeiten für einen angenommenen Kostenvoranschlag (Kundenlink).
 */
export async function GET(request: NextRequest) {
  const p = request.nextUrl.searchParams;
  const von = p.get("von") ?? "";
  const tage = Math.min(Math.max(Number(p.get("tage")) || 14, 1), 31);
  const schluessel = p.get("leistung") ?? "";
  const kvToken = p.get("kv") ?? "";
  if (!istDatum(von) || (!schluessel && !kvToken)) return NextResponse.json({ fehler: "Parameter fehlen" }, { status: 400 });
  if (!KONFIGURIERT.supabaseAdmin) return NextResponse.json({ tage: [] });

  if (kvToken) {
    const kv = await kvPerToken(kvToken);
    if (!kv || kv.status !== "angenommen" || kv.termin_id) return NextResponse.json({ fehler: "Nicht buchbar" }, { status: 404 });
    const { bedarf } = await bedarfAusPositionen(kv.positionen.map((x) => x.artikel_id));
    return NextResponse.json({ tage: await freieTermine(bedarf, von, tage) }, { headers: { "cache-control": "no-store" } });
  }

  const auswahl = [...new Set(schluessel.split(",").map((x) => x.trim()).filter(Boolean))].slice(0, MAX_LEISTUNGEN + 1);
  if (auswahl.length > MAX_LEISTUNGEN) return NextResponse.json({ fehler: `Höchstens ${MAX_LEISTUNGEN} Leistungen` }, { status: 400 });
  const spalte = auswahl.every((x) => /^[0-9a-f-]{36}$/.test(x)) ? "id" : "slug";
  const { data } = await db().from("leistungen").select("id, dauer_min, online_anfragbar").in(spalte, auswahl).eq("sichtbar", true);
  const gefunden = data ?? [];
  if (gefunden.length !== auswahl.length || gefunden.some((l) => !l.online_anfragbar)) {
    return NextResponse.json({ fehler: "Leistung nicht buchbar" }, { status: 404 });
  }

  const ergebnis = await freieTermine({ dauer_min: gesamtDauer(gefunden), ids: gefunden.map((l) => l.id as string) }, von, tage);
  return NextResponse.json({ tage: ergebnis }, { headers: { "cache-control": "no-store" } });
}
