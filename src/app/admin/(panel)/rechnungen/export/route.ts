import { NextResponse, type NextRequest } from "next/server";
import { benutzerMitRecht } from "@/lib/auth";
import { einstellungen } from "@/lib/einstellungen";
import { monatsexport } from "@/lib/rechnung/datev";

export const maxDuration = 60;

/** GET /admin/rechnungen/export?monat=2026-10 → ZIP mit DATEV-Buchungsstapel und allen PDFs des Monats. */
export async function GET(request: NextRequest) {
  await benutzerMitRecht("rechnungen");
  const monat = request.nextUrl.searchParams.get("monat") ?? "";
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(monat)) return new NextResponse("Monat fehlt (JJJJ-MM)", { status: 400 });
  const { automatik } = await einstellungen();
  const { zip } = await monatsexport(monat, automatik.datev);
  return new NextResponse(new Uint8Array(zip), {
    headers: { "content-type": "application/zip", "content-disposition": `attachment; filename="FLC-Rechnungen-${monat}.zip"`, "cache-control": "no-store" },
  });
}
