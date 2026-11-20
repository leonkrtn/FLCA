import { NextResponse } from "next/server";
import { benutzerMitRecht } from "@/lib/auth";
import { kvDateiname, kvLaden, kvPdf } from "@/lib/rechnung/kostenvoranschlaege";

export async function GET(_r: Request, { params }: { params: Promise<{ id: string }> }) {
  await benutzerMitRecht("rechnungen");
  const k = await kvLaden((await params).id);
  if (!k) return new NextResponse("Nicht gefunden", { status: 404 });
  const pdf = await kvPdf(k);
  return new NextResponse(new Uint8Array(pdf), {
    headers: { "content-type": "application/pdf", "content-disposition": `inline; filename="${kvDateiname(k)}"`, "cache-control": "private, no-store" },
  });
}
