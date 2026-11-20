"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { kundeAnlegenAktion } from "@/lib/aktionen/kunden";
import { LEER } from "@/lib/forms";

const FELDER: { name: string; label: string; typ?: string; modus?: "tel" | "email" | "numeric"; auto?: string; breit?: boolean; gross?: boolean }[] = [
  { name: "name", label: "Name", auto: "name", breit: true },
  { name: "telefon", label: "Telefon", typ: "tel", modus: "tel", auto: "tel", breit: true },
  { name: "email", label: "E-Mail", typ: "email", modus: "email", auto: "email", breit: true },
  { name: "strasse", label: "Straße", auto: "street-address", breit: true },
  { name: "plz", label: "PLZ", modus: "numeric", auto: "postal-code" },
  { name: "ort", label: "Ort", auto: "address-level2" },
  { name: "firma", label: "Firma (optional)", auto: "organization", breit: true },
];

/**
 * Kunde unterwegs anlegen: das Nötigste untereinander, große Felder, passende Tastaturen. Das erste
 * Fahrzeug gleich mit, weil fast jeder Beleg ein Kennzeichen braucht.
 */
export function KundeNeuFormular() {
  const [zustand, aktion] = useActionState(kundeAnlegenAktion.bind(null, "app"), LEER);
  const w = (n: string) => zustand.werte?.[n] ?? "";
  return (
    <form action={aktion} key={zustand.versuch} className="grid gap-6">
      <fieldset className="grid grid-cols-2 gap-3">
        <legend className="mb-2 font-semibold">Kontakt</legend>
        {FELDER.map((f) => (
          <label key={f.name} className={`block min-w-0 ${f.breit ? "col-span-2" : ""}`}>
            <span className="label">{f.label}</span>
            <input name={f.name} type={f.typ ?? "text"} inputMode={f.modus} autoComplete={f.auto} defaultValue={w(f.name)} required={f.name === "name"} className="feld" />
          </label>
        ))}
      </fieldset>
      <fieldset className="grid grid-cols-2 gap-3">
        <legend className="mb-2 font-semibold">Fahrzeug (optional)</legend>
        <label className="col-span-2 block">
          <span className="label">Kennzeichen</span>
          <input name="kennzeichen" autoCapitalize="characters" autoComplete="off" placeholder="OF-AB 123" defaultValue={w("kennzeichen")} className="feld uppercase" />
        </label>
        <label className="block min-w-0">
          <span className="label">Marke / Modell</span>
          <input name="marke_modell" autoComplete="off" defaultValue={w("marke_modell")} className="feld" />
        </label>
        <label className="block min-w-0">
          <span className="label">km-Stand</span>
          <input name="km_stand" inputMode="numeric" autoComplete="off" defaultValue={w("km_stand")} className="feld" />
        </label>
      </fieldset>
      <div className="sticky bottom-[calc(3.5rem+1px+env(safe-area-inset-bottom)-var(--luecke,0px))] -mx-4 grid gap-2 border-t border-linie bg-weiss/95 px-4 py-3 backdrop-blur-sm">
        {zustand.status === "fehler" ? <p role="alert" className="text-sm font-semibold text-rot">{zustand.meldung}</p> : null}
        <Anlegen />
      </div>
    </form>
  );
}

function Anlegen() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={`knopf knopf-dunkel w-full ${pending ? "opacity-60" : ""}`}>
      {pending ? "Wird angelegt …" : "Kunde anlegen"}
    </button>
  );
}
