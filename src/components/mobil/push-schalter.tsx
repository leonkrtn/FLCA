"use client";

import { useEffect, useState } from "react";
import { pushAbmelden } from "@/lib/aktionen/push";
import { abonnieren, istInstalliert, pushMoeglich, registrierung } from "@/lib/push-browser";

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
      if (ios && !istInstalliert()) return setZustand("installieren");
      if (!pushMoeglich()) return setZustand("nicht-moeglich");
      if (Notification.permission === "denied") return setZustand("blockiert");
      const reg = await registrierung();
      const abo = await reg.pushManager.getSubscription();
      setZustand(abo ? "an" : "aus");
    })().catch(() => setZustand("nicht-moeglich"));
  }, []);

  async function umschalten() {
    setLaeuft(true);
    try {
      const reg = await registrierung();
      const abo = await reg.pushManager.getSubscription();
      if (abo) {
        await pushAbmelden(abo.endpoint);
        await abo.unsubscribe();
        setZustand("aus");
      } else {
        const erlaubnis = await Notification.requestPermission();
        if (erlaubnis !== "granted") return setZustand("blockiert");
        await abonnieren(true);
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
