import { NextResponse } from "next/server";
import { benutzerMitRecht } from "@/lib/auth";
import { dateiname, rechnungLaden, xmlErzeugen } from "@/lib/rechnung/rechnungen";

/** Die E-Rechnung als XML-Datei, z. B. zum Hochladen in ein Rechnungsportal von Bund oder Land. */
export async function GET(_r: Request, { params }: { params: Promise<{ id: string }> }) {
  await benutzerMitRecht("rechnungen");
  const r = await rechnungLaden((await params).id);
  if (!r) return new NextResponse("Nicht gefunden", { status: 404 });
  if (r.status === "entwurf") return new NextResponse("Entwürfe haben noch keine E-Rechnung. Bitte zuerst stellen.", { status: 409 });
  let xml: string;
  try {
    xml = await xmlErzeugen(r);
  } catch (e) {
    return new NextResponse(e instanceof Error ? e.message : String(e), { status: 409, headers: { "content-type": "text/plain; charset=utf-8" } });
  }
  return new NextResponse(xml, {
    headers: { "content-type": "application/xml; charset=utf-8", "content-disposition": `attachment; filename="${dateiname(r, "xml")}"`, "cache-control": "private, no-store" },
  });
}
