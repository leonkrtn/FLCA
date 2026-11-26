import { Formular, Senden } from "@/components/admin/formular";
import { Abschnitt, Leer, Marke } from "@/components/admin/ui";
import { systemcheckStarten } from "@/lib/aktionen/einstellungen";
import { datumZeit } from "@/lib/format";
import { laeufeLaden } from "@/lib/systemcheck/lauf";
import type { Pruefung } from "@/lib/systemcheck/regeln";

const MARKE = {
  ok: { ton: "ok", text: "OK" },
  warnung: { ton: "warnung", text: "Hinweis" },
  fehler: { ton: "rot", text: "Fehler" },
} as const;

function Zeile({ p }: { p: Pruefung }) {
  const m = MARKE[p.stand];
  return (
    <li className="grid grid-cols-[auto_1fr_auto] items-baseline gap-x-3 gap-y-1 py-2">
      <Marke ton={m.ton}>{m.text}</Marke>
      <span className="min-w-0">
        <span className="font-semibold">{p.gruppe}: {p.name}</span>
        {p.text ? <span className="block whitespace-pre-wrap break-words text-sm text-grau">{p.text}</span> : null}
      </span>
      <span className="zahlen text-xs text-grau">{p.ms} ms</span>
    </li>
  );
}

/**
 * Systemcheck in Einstellungen → Fehler: Knopf und Ergebnis des letzten Laufs (Knopf oder Nacht). Rot und Gelb
 * stehen offen da, Grünes zugeklappt.
 */
export async function SystemcheckBereich() {
  const { laeufe, unmigriert } = await laeufeLaden(1);
  const lauf = laeufe[0];
  const offen = lauf?.pruefungen.filter((p) => p.stand !== "ok") ?? [];
  const gruen = lauf?.pruefungen.filter((p) => p.stand === "ok") ?? [];
  return (
    <Abschnitt titel="Systemcheck">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <p className="max-w-2xl text-sm text-grau">
          Prüft Lesen und Schreiben der Datenbank, Belege, Versand, Dienste, Zeitsteuerung und Ablagen. Testdaten werden sofort zurückgenommen, es geht keine Mail
          und keine Nachricht raus. Läuft zusätzlich jede Nacht um 3 Uhr; ist etwas rot, bekommt der Inhaber eine Push-Nachricht.
        </p>
        <Formular aktion={systemcheckStarten}>
          <Senden art="rahmen" klein>Jetzt prüfen</Senden>
        </Formular>
      </div>
      {unmigriert ? (
        <p className="max-w-2xl text-sm">
          Für den Systemcheck bitte die Migration <span className="zahlen">20261206100000_systemcheck.sql</span> im SQL-Editor von Supabase ausführen. Bis dahin
          zeigt der Knopf kein gespeichertes Ergebnis.
        </p>
      ) : lauf ? (
        <>
          <p className="zahlen mb-2 text-sm">
            Letzter Lauf {datumZeit(lauf.gestartet_am)} ({lauf.ausgeloest === "nacht" ? "nachts" : "per Knopf"}) · {lauf.rot} rot · {lauf.gelb} gelb · {gruen.length} grün ·{" "}
            {(lauf.dauer_ms / 1000).toLocaleString("de-DE", { maximumFractionDigits: 1 })} s
          </p>
          {offen.length ? (
            <ul className="divide-y divide-linie">
              {offen.map((p) => (
                <Zeile key={`${p.gruppe}:${p.name}`} p={p} />
              ))}
            </ul>
          ) : null}
          {gruen.length ? (
            <details className="mt-2">
              <summary className="cursor-pointer text-sm text-grau">{gruen.length} Prüfungen in Ordnung</summary>
              <ul className="divide-y divide-linie">
                {gruen.map((p) => (
                  <Zeile key={`${p.gruppe}:${p.name}`} p={p} />
                ))}
              </ul>
            </details>
          ) : null}
        </>
      ) : (
        <Leer>Noch kein Systemcheck gelaufen.</Leer>
      )}
    </Abschnitt>
  );
}
