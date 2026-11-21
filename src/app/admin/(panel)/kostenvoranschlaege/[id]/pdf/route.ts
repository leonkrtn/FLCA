import { NextResponse } from "next/server";
import { benutzerMitRecht } from "@/lib/auth";
import { vorschauAus } from "@/lib/rechnung/eingabe";
import { type Kostenvoranschlag, kvDateiname, kvLaden, kvPdf } from "@/lib/rechnung/kostenvoranschlaege";

export async function GET(_r: Request, { params }: { params: Promise<{ id: string }> }) {
  await benutzerMitRecht("rechnungen");
  const k = await kvLaden((await params).id);
  if (!k) return new NextResponse("Nicht gefunden", { status: 404 });
  return antwort(k, await kvPdf(k));
}

/** Vorschau aus dem Editor: zeigt, was gerade im Formular steht, auch ungespeichert. Gespeichert wird nichts. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await benutzerMitRecht("rechnungen");
  const k = await kvLaden((await params).id);
  if (!k) return new NextResponse("Nicht gefunden", { status: 404 });
  if (k.status !== "entwurf") return antwort(k, await kvPdf(k));
  try {
    const { datumOderNull, ...beleg } = await vorschauAus(await req.formData());
    return antwort(k, await kvPdf({ ...k, ...beleg, gueltig_bis: datumOderNull("gueltig_bis") }));
  } catch (e) {
    return new NextResponse(e instanceof Error ? e.message : String(e), { status: 400, headers: { "content-type": "text/plain; charset=utf-8" } });
  }
}

function antwort(k: Kostenvoranschlag, pdf: Buffer) {
  return new NextResponse(new Uint8Array(pdf), {
    headers: { "content-type": "application/pdf", "content-disposition": `inline; filename="${kvDateiname(k)}"`, "cache-control": "private, no-store" },
  });
}
