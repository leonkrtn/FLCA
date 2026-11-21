"use client";

import { useRef, useState } from "react";
import { Formular, Senden } from "@/components/admin/formular";
import { stempeln } from "@/lib/aktionen/team";

/**
 * Ein- und Ausstempeln. Ist „nur vor Ort“ eingeschaltet, holt das Handy vor dem Einstempeln seinen Standort und
 * schickt ihn mit; der Server entscheidet. Ausstempeln geht ohne Standort.
 */
export function Stempeln({ eingestempelt, nurVorOrt, text }: { eingestempelt: boolean; nurVorOrt: boolean; text: string }) {
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
      <Formular aktion={stempeln} className="grid gap-2">
        <input type="hidden" name="lat" />
        <input type="hidden" name="lng" />
        <input type="hidden" name="genauigkeit" />
        <p className="text-sm text-grau">{text}</p>
        <Senden art={eingestempelt ? "rahmen" : "rot"} className="min-h-14 w-full text-lg" vorab={eingestempelt ? "Ausgestempelt" : "Eingestempelt"}>
          {orten ? "Standort wird geprüft …" : eingestempelt ? "Ausstempeln" : "Einstempeln"}
        </Senden>
        {nurVorOrt && !eingestempelt ? <p className="text-xs text-grau">Einstempeln geht nur in der Werkstatt (Standort wird geprüft).</p> : null}
        {hinweis ? <p role="status" className="text-sm font-semibold text-rot">{hinweis}</p> : null}
      </Formular>
    </div>
  );
}
