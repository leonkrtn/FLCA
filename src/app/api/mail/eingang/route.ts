import { NextResponse } from "next/server";
import { KONFIGURIERT } from "@/lib/env";
import { fehlerMelden } from "@/lib/fehler";
import { empfangen, gesendetVermerken } from "@/lib/mail/postfach";
import { webhookPruefen } from "@/lib/services/email";

// Anhänge werden von Resend geholt und in den Speicher gelegt; das kann bei großen Dateien dauern.
export const maxDuration = 60;

/**
 * Webhook von Resend (Ereignisse „email.received“ und „email.sent“). Nur mit gültiger Signatur. Bei einem
 * Fehler antwortet er mit 500, dann stellt Resend erneut zu; doppelt abgelegt wird nichts.
 */
export async function POST(request: Request) {
  if (!KONFIGURIERT.mailEingang) return new NextResponse("Mail-Empfang ist nicht eingerichtet", { status: 503 });
  const roh = await request.text();
  let meldung: ReturnType<typeof webhookPruefen>;
  try {
    meldung = webhookPruefen(roh, request.headers);
  } catch {
    return new NextResponse("Signatur ungültig", { status: 401 });
  }
  try {
    if (meldung?.art === "eingang") await empfangen(meldung.id);
    if (meldung?.art === "gesendet") await gesendetVermerken(meldung.id, meldung.messageId);
    return NextResponse.json({ ok: true });
  } catch (fehler) {
    await fehlerMelden(fehler, "Mail empfangen (Webhook)");
    return new NextResponse("Fehler", { status: 500 });
  }
}
