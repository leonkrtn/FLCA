"use client";

import { useEffect, useState } from "react";
import { pushAbmelden, pushAbonnieren } from "@/lib/aktionen/push";

const schluessel = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

function alsBytes(base64: string) {
  const roh = atob((base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(roh, (c) => c.charCodeAt(0));
}

/**
 * Push ein/aus. Auf dem iPhone geht Push nur, wenn die Web-App über „Teilen → Zum Home-Bildschirm“
 * installiert ist und von dort gestartet wurde. Der Hinweis erscheint, solange das nicht der Fall ist.
 */
export function PushSchalter() {
  const [zustand, setZustand] = useState<"pruefen" | "nicht-moeglich" | "installieren" | "aus" | "an" | "blockiert">("pruefen");
  const [laeuft, setLaeuft] = useState(false);

  useEffect(() => {
    (async () => {
      const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
      const installiert = window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !schluessel) return setZustand(ios && !installiert ? "installieren" : "nicht-moeglich");
      if (Notification.permission === "denied") return setZustand("blockiert");
      const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      const abo = await reg.pushManager.getSubscription();
      setZustand(abo ? "an" : "aus");
    })().catch(() => setZustand("nicht-moeglich"));
  }, []);

  async function umschalten() {
    setLaeuft(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const abo = await reg.pushManager.getSubscription();
      if (abo) {
        await pushAbmelden(abo.endpoint);
        await abo.unsubscribe();
        setZustand("aus");
      } else {
        const erlaubnis = await Notification.requestPermission();
        if (erlaubnis !== "granted") return setZustand("blockiert");
        const neu = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: alsBytes(schluessel) });
        await pushAbonnieren(neu.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } }, navigator.userAgent);
        setZustand("an");
      }
    } finally {
      setLaeuft(false);
    }
  }

  if (zustand === "pruefen") return null;
  if (zustand === "installieren")
    return (
      <p className="text-sm">
        Für Push-Nachrichten die App installieren: unten auf <strong>Teilen</strong> tippen, dann <strong>Zum Home-Bildschirm</strong>. Danach die App vom Home-Bildschirm öffnen und hier einschalten.
      </p>
    );
  if (zustand === "nicht-moeglich") return <p className="text-sm text-grau">Push-Nachrichten gehen in diesem Browser nicht.</p>;
  if (zustand === "blockiert") return <p className="text-sm text-grau">Benachrichtigungen sind blockiert. In den Einstellungen des Geräts für diese App erlauben.</p>;
  return (
    <button type="button" onClick={umschalten} disabled={laeuft} className={`knopf w-full ${zustand === "an" ? "knopf-rahmen" : "knopf-dunkel"}`}>
      {laeuft ? "…" : zustand === "an" ? "Push-Nachrichten ausschalten" : "Push-Nachrichten einschalten"}
    </button>
  );
}
