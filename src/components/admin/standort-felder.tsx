"use client";

import { useRef, useState } from "react";

/**
 * Standort der Werkstatt: Breite, Länge und erlaubter Abstand. „Hier bin ich“ übernimmt den Standort dieses
 * Geräts, am einfachsten einmal am Rechner oder Handy in der Werkstatt gedrückt.
 */
export function StandortFelder({ lat, lng, radiusM }: { lat: number | null; lng: number | null; radiusM: number }) {
  const latRef = useRef<HTMLInputElement>(null);
  const lngRef = useRef<HTMLInputElement>(null);
  const [hinweis, setHinweis] = useState("");
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <label className="block">
        <span className="label">Breite</span>
        <input ref={latRef} name="lat" defaultValue={lat ?? ""} inputMode="decimal" className="feld tabular-nums" placeholder="50.0123" />
      </label>
      <label className="block">
        <span className="label">Länge</span>
        <input ref={lngRef} name="lng" defaultValue={lng ?? ""} inputMode="decimal" className="feld tabular-nums" placeholder="8.7890" />
      </label>
      <label className="block">
        <span className="label">Abstand bis (m)</span>
        <input name="radiusM" defaultValue={radiusM} inputMode="numeric" className="feld tabular-nums" />
      </label>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-3">
        <button
          type="button"
          className="knopf knopf-rahmen knopf-klein"
          onClick={() => {
            if (!navigator.geolocation) return setHinweis("Dieses Gerät kann seinen Standort nicht bestimmen.");
            setHinweis("Standort wird bestimmt …");
            navigator.geolocation.getCurrentPosition(
              (pos) => {
                if (latRef.current) latRef.current.value = pos.coords.latitude.toFixed(6);
                if (lngRef.current) lngRef.current.value = pos.coords.longitude.toFixed(6);
                setHinweis(`Übernommen (genau auf etwa ${Math.round(pos.coords.accuracy)} m). Jetzt speichern.`);
              },
              () => setHinweis("Standort nicht verfügbar. Bitte die Ortung erlauben oder die Werte aus einer Karte eintragen."),
              { enableHighAccuracy: true, timeout: 15000 },
            );
          }}
        >
          Standort dieses Geräts übernehmen
        </button>
        {hinweis ? <span className="text-sm text-grau">{hinweis}</span> : null}
      </div>
    </div>
  );
}
