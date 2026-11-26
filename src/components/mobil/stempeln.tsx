"use client";

import { useOptimistic, useRef, useState } from "react";
import { Formular, Senden } from "@/components/admin/formular";
import { pauseUmschalten, stempeln } from "@/lib/aktionen/team";
import { zeit } from "@/lib/format";

type Stand = { seit: string | null; pauseSeit: string | null };

/**
 * Ein- und Ausstempeln. Ist „nur vor Ort“ eingeschaltet, holt das Handy vor dem Einstempeln seinen Standort und
 * schickt ihn mit; der Server entscheidet. Ausstempeln geht ohne Standort.
 *
 * Der Tipp wirkt sofort (`useOptimistic`, erst nach der Ortung): Text und Knöpfe zeigen gleich den neuen Stand.
 * Lehnt der Server ab (zu weit weg), steht wieder der alte da, darunter der Grund. `seit`/`pauseSeit` kommen
 * aus dem offenen Zeiteintrag, `monat` ist der fertige Text für die Monatssumme.
 */
export function Stempeln({ seit, pauseSeit, nurVorOrt, monat }: { seit: string | null; pauseSeit: string | null; nurVorOrt: boolean; monat: string }) {
  const [stand, setzeStand] = useOptimistic<Stand>({ seit, pauseSeit });
  const eingestempelt = Boolean(stand.seit);
  const pause = Boolean(stand.pauseSeit);
  const jetzt = () => new Date().toISOString();
  const text = `${stand.seit ? (stand.pauseSeit ? `Pause seit ${zeit(stand.pauseSeit)} Uhr` : `Eingestempelt seit ${zeit(stand.seit)} Uhr`) : "Nicht eingestempelt"} · Monat: ${monat}`;
  const form = useRef<HTMLFormElement | null>(null);
  const bereit = useRef(false);
  const [orten, setOrten] = useState(false);
  const [hinweis, setHinweis] = useState("");
  const feld = (name: string, wert: string) => {
    const el = form.current?.elements.namedItem(name);
    if (el instanceof HTMLInputElement) el.value = wert;
  };

  return (
    <div
      ref={(el) => {
        form.current = el?.querySelector("form") ?? null;
      }}
      onSubmitCapture={(e) => {
        if (eingestempelt || !nurVorOrt || bereit.current) {
          bereit.current = false;
          return;
        }
        e.preventDefault();
        setHinweis("");
        if (!navigator.geolocation) return setHinweis("Dieses Handy kann seinen Standort nicht bestimmen. Einstempeln geht nur mit Standort.");
        setOrten(true);
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            setOrten(false);
            feld("lat", String(pos.coords.latitude));
            feld("lng", String(pos.coords.longitude));
            feld("genauigkeit", String(Math.round(pos.coords.accuracy)));
            bereit.current = true;
            form.current?.requestSubmit();
          },
          (fehler) => {
            setOrten(false);
            setHinweis(
              fehler.code === fehler.PERMISSION_DENIED
                ? "Standort nicht erlaubt. Auf dem iPhone: Einstellungen › Datenschutz › Ortungsdienste › Safari-Websites (bzw. die App) › „Beim Verwenden“."
                : "Standort gerade nicht bestimmbar. Bitte kurz warten und noch einmal versuchen.",
            );
          },
          { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 },
        );
      }}
    >
      <Formular aktion={stempeln} sofort={() => setzeStand(eingestempelt ? { seit: null, pauseSeit: null } : { seit: jetzt(), pauseSeit: null })} className="grid gap-2">
        <input type="hidden" name="lat" />
        <input type="hidden" name="lng" />
        <input type="hidden" name="genauigkeit" />
        <p className="text-sm text-grau">{text}</p>
        <Senden art={eingestempelt ? "rahmen" : "rot"} className="min-h-14 w-full text-lg">
          {orten ? "Standort wird geprüft …" : eingestempelt ? "Ausstempeln" : "Einstempeln"}
        </Senden>
        {/* Art. 13 DSGVO / § 26 BDSG: Wer geortet wird, erfährt vorher, was gespeichert wird und wer es sieht. */}
        {nurVorOrt && !eingestempelt ? (
          <p className="text-xs text-grau">
            Einstempeln geht nur in der Werkstatt. Dafür prüft das Handy einmal beim Einstempeln den Standort. Gespeichert wird nur der Abstand zur Werkstatt, nicht der Ort. Versuchst du es von weiter weg, bekommt der Inhaber eine Mitteilung mit Name und Abstand.
          </p>
        ) : null}
        {hinweis ? <p role="status" className="text-sm font-semibold text-rot">{hinweis}</p> : null}
      </Formular>
      {/* Pause als eigenes Formular: Ein Tipp, ohne Standort; stoppt auch die Uhr am Auftrag. */}
      {eingestempelt ? (
        <Formular aktion={pauseUmschalten} sofort={() => setzeStand({ seit: stand.seit, pauseSeit: pause ? null : jetzt() })} className="mt-2 grid">
          <Senden art={pause ? "dunkel" : "rahmen"} className="min-h-12 w-full">
            {pause ? "Pause beenden" : "Pause"}
          </Senden>
        </Formular>
      ) : null}
    </div>
  );
}
