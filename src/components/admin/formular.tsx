"use client";

import { useActionState, useEffect, useRef, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { Haken } from "@/components/icons";
import { type Ergebnis, LEER } from "@/lib/forms";

type Aktion = (vorher: Ergebnis, formData: FormData) => Promise<Ergebnis>;

/**
 * Formular für Server Actions mit Rückmeldung. Fehler lassen das Formular mit allen Eingaben stehen.
 * `zuruecksetzen` leert es nach Erfolg (z. B. „Position hinzufügen“).
 */
export function Formular({
  aktion,
  children,
  className = "",
  zuruecksetzen = false,
  bestaetigen,
}: {
  aktion: Aktion;
  children: React.ReactNode;
  className?: string;
  zuruecksetzen?: boolean;
  bestaetigen?: string;
}) {
  // Die letzte Eingabe merken: Meldet die Aktion nur eine Warnung (z. B. „Max hat da schon einen Termin“),
  // speichert „Trotzdem speichern“ genau diese Eingabe mit ueberbuchen=on, ohne alles neu auszufüllen.
  const letzte = useRef<FormData | null>(null);
  const [zustand, ausfuehren] = useActionState(async (vorher: Ergebnis, fd: FormData) => {
    letzte.current = fd;
    return aktion(vorher, fd);
  }, LEER);
  const [trotzdemLaeuft, starten] = useTransition();
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (zustand.status === "ok" && zuruecksetzen) ref.current?.reset();
  }, [zustand, zuruecksetzen]);
  return (
    <form
      ref={ref}
      action={ausfuehren}
      className={className}
      onSubmit={(e) => {
        if (bestaetigen && !window.confirm(bestaetigen)) e.preventDefault();
      }}
    >
      {children}
      <Meldung zustand={zustand} />
      {zustand.status === "fehler" && Array.isArray(zustand.daten?.warnungen) ? (
        <button
          type="button"
          disabled={trotzdemLaeuft}
          className={`knopf knopf-rahmen knopf-klein mt-2 ${trotzdemLaeuft ? "cursor-progress opacity-60" : ""}`}
          onClick={() => {
            if (!letzte.current) return;
            const fd = new FormData();
            for (const [k, v] of letzte.current.entries()) fd.append(k, v);
            fd.set("ueberbuchen", "on");
            starten(() => ausfuehren(fd));
          }}
        >
          Trotzdem speichern
        </button>
      ) : null}
    </form>
  );
}

function Meldung({ zustand }: { zustand: Ergebnis }) {
  const { pending } = useFormStatus();
  if (pending || zustand.status === "leer" || !zustand.meldung) return null;
  return (
    <p role="status" className={`mt-3 text-sm font-semibold ${zustand.status === "fehler" ? "text-rot" : "text-ok"}`}>
      {zustand.meldung}
    </p>
  );
}

/**
 * Absendeknopf. Während die Aktion läuft, zeigt `vorab` schon das erwartete Ergebnis („Angenommen“,
 * „Eingestempelt“): Der Tipp wirkt sofort, die Seite zieht nach, sobald der Server fertig ist. Geht
 * etwas schief, steht der Knopf wieder wie vorher da und darunter die Meldung.
 * Ohne `vorab` bleibt der Text stehen (kein Springen der Breite), der Knopf wird nur blasser.
 * Bei mehreren Knöpfen in einem Formular reagiert nur der gedrückte (erkannt an name/value).
 */
export function Senden({
  children,
  art = "dunkel",
  klein = false,
  className = "",
  name,
  value,
  vorab,
}: {
  children: React.ReactNode;
  art?: "dunkel" | "rot" | "rahmen";
  klein?: boolean;
  className?: string;
  name?: string;
  value?: string;
  vorab?: React.ReactNode;
}) {
  const { pending, data } = useFormStatus();
  const gedrueckt = pending && (!name || data?.get(name) === value);
  return (
    <button
      type="submit"
      name={name}
      value={value}
      disabled={pending}
      aria-busy={gedrueckt || undefined}
      className={`knopf knopf-${art} ${klein ? "knopf-klein" : ""} ${pending && !(gedrueckt && vorab) ? "cursor-progress opacity-60" : ""} ${className}`}
    >
      {gedrueckt && vorab ? (
        <>
          <Haken className="size-4" /> {vorab}
        </>
      ) : (
        children
      )}
    </button>
  );
}
