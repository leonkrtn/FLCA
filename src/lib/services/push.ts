import "server-only";
import { sendNotification, setVapidDetails } from "web-push";
import { ENV, KONFIGURIERT } from "../env";
import type { Rolle } from "../rollen";
import { db } from "../supabase/admin";

export type PushNachricht = { titel: string; text: string; url: string; tag?: string };

let eingerichtet = false;

function einrichten() {
  if (eingerichtet) return;
  setVapidDetails(`mailto:${ENV.mailFrom.match(/<([^>]+)>/)?.[1] ?? "info@flc-automotive.de"}`, ENV.vapidPublicKey, ENV.vapidPrivateKey);
  eingerichtet = true;
}

/**
 * Schickt eine Push-Nachricht an alle Geräte der Personen mit diesen Rollen (oder an bestimmte Personen).
 * Auf dem iPhone kommen Push-Nachrichten nur an, wenn die Web-App auf dem Home-Bildschirm liegt (ab iOS 16.4).
 * Abgelaufene Abos (HTTP 404/410) werden gelöscht.
 */
export async function pushSenden(ziel: { rollen?: Rolle[]; profile?: string[] }, nachricht: PushNachricht): Promise<void> {
  if (!KONFIGURIERT.push) return;
  einrichten();

  let ids = ziel.profile ?? [];
  if (ziel.rollen?.length) {
    const { data } = await db().from("profile").select("id").in("rolle", ziel.rollen).eq("aktiv", true);
    ids = [...ids, ...(data ?? []).map((p) => p.id as string)];
  }
  if (!ids.length) return;

  const { data: abos } = await db().from("push_abos").select("id, endpoint, p256dh, auth").in("profil_id", ids);
  await Promise.all(
    (abos ?? []).map(async (abo) => {
      try {
        await sendNotification(
          { endpoint: abo.endpoint, keys: { p256dh: abo.p256dh, auth: abo.auth } },
          JSON.stringify(nachricht),
          { TTL: 60 * 60 * 24, urgency: "high" },
        );
      } catch (error) {
        const code = (error as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) await db().from("push_abos").delete().eq("id", abo.id);
        else console.error("Push fehlgeschlagen", code, error);
      }
    }),
  );
}
