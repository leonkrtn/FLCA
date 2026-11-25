"use client";

import { useEffect, useRef } from "react";
import { useSchreiben } from "./schreiben";

/** Öffnet beim Laden das Schreibfenster (Adresse …/mail/neu, z. B. „Mail schreiben“ aus der Kundenakte). */
export function NeuOeffnen({ wunsch }: { wunsch: { postfach?: "firma" | "ich"; an?: string; betreff?: string } }) {
  const oeffnen = useSchreiben();
  const offen = useRef(false);
  useEffect(() => {
    if (offen.current) return;
    offen.current = true;
    oeffnen("neu", null, wunsch);
  }, [oeffnen, wunsch]);
  return null;
}
