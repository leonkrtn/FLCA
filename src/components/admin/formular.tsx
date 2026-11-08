"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
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
  const [zustand, ausfuehren] = useActionState(aktion, LEER);
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

export function Senden({ children, art = "dunkel", klein = false, className = "", name, value }: { children: React.ReactNode; art?: "dunkel" | "rot" | "rahmen"; klein?: boolean; className?: string; name?: string; value?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" name={name} value={value} disabled={pending} className={`knopf knopf-${art} ${klein ? "knopf-klein" : ""} ${className}`}>
      {pending ? "…" : children}
    </button>
  );
}
