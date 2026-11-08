import { NextResponse } from "next/server";
import { dateiname, pdfErzeugen, rechnungPerToken } from "@/lib/rechnung/rechnungen";

/** Rechnungs-PDF über den Link aus der Mail, ohne Login. Derselbe Weg wie im Admin (pdfErzeugen). */
export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const r = await rechnungPerToken((await params).token);
  if (!r) return new NextResponse("Nicht gefunden", { status: 404 });
  const pdf = await pdfErzeugen(r);
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `inline; filename="${dateiname(r)}"`,
      "cache-control": "private, no-store",
      "x-robots-tag": "noindex",
    },
  });
}
