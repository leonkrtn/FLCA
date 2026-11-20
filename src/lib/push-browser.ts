"use client";

import { pushAbonnieren } from "./aktionen/push";

/** Browser-Seite der Push-Nachrichten, geteilt von Schalter (Mehr), Hinweis (Heute) und Abgleich (Layout). */

export const VAPID_SCHLUESSEL = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

function alsBytes(base64: string) {
  const roh = atob((base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(roh, (c) => c.charCodeAt(0));
}

export function istInstalliert(): boolean {
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export function pushMoeglich(): boolean {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window && Boolean(VAPID_SCHLUESSEL);
}

export async function registrierung(): Promise<ServiceWorkerRegistration> {
  await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  return navigator.serviceWorker.ready;
}

/**
 * Abo holen oder neu anlegen und beim Server eintragen. Der Server kennt danach genau dieses Gerät
 * für den angemeldeten Benutzer; `test` schickt zur Bestätigung eine Nachricht.
 */
export async function abonnieren(test: boolean): Promise<PushSubscription> {
  const reg = await registrierung();
  const abo = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: alsBytes(VAPID_SCHLUESSEL) }));
  await pushAbonnieren(abo.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } }, navigator.userAgent, test);
  return abo;
}
