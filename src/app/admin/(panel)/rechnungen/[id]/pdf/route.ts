import { NextResponse } from "next/server";
import { benutzerMitRecht } from "@/lib/auth";
import { dateiname, pdfErzeugen, rechnungLaden, vorschauPdf } from "@/lib/rechnung/rechnungen";

export async function GET(_r: Request, { params }: { params: Promise<{ id: string }> }) {
  await benutzerMitRecht("rechnungen");
  const r = await rechnungLaden((await params).id);
  if (!r) return new NextResponse("Nicht gefunden", { status: 404 });
  const pdf = r.status === "entwurf" ? await vorschauPdf(r) : await pdfErzeugen(r);
  return new NextResponse(new Uint8Array(pdf), {
    headers: { "content-type": "application/pdf", "content-disposition": `inline; filename="${dateiname(r)}"`, "cache-control": "private, no-store" },
  });
}
