"use client";

import Link from "next/link";

/**
 * Fehlerseite für Verwaltung und Handy-Apps. Im Betrieb zeigt Next.js die Meldung vom Server nicht im
 * Browser, nur den Fehlercode. Unter diesem Code steht der Fehler mit Ursache im Fehlerprotokoll.
 */
export function FehlerIntern({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const entwicklung = process.env.NODE_ENV === "development";
  return (
    <div className="flex min-h-[50dvh] flex-col justify-center gap-4 px-4 py-10">
      <h1 className="text-2xl font-semibold">Da ist etwas schiefgelaufen.</h1>
      <p className="max-w-lg text-grau">
        Der Fehler ist im Fehlerprotokoll gespeichert (Verwaltung → Einstellungen → Fehler), dort steht auch, was zu tun ist.
      </p>
      {entwicklung && error.message ? <p className="max-w-2xl whitespace-pre-wrap rounded-lg bg-flaeche p-4 text-sm">{error.message}</p> : null}
      {error.digest ? (
        <p className="text-sm text-grau">
          Fehlercode <span className="zahlen select-all text-tinte">{error.digest}</span>
        </p>
      ) : null}
      <div className="flex flex-wrap gap-3">
        <button onClick={() => retry()} className="knopf knopf-dunkel w-fit">Noch einmal versuchen</button>
        <Link href={`/admin/einstellungen?bereich=fehler${error.digest ? `&code=${encodeURIComponent(error.digest)}` : ""}`} className="knopf knopf-rahmen w-fit">
          Fehlerprotokoll
        </Link>
      </div>
    </div>
  );
}
