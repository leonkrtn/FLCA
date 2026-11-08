"use server";

import { benutzerMitRecht } from "../auth";
import { pushSenden } from "../services/push";
import { db } from "../supabase/admin";

export async function pushAbonnieren(abo: { endpoint: string; keys: { p256dh: string; auth: string } }, geraet: string): Promise<{ ok: boolean }> {
  const b = await benutzerMitRecht("werkstatt");
  if (!/^https:\/\//.test(abo.endpoint) || !abo.keys?.p256dh || !abo.keys?.auth) return { ok: false };
  await db().from("push_abos").upsert({ profil_id: b.id, endpoint: abo.endpoint, p256dh: abo.keys.p256dh, auth: abo.keys.auth, geraet: geraet.slice(0, 120) }, { onConflict: "endpoint" });
  await pushSenden({ profile: [b.id] }, { titel: "Push ist an", text: "So sehen Benachrichtigungen aus.", url: "/app" });
  return { ok: true };
}

export async function pushAbmelden(endpoint: string): Promise<void> {
  const b = await benutzerMitRecht("werkstatt");
  await db().from("push_abos").delete().eq("endpoint", endpoint).eq("profil_id", b.id);
}
