import { NextResponse } from "next/server";
import { benutzerMitRecht } from "@/lib/auth";
import { db } from "@/lib/supabase/admin";

/** Lebenslauf über einen 60 Sekunden gültigen Link aus dem privaten Speicher. */
export async function GET(_r: Request, { params }: { params: Promise<{ id: string }> }) {
  await benutzerMitRecht("karriere");
  const { data: b } = await db().from("bewerbungen").select("lebenslauf_pfad, lebenslauf_name").eq("id", (await params).id).maybeSingle();
  if (!b?.lebenslauf_pfad) return new NextResponse("Nicht gefunden", { status: 404 });
  const { data } = await db().storage.from("bewerbungen").createSignedUrl(b.lebenslauf_pfad, 60, { download: b.lebenslauf_name ?? true });
  if (!data) return new NextResponse("Nicht gefunden", { status: 404 });
  return NextResponse.redirect(data.signedUrl);
}
