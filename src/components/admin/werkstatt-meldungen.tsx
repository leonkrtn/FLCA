import Link from "next/link";
import { Formular, Senden } from "@/components/admin/formular";
import { Marke } from "@/components/admin/ui";
import { meldungStatus } from "@/lib/aktionen/team";
import { arbeitsMinuten } from "@/lib/auftrag-regeln";
import { weich } from "@/lib/fehler";
import { datumKurzText, datumZeit, zeit } from "@/lib/format";
import { auftragZeiten, type Meldung, MELDUNG_STATUS, MELDUNG_TEXT, meldungenZumTermin } from "@/lib/werkstatt";
import { stunden } from "@/lib/zeiterfassung";

/** Knöpfe zum Abarbeiten einer Meldung: Teile erst bestellt, dann da; Befunde gleich erledigt. */
export function MeldungKnoepfe({ m }: { m: Meldung }) {
  return (
    <Formular aktion={meldungStatus.bind(null, m.id)} className="flex flex-wrap gap-2">
      {m.art === "teil" && m.status === "offen" ? <Senden klein art="rahmen" name="status" value="bestellt" vorab="Bestellt">Bestellt</Senden> : null}
      {m.status !== "erledigt" ? (
        <Senden klein name="status" value="erledigt" vorab="Erledigt">
          {m.art === "teil" ? "Ist da" : "Erledigt"}
        </Senden>
      ) : (
        <Senden klein art="rahmen" name="status" value="offen" vorab="Wieder offen">Wieder öffnen</Senden>
      )}
    </Formular>
  );
}

export function MeldungZeile({ m, mitTermin = false, basis = "/admin" }: { m: Meldung; mitTermin?: boolean; basis?: string }) {
  return (
    <li className="flex flex-wrap items-start justify-between gap-3 py-3">
      <div className="min-w-0">
        <p>
          <span className="font-semibold">{MELDUNG_TEXT[m.art]}{m.art === "teil" ? ` · ${String(m.menge).replace(".", ",")} ×` : ""}</span> {m.text}{" "}
          {m.dringend && m.status !== "erledigt" ? <Marke ton="warnung">dringend</Marke> : null}
        </p>
        <p className="text-sm text-grau">
          {m.profil?.name ?? "?"} · {datumZeit(m.erstellt_am)} · {MELDUNG_STATUS[m.status]}
          {mitTermin && m.termin ? (
            <>
              {" · "}
              <Link href={`${basis}/termine/${m.termin.id}`} className="underline">
                {m.termin.leistung_name}
                {m.termin.fahrzeug ? `, ${m.termin.fahrzeug.kennzeichen}` : ""} ({datumKurzText(m.termin.beginn)})
              </Link>
            </>
          ) : null}
        </p>
      </div>
      <MeldungKnoepfe m={m} />
    </li>
  );
}

/**
 * Was die Werkstatt am Termin gemeldet und gestempelt hat (Terminseite in Verwaltung und Handy-App).
 * Ohne Meldungen und Zeiten bleibt der Abschnitt weg.
 */
export async function AusDerWerkstatt({ terminId, basis = "/admin", titel }: { terminId: string; basis?: string; titel?: string }) {
  const [meldungen, zeiten] = await Promise.all([
    weich(meldungenZumTermin(terminId), [], "Meldungen am Termin"),
    weich(auftragZeiten([terminId]), [], "Arbeitszeit am Termin"),
  ]);
  if (!meldungen.length && !zeiten.length) return null;
  return (
    <div className="grid gap-4">
      {titel ? <h2 className="font-semibold">{titel}</h2> : null}
      {zeiten.length ? (
        <div>
          <p className="font-semibold">Arbeitszeit am Auftrag: {stunden(arbeitsMinuten(zeiten))}</p>
          <ul className="mt-1 text-sm text-grau">
            {zeiten.map((z) => (
              <li key={z.id} className="zahlen">
                <span className="font-sans">{z.profil?.name ?? "?"}</span> · {datumKurzText(z.beginn)} {zeit(z.beginn)}–{z.ende ? zeit(z.ende) : "läuft"} · {stunden(arbeitsMinuten([z]))}
              </li>
            ))}
          </ul>
          <p className="mt-1 text-xs text-grau">Im Rechnungsentwurf füllt sie leere Lohnpositionen (Einheit Std).</p>
        </div>
      ) : null}
      {meldungen.length ? (
        <ul className="divide-y divide-linie">
          {meldungen.map((m) => (
            <MeldungZeile key={m.id} m={m} basis={basis} />
          ))}
        </ul>
      ) : null}
    </div>
  );
}
