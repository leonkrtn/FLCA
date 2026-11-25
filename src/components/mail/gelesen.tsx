"use client";

import { useEffect, useRef } from "react";
import { alsGelesen } from "@/lib/aktionen/mail";

/** Öffnen heißt gelesen: einmal nach dem Anzeigen, damit die Zähler im Menü nachziehen. */
export function AlsGelesen({ gespraech }: { gespraech: string }) {
  const erledigt = useRef(false);
  useEffect(() => {
    if (erledigt.current) return;
    erledigt.current = true;
    alsGelesen(gespraech).catch(() => undefined);
  }, [gespraech]);
  return null;
}
