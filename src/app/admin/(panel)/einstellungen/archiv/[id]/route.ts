import { NextResponse } from "next/server";
import { archivAuftragLink } from "@/lib/archiv";
import { benutzerMitRecht } from "@/lib/auth";

/** PDF eines archivierten Werkstattauftrags: kurzlebiger Link in den privaten Speicher „archiv“. */
export async function GET(_r: Request, { params }: { params: Promise<{ id: string }> }) {
  await benutzerMitRecht("einstellungen");
  const link = await archivAuftragLink((await params).id);
  if (!link) return new NextResponse("Nicht gefunden", { status: 404 });
  return NextResponse.redirect(link);
}
