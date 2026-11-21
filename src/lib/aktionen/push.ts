"use server";

import { benutzerMitRecht } from "../auth";
import type { Ergebnis } from "../forms";
import { pushSenden } from "../services/push";
import { db } from "../supabase/admin";

/** Trägt ein Gerät ein (oder aktualisiert es). `test`: Bestätigung per Push, beim stillen Abgleich nicht. */
export async function pushAbonnieren(abo: { endpoint: string; keys: { p256dh: string; auth: string } }, geraet: string, test = true): Promise<{ ok: boolean }> {
  const b = await benutzerMitRecht("werkstatt");
  if (!/^https:\/\//.test(abo.endpoint) || !abo.keys?.p256dh || !abo.keys?.auth) return { ok: false };
  await db().from("push_abos").upsert({ profil_id: b.id, endpoint: abo.endpoint, p256dh: abo.keys.p256dh, auth: abo.keys.auth, geraet: geraet.slice(0, 120) }, { onConflict: "endpoint" });
  if (test) await pushSenden({ profile: [b.id] }, { titel: "Push ist an", text: "So sehen Benachrichtigungen aus.", url: "/app" });
  return { ok: true };
}

export async function pushAbmelden(endpoint: string): Promise<void> {
  const b = await benutzerMitRecht("werkstatt");
  await db().from("push_abos").delete().eq("endpoint", endpoint).eq("profil_id", b.id);
}

/** Test-Push an alle Geräte der angemeldeten Person, um zu prüfen, ob Benachrichtigungen ankommen. */
export async function pushTest(_v: Ergebnis): Promise<Ergebnis> {
  const b = await benutzerMitRecht("werkstatt");
  const { count } = await db().from("push_abos").select("id", { count: "exact", head: true }).eq("profil_id", b.id);
  if (!count) return { status: "fehler", meldung: "Auf keinem Gerät ist Push eingeschaltet. Bitte oben einschalten." };
  await pushSenden({ profile: [b.id] }, { titel: "Test", text: "Push-Nachrichten kommen auf diesem Gerät an.", url: b.rolle === "mitarbeiter" ? "/team/mehr" : "/app/mehr", tag: "test" });
  return { status: "ok", meldung: `Gesendet an ${count === 1 ? "1 Gerät" : `${count} Geräte`}. Kommt nichts an, die Mitteilungen für die App in den iPhone-Einstellungen prüfen.` };
}
