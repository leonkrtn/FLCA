"use client";

import { useState } from "react";
import { KundenSuche, type KundenWahl } from "./kunden-suche";
import type { KundenTreffer } from "@/lib/kunden";

type Werte = { name: string; telefon: string; email: string; kennzeichen: string; fahrzeug: string };

const kz = (s: string) => s.toUpperCase().replace(/[^A-ZÄÖÜ0-9]/g, "");

/**
 * Kunde eines neuen Termins: aus der Kartei wählen (dann hängt der Termin genau an diesem Kunden, auch
 * wenn Telefon oder E-Mail anders geschrieben sind) oder wie bisher eintippen (dann wird über E-Mail oder
 * Telefon gesucht und sonst neu angelegt). Die Felder bleiben änderbar; was hier geändert wird, landet
 * beim Speichern in der Kartei.
 */
export function TerminKunde({
  start,
  zuletzt,
  werte: anfang,
  kompakt = false,
}: {
  start?: KundenWahl | null;
  zuletzt: KundenTreffer[];
  werte: Partial<Werte>;
  kompakt?: boolean;
}) {
  const ausWahl = (w: KundenWahl): Werte => ({
    name: w.kunde.name,
    telefon: w.kunde.telefon,
    email: w.kunde.email,
    kennzeichen: w.fahrzeug?.kennzeichen ?? "",
    fahrzeug: w.fahrzeug?.marke_modell ?? "",
  });
  const [wahl, setWahl] = useState<KundenWahl | null>(start ?? null);
  const [suchen, setSuchen] = useState(false);
  const [w, setW] = useState<Werte>(() => ({
    name: "",
    telefon: "",
    email: "",
    kennzeichen: "",
    fahrzeug: "",
    ...(start ? ausWahl(start) : {}),
    // Was gesprochen oder mitgegeben wurde, geht vor
    ...Object.fromEntries(Object.entries(anfang).filter(([, v]) => v)),
  }));
  const breit = kompakt ? "" : "sm:col-span-2";

  const waehlen = (neu: KundenWahl) => {
    setWahl(neu);
    setSuchen(false);
    setW(ausWahl(neu));
  };
  const setze = (feld: keyof Werte, wert: string) => {
    setW((x) => ({ ...x, [feld]: wert }));
    // Anderes Kennzeichen getippt: nicht mehr das gewählte Auto, der Kunde bleibt
    if (feld === "kennzeichen" && wahl?.fahrzeug && kz(wert) !== kz(wahl.fahrzeug.kennzeichen)) setWahl({ ...wahl, fahrzeug: null });
  };
  const feld = (name: keyof Werte, label: string, art: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label className="block">
      <span className="label">{label}</span>
      <input name={name} value={w[name]} onChange={(e) => setze(name, e.target.value)} className="feld" {...art} />
    </label>
  );

  return (
    <>
      <div className={`grid gap-2 ${breit}`}>
        <input type="hidden" name="kunde_id" value={wahl?.kunde.id ?? ""} />
        <input type="hidden" name="fahrzeug_id" value={wahl?.fahrzeug?.id ?? ""} />
        {wahl ? (
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md bg-papier px-3 py-2 text-sm">
            <span className="min-w-0 flex-1">
              Verknüpft mit <strong>{wahl.kunde.name}</strong> <span className="text-grau">(Kunde Nr. {wahl.kunde.nummer}{wahl.fahrzeug ? `, ${wahl.fahrzeug.kennzeichen}` : ""})</span>
            </span>
            <button type="button" onClick={() => setSuchen((s) => !s)} className="text-grau underline">
              anderen wählen
            </button>
            <button type="button" onClick={() => (setWahl(null), setSuchen(false))} className="text-grau underline">
              lösen
            </button>
          </p>
        ) : (
          <button type="button" onClick={() => setSuchen((s) => !s)} aria-expanded={suchen} className="knopf knopf-rahmen knopf-klein justify-self-start">
            {suchen ? "Suche schließen" : "Kunde aus der Kartei wählen"}
          </button>
        )}
        {suchen ? (
          <div className="rounded-md border border-linie p-3">
            <KundenSuche zuletzt={zuletzt} onWahl={waehlen} autoFocus={!kompakt} />
          </div>
        ) : null}
      </div>
      {feld("name", "Name", { required: true, autoComplete: "off" })}
      {feld("telefon", "Telefon", { type: "tel", inputMode: "tel" })}
      {feld("kennzeichen", "Kennzeichen", { autoCapitalize: "characters", className: "feld uppercase" })}
      {feld("email", "E-Mail (für die Bestätigung)", { type: "email" })}
      {!kompakt || w.fahrzeug ? feld("fahrzeug", "Fahrzeug", { placeholder: "Marke, Modell" }) : null}
    </>
  );
}
