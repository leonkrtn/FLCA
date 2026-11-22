import { NextResponse } from "next/server";
import { auftragDateiname, auftragLaden, auftragPdf } from "@/lib/auftrag";
import { terminPerToken } from "@/lib/termine";

/** Werkstattauftrag als PDF über den Terminlink, ohne Login. Dasselbe PDF wie in der Verwaltung. */
export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const termin = await terminPerToken((await params).token);
  const t = termin?.auftrag_nummer ? await auftragLaden(termin.id) : null;
  if (!t) return new NextResponse("Nicht gefunden", { status: 404 });
  return new NextResponse(new Uint8Array(await auftragPdf(t)), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `inline; filename="${auftragDateiname(t)}"`,
      "cache-control": "private, no-store",
      "x-robots-tag": "noindex",
    },
  });
}
