import { zipSync } from "fflate";
import { NextResponse, type NextRequest } from "next/server";
import { benutzerMitRecht } from "@/lib/auth";
import { dateiname, pdfErzeugen, rechnungLaden, vorschauPdf } from "@/lib/rechnung/rechnungen";
import { berlinDatum } from "@/lib/zeit";

export const maxDuration = 60;

/**
 * GET /admin/rechnungen/auswahl?ids=a,b,c → ZIP mit den PDFs der ausgewählten Rechnungen.
 * Entwürfe kommen als Vorschau mit, damit eine gemischte Auswahl nicht scheitert.
 * Höchstens 100 auf einmal, sonst reicht die Laufzeit der Funktion nicht.
 */
export async function GET(request: NextRequest) {
  await benutzerMitRecht("rechnungen");
  const ids = (request.nextUrl.searchParams.get("ids") ?? "").split(",").filter((x) => /^[0-9a-zA-Z-]{1,64}$/.test(x)).slice(0, 100);
  if (!ids.length) return new NextResponse("Keine Rechnungen ausgewählt", { status: 400 });
  const dateien: Record<string, Uint8Array> = {};
  const fehlt: string[] = [];
  for (const id of ids) {
    const r = await rechnungLaden(id);
    if (!r) continue;
    // Eine fehlerhafte Rechnung soll nicht den ganzen Download kippen: überspringen und im ZIP vermerken.
    let pdf: Buffer;
    try {
      pdf = r.status === "entwurf" ? await vorschauPdf(r) : await pdfErzeugen(r);
    } catch (e) {
      fehlt.push(`${r.nummer ?? "Entwurf"}: ${e instanceof Error ? e.message : String(e)}`);
      continue;
    }
    let name = r.status === "entwurf" ? `Entwurf-${(r.empfaenger.name || r.id.slice(0, 8)).replace(/[^A-Za-z0-9-]/g, "_")}.pdf` : dateiname(r);
    // Doppelte Namen (mehrere Entwürfe für dieselbe Person) bekommen eine laufende Zahl.
    for (let n = 2; dateien[name]; n++) name = name.replace(/(-\d+)?\.pdf$/, `-${n}.pdf`);
    dateien[name] = new Uint8Array(pdf);
  }
  if (fehlt.length) dateien["Nicht enthalten.txt"] = new TextEncoder().encode(`Diese Rechnungen konnten nicht erzeugt werden:\n${fehlt.join("\n")}\n`);
  const zip = zipSync(dateien, { level: 0 });
  return new NextResponse(new Uint8Array(zip), {
    headers: {
      "content-type": "application/zip",
      "content-disposition": `attachment; filename="FLC-Rechnungen-${berlinDatum()}.zip"`,
      "cache-control": "private, no-store",
    },
  });
}
