import { NextResponse } from "next/server";
import { auftragDateiname, auftragLaden, auftragPdf, type AuftragTermin } from "@/lib/auftrag";
import { benutzerMitRecht } from "@/lib/auth";
import { positionenAus } from "@/lib/rechnung/eingabe";

/** Der Werkstattauftrag als PDF, wie ihn der Kunde bekommt (mit Unterschrift, wenn erteilt). */
export async function GET(_r: Request, { params }: { params: Promise<{ id: string }> }) {
  await benutzerMitRecht("termine");
  const t = await auftragLaden((await params).id);
  if (!t?.auftrag_nummer) return new NextResponse("Nicht gefunden", { status: 404 });
  return antwort(t, await auftragPdf(t));
}

/** Vorschau aus dem Editor: zeigt, was gerade im Formular steht, auch ungespeichert. Gespeichert wird nichts. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await benutzerMitRecht("termine");
  const t = await auftragLaden((await params).id);
  if (!t?.auftrag_nummer) return new NextResponse("Nicht gefunden", { status: 404 });
  try {
    const roh = JSON.parse(String((await req.formData()).get("daten") ?? "{}")) as Record<string, unknown>;
    // Halb angelegte Zeilen ohne Bezeichnung lässt die Vorschau weg, statt deswegen gar nichts zu zeigen.
    const zeilen = Array.isArray(roh.positionen) ? roh.positionen.filter((p) => p?.rabatt || String(p?.text ?? "").trim()) : [];
    const grenze = roh.kostengrenze_cent == null ? null : Math.round(Number(roh.kostengrenze_cent));
    return antwort(t, await auftragPdf(t, { positionen: positionenAus(zeilen), kostengrenze_cent: Number.isFinite(grenze) ? grenze : null }));
  } catch (e) {
    return new NextResponse(e instanceof Error ? e.message : String(e), { status: 400, headers: { "content-type": "text/plain; charset=utf-8" } });
  }
}

function antwort(t: AuftragTermin, pdf: Buffer) {
  return new NextResponse(new Uint8Array(pdf), {
    headers: { "content-type": "application/pdf", "content-disposition": `inline; filename="${auftragDateiname(t)}"`, "cache-control": "private, no-store" },
  });
}
