import { after, NextResponse } from "next/server";
import { kalender } from "@/lib/services/kalender";
import { db } from "@/lib/supabase/admin";

/**
 * Google meldet hier, DASS sich im Kalender etwas geändert hat (nicht was). Geprüft werden Kanal-ID und
 * das beim Anlegen vergebene Token; danach wird nach der Antwort neu abgeglichen.
 */
export async function POST(request: Request) {
  const kanal = request.headers.get("x-goog-channel-id");
  const token = request.headers.get("x-goog-channel-token");
  const { data } = await db().from("kalender_verbindung").select("kanal_id, kanal_token").eq("id", 1).maybeSingle();
  if (!kanal || !token || kanal !== data?.kanal_id || token !== data?.kanal_token) return new NextResponse(null, { status: 404 });
  if (request.headers.get("x-goog-resource-state") !== "sync") {
    after(() => kalender().abgleichen().catch((e) => console.error("Abgleich nach Google-Meldung fehlgeschlagen", e)));
  }
  return new NextResponse(null, { status: 204 });
}
