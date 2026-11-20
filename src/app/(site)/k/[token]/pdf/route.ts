import { NextResponse } from "next/server";
import { kvDateiname, kvPdf, kvPerToken } from "@/lib/rechnung/kostenvoranschlaege";

/** PDF des Kostenvoranschlags über den Link aus der Mail, ohne Login. Dasselbe PDF wie in der Verwaltung. */
export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const k = await kvPerToken((await params).token);
  if (!k) return new NextResponse("Nicht gefunden", { status: 404 });
  const pdf = await kvPdf(k);
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `inline; filename="${kvDateiname(k)}"`,
      "cache-control": "private, no-store",
      "x-robots-tag": "noindex",
    },
  });
}
