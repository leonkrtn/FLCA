"use client";

import { useEffect, useRef } from "react";
import { alsGelesen } from "@/lib/aktionen/mail";

/** Öffnen heißt gelesen: einmal nach dem Anzeigen, damit die Zähler im Menü nachziehen. */
export function AlsGelesen({ gespraech, mail }: { gespraech?: string; mail?: string }) {
  const erledigt = useRef("");
  useEffect(() => {
    const k = gespraech ?? mail ?? "";
    if (!k || erledigt.current === k) return;
    erledigt.current = k;
    // Schlägt das fehl, bleibt die Mail ungelesen; das Fehlerprotokoll bekommt es über onRequestError
    alsGelesen(gespraech ?? null, mail ?? null).catch(() => undefined);
  }, [gespraech, mail]);
  return null;
}
