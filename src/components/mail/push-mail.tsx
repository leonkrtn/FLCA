"use client";

import { useState, useTransition } from "react";
import { mailPushSchalten } from "@/lib/aktionen/mail";

/** Push für neue Mails an diese Person an/aus (die Geräte selbst schaltet der allgemeine Push-Schalter). */
export function MailPushSchalter({ an }: { an: boolean }) {
  const [wert, setWert] = useState(an);
  const [laeuft, starten] = useTransition();
  const [fehler, setFehler] = useState("");
  return (
    <label className="flex items-center justify-between gap-3 text-sm">
      <span>
        Push bei neuen Mails
        {fehler ? <span className="block text-rot">{fehler}</span> : null}
      </span>
      <input
        type="checkbox"
        checked={wert}
        disabled={laeuft}
        onChange={(e) => {
          const neu = e.target.checked;
          setWert(neu);
          setFehler("");
          starten(async () => {
            const r = await mailPushSchalten(neu);
            if (!r.ok) {
              setWert(!neu);
              setFehler(r.meldung);
            }
          });
        }}
        className="size-5 accent-tinte"
      />
    </label>
  );
}
