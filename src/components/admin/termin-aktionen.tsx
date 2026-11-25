"use client";

import { useState } from "react";
import type { Ergebnis } from "@/lib/forms";
import { Formular, Senden } from "./formular";

type A = (v: Ergebnis, fd: FormData) => Promise<Ergebnis>;

const kurz = new Intl.DateTimeFormat("de-DE", { weekday: "short", day: "2-digit", month: "2-digit", timeZone: "UTC" });
const tagText = (d: string) => kurz.format(new Date(`${d}T12:00:00Z`));

/**
 * Die Entscheidungen zu einem Termin. Admin und Handy-App nutzen dieselbe Komponente. Eine Anfrage wird
 * angenommen (ja), abgelehnt (nein) oder mit einem Gegenvorschlag beantwortet; `lage` sagt, ob die Wunschzeit
 * frei ist, `vorschlaege` sind freie Zeiten in der Nähe für einen Vorschlag mit einem Klick. Ein Auftrag ohne
 * Termin wird eingeplant (`einplanen`, Mitarbeiter aus `team`) oder abgesagt. `auftragBleibt`: Am Termin hängt
 * ein Auftrag, an dem noch nicht gearbeitet wird; beim Absagen lässt er sich behalten.
 */
export function TerminAktionen({
  status,
  datum,
  uhrzeit,
  aktionen,
  gross = false,
  lage,
  vorschlagOffen,
  team = [],
  person = null,
  dauer,
  auftragBleibt = false,
}: {
  status: string;
  datum: string;
  uhrzeit: string;
  aktionen: { bestaetigen: A; ablehnen: A; absagen: A; verschieben: A; erledigt: A; gegenvorschlag?: A; einplanen?: A };
  gross?: boolean;
  /** Mitarbeiter fürs Einplanen; `person` ist die schon zugeteilte (sonst „automatisch“). */
  team?: { id: string; name: string }[];
  person?: string | null;
  /** Dauer aus den Leistungen, als Vorgabe beim Einplanen */
  dauer?: number;
  auftragBleibt?: boolean;
  lage?: { frei: boolean; text: string; vorschlaege: { datum: string; uhrzeit: string }[] };
  /** Text, wenn schon ein Vorschlag beim Kunden liegt */
  vorschlagOffen?: string;
}) {
  const [offen, setOffen] = useState<"" | "ablehnen" | "absagen" | "verschieben" | "vorschlag">("");
  const breit = gross ? "w-full" : "";

  if (status === "ungeplant") {
    return (
      <div className="grid gap-3">
        <p className="border-l-4 border-kreide bg-papier px-3 py-2 text-sm">Der Auftrag wartet auf seinen Termin. Er belegt noch keinen Arbeitsplatz und steht in keinem Kalender.</p>
        {aktionen.einplanen ? (
          <Formular aktion={aktionen.einplanen} className="grid grid-cols-2 gap-2">
            <input type="date" name="datum" defaultValue={datum} className="feld" aria-label="Datum" required />
            <input type="time" name="uhrzeit" defaultValue={uhrzeit} className="feld" aria-label="Uhrzeit" required />
            <label className="grid gap-1 text-sm">
              <span className="label">Dauer (Minuten)</span>
              <input type="number" name="dauer" min={1} max={1440} step={5} defaultValue={dauer} className="feld zahlen" />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="label">Mitarbeiter</span>
              <select name="mitarbeiter" defaultValue={person ?? "auto"} className="feld">
                <option value="auto">wer frei ist</option>
                <option value="">niemand</option>
                {team.map((p) => (
                  <option key={p.id} value={p.id}>{p.name || "ohne Namen"}</option>
                ))}
              </select>
            </label>
            <label className="col-span-2 flex items-center gap-2 text-sm text-grau">
              <input type="checkbox" name="ueberbuchen" className="size-4 accent-tinte" /> auch wenn die Werkstatt voll ist oder die Person nicht passt
            </label>
            <Senden art="dunkel" className="col-span-2" vorab="Eingeplant">Einplanen, Kunde bekommt Mail</Senden>
          </Formular>
        ) : null}
        {offen === "absagen" ? (
          <Formular aktion={aktionen.absagen} className="grid gap-2" bestaetigen="Auftrag wirklich absagen? Der Kunde bekommt keine Mail, sag es ihm bitte selbst.">
            <textarea name="grund" rows={2} className="feld" placeholder="Grund (nur intern)" aria-label="Grund" />
            <Senden art="rahmen" vorab="Abgesagt">Auftrag absagen</Senden>
            <button type="button" onClick={() => setOffen("")} className="justify-self-start text-sm text-grau underline">abbrechen</button>
          </Formular>
        ) : (
          <button type="button" onClick={() => setOffen("absagen")} className={`knopf knopf-rahmen ${breit}`}>Auftrag absagen …</button>
        )}
      </div>
    );
  }

  if (status === "angefragt") {
    return (
      <div className="grid gap-3">
        {vorschlagOffen ? <p className="border-l-4 border-kreide bg-papier px-3 py-2 text-sm">{vorschlagOffen}</p> : null}
        {lage && !vorschlagOffen ? (
          <p className={`border-l-4 px-3 py-2 text-sm ${lage.frei ? "border-ok bg-papier" : "border-rot bg-papier font-semibold"}`}>{lage.text}</p>
        ) : null}
        <Formular aktion={aktionen.bestaetigen} className="grid gap-2">
          <Senden art="dunkel" className={breit} vorab="Angenommen">
            {vorschlagOffen ? "Annehmen (Kunde hat zugesagt)" : "Ja, annehmen"}
          </Senden>
        </Formular>
        {aktionen.gegenvorschlag && offen === "vorschlag" ? (
          <Formular aktion={aktionen.gegenvorschlag} className="grid gap-3">
            {lage?.vorschlaege.length ? (
              <div>
                <p className="label">Freie Zeiten in der Nähe</p>
                <div className="flex flex-wrap gap-2">
                  {lage.vorschlaege.map((v) => (
                    <Senden key={`${v.datum}|${v.uhrzeit}`} art="rahmen" klein name="vorschlag" value={`${v.datum}|${v.uhrzeit}`} vorab="Gesendet">
                      <span className="zahlen">{tagText(v.datum)} {v.uhrzeit}</span>
                    </Senden>
                  ))}
                </div>
              </div>
            ) : null}
            <div className="grid grid-cols-2 gap-2">
              <input type="date" name="datum" defaultValue={datum} className="feld" aria-label="Datum des Vorschlags" />
              <input type="time" name="uhrzeit" defaultValue={uhrzeit} className="feld" aria-label="Uhrzeit des Vorschlags" />
            </div>
            <textarea name="nachricht" rows={2} className="feld" placeholder="Nachricht an den Kunden (optional), z. B. Vormittags ist es ruhiger." aria-label="Nachricht an den Kunden" />
            <Senden art="dunkel" className={breit} vorab="Gesendet">Diese Zeit vorschlagen</Senden>
            <p className="text-sm text-grau">Ein Klick auf eine freie Zeit schickt den Vorschlag sofort. Der Kunde bekommt eine Mail und sagt über seinen Link zu oder ab.</p>
            <button type="button" onClick={() => setOffen("")} className="justify-self-start text-sm text-grau underline">abbrechen</button>
          </Formular>
        ) : null}
        {offen === "ablehnen" ? (
          <Formular aktion={aktionen.ablehnen} className="grid gap-2">
            <label className="label" htmlFor="grund">Nachricht an den Kunden (optional)</label>
            <textarea id="grund" name="grund" rows={2} className="feld" placeholder="z. B. Am Freitag geht es ab 14 Uhr, rufen Sie gern an." />
            <Senden art="rahmen" className={breit} vorab="Abgelehnt">Ablehnen und Kunden informieren</Senden>
            <button type="button" onClick={() => setOffen("")} className="justify-self-start text-sm text-grau underline">abbrechen</button>
          </Formular>
        ) : null}
        {!offen ? (
          <div className={`grid gap-2 ${aktionen.gegenvorschlag ? (gross ? "grid-cols-2" : "sm:grid-cols-2") : ""}`}>
            {aktionen.gegenvorschlag ? (
              <button type="button" onClick={() => setOffen("vorschlag")} className={`knopf knopf-rahmen ${breit}`}>
                {vorschlagOffen ? "Neuer Vorschlag …" : "Andere Zeit vorschlagen …"}
              </button>
            ) : null}
            <button type="button" onClick={() => setOffen("ablehnen")} className={`knopf knopf-rahmen ${breit}`}>
              Nein, ablehnen …
            </button>
          </div>
        ) : null}
      </div>
    );
  }

  if (status !== "bestaetigt") return null;
  return (
    <div className="grid gap-3">
      <Formular aktion={aktionen.erledigt} className={`grid gap-2 ${gross ? "" : "sm:grid-cols-2"}`}>
        <Senden art="dunkel" name="art" value="erledigt" className={breit} vorab="Erledigt">Erledigt</Senden>
        <Senden art="rahmen" name="art" value="nicht_erschienen" className={breit} vorab="Vermerkt">Nicht erschienen</Senden>
      </Formular>
      {offen === "verschieben" ? (
        <Formular aktion={aktionen.verschieben} className="grid grid-cols-2 gap-2">
          <input type="date" name="datum" defaultValue={datum} className="feld" aria-label="Neues Datum" />
          <input type="time" name="uhrzeit" defaultValue={uhrzeit} className="feld" aria-label="Neue Uhrzeit" />
          <label className="col-span-2 flex items-center gap-2 text-sm text-grau">
            <input type="checkbox" name="ueberbuchen" className="size-4 accent-tinte" /> auch wenn die Werkstatt voll ist
          </label>
          <Senden art="dunkel" className="col-span-2" vorab="Verschoben">Verschieben, Kunde bekommt Mail</Senden>
        </Formular>
      ) : null}
      {offen === "absagen" ? (
        <Formular aktion={aktionen.absagen} className="grid gap-2" bestaetigen="Termin wirklich absagen? Der Kunde bekommt eine Mail.">
          <textarea name="grund" rows={2} className="feld" placeholder="Grund (nur intern)" aria-label="Grund" />
          {auftragBleibt ? (
            <>
              <Senden art="rahmen" name="nur_zeit" value="1" vorab="Abgesagt">Nur den Termin absagen, Auftrag behalten</Senden>
              <Senden art="rahmen" vorab="Abgesagt">Termin und Auftrag absagen</Senden>
            </>
          ) : (
            <Senden art="rahmen" vorab="Abgesagt">Termin absagen</Senden>
          )}
        </Formular>
      ) : null}
      {!offen ? (
        <div className={`grid gap-2 ${gross ? "grid-cols-2" : "sm:grid-cols-2"}`}>
          <button type="button" onClick={() => setOffen("verschieben")} className="knopf knopf-rahmen">Verschieben …</button>
          <button type="button" onClick={() => setOffen("absagen")} className="knopf knopf-rahmen">Absagen …</button>
        </div>
      ) : (
        <button type="button" onClick={() => setOffen("")} className="text-sm text-grau underline">abbrechen</button>
      )}
    </div>
  );
}
