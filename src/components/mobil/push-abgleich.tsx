"use client";

import { useEffect, useState } from "react";
import { abonnieren, istInstalliert, pushMoeglich } from "@/lib/push-browser";

/**
 * Läuft bei jedem Start der Web-App unsichtbar mit: Ist Push auf diesem Gerät erlaubt, wird das Abo
 * (neu) beim Server eingetragen. Apple erneuert Abos ab und zu, nach einer Neuinstallation gibt es ein
 * neues; ohne diesen Abgleich zeigt das Handy „an“, der Server kennt das Gerät aber nicht mehr und
 * neue Anfragen kommen nie an.
 */
export function PushAbgleich() {
  useEffect(() => {
    if (!pushMoeglich() || !istInstalliert() || Notification.permission !== "granted") return;
    abonnieren(false).catch((e) => console.warn("Push-Abgleich fehlgeschlagen", e));
  }, []);
  return null;
}

/**
 * Hinweis auf „Heute“, solange auf diesem Gerät keine Push-Nachrichten ankommen können. Ein Tipp fragt
 * die Erlaubnis ab (iOS erlaubt das nur nach einem Tipp, nicht von selbst).
 */
export function PushHinweis() {
  const [zustand, setZustand] = useState<"ok" | "fragen" | "blockiert" | "installieren" | "laeuft">("ok");

  useEffect(() => {
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const pruefen = () => {
      if (ios && !istInstalliert()) return "installieren" as const;
      if (!pushMoeglich()) return "ok" as const;
      if (Notification.permission === "denied") return "blockiert" as const;
      return Notification.permission === "granted" ? ("ok" as const) : ("fragen" as const);
    };
    // Nach dem ersten Zeichnen, damit die Seite nicht mit einem Hinweis startet, der gleich wieder verschwindet.
    const t = setTimeout(() => setZustand(pruefen()), 0);
    return () => clearTimeout(t);
  }, []);

  if (zustand === "ok") return null;
  return (
    <div className="border-b border-linie bg-kreide px-4 py-3 text-sm" role="status">
      {zustand === "installieren" ? (
        <p>
          <strong>Push für neue Anfragen:</strong> Die App über <strong>Teilen → Zum Home-Bildschirm</strong> installieren und von dort öffnen.
        </p>
      ) : zustand === "blockiert" ? (
        <p>
          <strong>Push ist blockiert.</strong> Neue Anfragen kommen nicht aufs Handy. In den iPhone-Einstellungen unter Mitteilungen für „Werkstatt“ erlauben.
        </p>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <p>
            <strong>Push ist aus.</strong> Neue Anfragen kommen nicht aufs Handy.
          </p>
          <button
            type="button"
            disabled={zustand === "laeuft"}
            className="knopf knopf-dunkel knopf-klein shrink-0"
            onClick={async () => {
              setZustand("laeuft");
              try {
                const erlaubnis = await Notification.requestPermission();
                if (erlaubnis !== "granted") return setZustand(erlaubnis === "denied" ? "blockiert" : "fragen");
                await abonnieren(true);
                setZustand("ok");
              } catch {
                setZustand("fragen");
              }
            }}
          >
            {zustand === "laeuft" ? "…" : "Einschalten"}
          </button>
        </div>
      )}
    </div>
  );
}
