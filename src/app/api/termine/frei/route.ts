import { type NextRequest, NextResponse } from "next/server";
import { KONFIGURIERT } from "@/lib/env";
import { db } from "@/lib/supabase/admin";
import { freieTermine } from "@/lib/termine";
import { istDatum } from "@/lib/zeit";

/** GET /api/termine/frei?leistung=<slug|id>&von=YYYY-MM-DD&tage=14 – freie Startzeiten je Tag. */
export async function GET(request: NextRequest) {
  const p = request.nextUrl.searchParams;
  const von = p.get("von") ?? "";
  const tage = Math.min(Math.max(Number(p.get("tage")) || 14, 1), 31);
  const schluessel = p.get("leistung") ?? "";
  if (!istDatum(von) || !schluessel) return NextResponse.json({ fehler: "Parameter fehlen" }, { status: 400 });
  if (!KONFIGURIERT.supabaseAdmin) return NextResponse.json({ tage: [] });

  const spalte = /^[0-9a-f-]{36}$/.test(schluessel) ? "id" : "slug";
  const { data: leistung } = await db().from("leistungen").select("dauer_min, online_anfragbar").eq(spalte, schluessel).eq("sichtbar", true).maybeSingle();
  if (!leistung?.online_anfragbar) return NextResponse.json({ fehler: "Leistung nicht buchbar" }, { status: 404 });

  const ergebnis = await freieTermine(leistung, von, tage);
  return NextResponse.json({ tage: ergebnis }, { headers: { "cache-control": "no-store" } });
}
