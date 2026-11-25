"use client";

import { useEffect } from "react";

/** Druckdialog öffnen, sobald die Seite (und die Inhalte der Mails) da sind. */
export function AutoDrucken() {
  useEffect(() => {
    const t = setTimeout(() => window.print(), 600);
    return () => clearTimeout(t);
  }, []);
  return (
    <button type="button" onClick={() => window.print()} className="knopf knopf-dunkel mb-6 print:hidden">
      Drucken oder als PDF sichern
    </button>
  );
}
