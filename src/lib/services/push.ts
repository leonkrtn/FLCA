import "server-only";
import { sendNotification, setVapidDetails } from "web-push";
import { ENV, KONFIGURIERT } from "../env";
import type { Rolle } from "../rollen";
import { db } from "../supabase/admin";
import { fehlerMelden } from "../fehler";
import { testmodus } from "./testmodus";

export type PushNachricht = { titel: string; text: string; url: string; tag?: string };

let eingerichtet = false;

function einrichten() {
  if (eingerichtet) return;
  setVapidDetails(`mailto:${ENV.mailFrom.match(/<([^>]+)>/)?.[1] ?? "service@flcautomotive.de"}`, ENV.vapidPublicKey, ENV.vapidPrivateKey);
  eingerichtet = true;
}

/**
 * Schickt eine Push-Nachricht an alle Geräte der Personen mit diesen Rollen (oder an bestimmte Personen).
 * Auf dem iPhone kommen Push-Nachrichten nur an, wenn die Web-App auf dem Home-Bildschirm liegt (ab iOS 16.4).
 * Abgelaufene Abos (HTTP 404/410) werden gelöscht. Im Testmodus (Systemcheck) wird nur aufgeschrieben, an wie
 * viele Geräte es ginge.
 */
export async function pushSenden(ziel: { rollen?: Rolle[]; profile?: string[] }, nachricht: PushNachricht): Promise<void> {
  const probe = testmodus();
  if (!KONFIGURIERT.push) {
    probe?.push({ kanal: "push", an: [], text: nachricht.titel, fehler: ["Push ist nicht eingerichtet (VAPID-Schlüssel fehlen in Vercel)."] });
    return;
  }
  // Wirft bei ungültigen VAPID-Schlüsseln, auch im Testmodus: Genau das soll der Systemcheck sehen.
  einrichten();

  let ids = ziel.profile ?? [];
  if (ziel.rollen?.length) {
    const { data } = await db().from("profile").select("id").in("rolle", ziel.rollen).eq("aktiv", true);
    ids = [...ids, ...(data ?? []).map((p) => p.id as string)];
  }
  if (!ids.length) {
    probe?.push({ kanal: "push", an: [], text: nachricht.titel, fehler: [] });
    return;
  }

  const { data: abos } = await db().from("push_abos").select("id, endpoint, p256dh, auth").in("profil_id", ids);
  if (probe) {
    probe.push({ kanal: "push", an: (abos ?? []).map((a) => new URL(a.endpoint).hostname), text: nachricht.titel, fehler: nachricht.url.startsWith("/") ? [] : [`Link muss mit / beginnen: ${nachricht.url}`] });
    return;
  }
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
        else await fehlerMelden(error, `Push senden (Status ${code ?? "unbekannt"})`);
      }
    }),
  );
}
