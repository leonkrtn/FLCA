import { NextResponse } from "next/server";
import { benutzerMitRecht } from "@/lib/auth";
import { vorschauAus } from "@/lib/rechnung/eingabe";
import { dateiname, pdfErzeugen, type Rechnung, rechnungLaden, vorschauPdf } from "@/lib/rechnung/rechnungen";

export async function GET(_r: Request, { params }: { params: Promise<{ id: string }> }) {
  await benutzerMitRecht("rechnungen");
  const r = await rechnungLaden((await params).id);
  if (!r) return new NextResponse("Nicht gefunden", { status: 404 });
  return antwort(r, r.status === "entwurf" ? await vorschauPdf(r) : await pdfErzeugen(r));
}

/** Vorschau aus dem Editor: zeigt, was gerade im Formular steht, auch ungespeichert. Gespeichert wird nichts. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await benutzerMitRecht("rechnungen");
  const r = await rechnungLaden((await params).id);
  if (!r) return new NextResponse("Nicht gefunden", { status: 404 });
  if (r.status !== "entwurf") return antwort(r, await pdfErzeugen(r));
  try {
    const { datumOderNull, ...beleg } = await vorschauAus(await req.formData());
    return antwort(r, await vorschauPdf({ ...r, ...beleg, leistungsdatum: datumOderNull("leistungsdatum") }));
  } catch (e) {
    return new NextResponse(e instanceof Error ? e.message : String(e), { status: 400, headers: { "content-type": "text/plain; charset=utf-8" } });
  }
}

function antwort(r: Rechnung, pdf: Buffer) {
  return new NextResponse(new Uint8Array(pdf), {
    headers: { "content-type": "application/pdf", "content-disposition": `inline; filename="${dateiname(r)}"`, "cache-control": "private, no-store" },
  });
}
