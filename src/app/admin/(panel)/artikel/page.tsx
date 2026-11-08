import { Formular, Senden } from "@/components/admin/formular";
import { Abschnitt, Auswahl, Feld, Kopf, Schalter } from "@/components/admin/ui";
import { artikelSpeichern } from "@/lib/aktionen/rechnungen";
import { benutzerMitRecht } from "@/lib/auth";
import { db } from "@/lib/supabase/admin";

export const metadata = { title: "Artikel" };

type A = { id: string; nummer: string; name: string; einheit: string; preis_brutto_cent: number; mwst_satz: number; aktiv: boolean; leistung_id: string | null };

/**
 * Eine Artikelzeile als eigenes Formular. Am breiten Bildschirm alles in einer Reihe, darunter in zwei
 * Reihen, damit nichts gequetscht wird. Knopf und Häkchen sind so hoch wie die Felder und stehen auf
 * derselben Grundlinie.
 */
function Zeile({ a, leistungen }: { a?: A; leistungen: [string, string][] }) {
  return (
    <Formular
      aktion={artikelSpeichern.bind(null, a?.id ?? null)}
      zuruecksetzen={!a}
      className="grid items-end gap-3 border-b border-linie py-4 last:border-0 sm:grid-cols-6 xl:grid-cols-[8.5rem_minmax(0,1fr)_8rem_7.5rem_5.5rem_11rem_auto_8.5rem]"
    >
      <Feld label="Nr." name="nummer" wert={a?.nummer} className="sm:col-span-1 xl:col-span-1" />
      <Feld label="Bezeichnung" name="name" wert={a?.name} required className="sm:col-span-3 xl:col-span-1" />
      <Auswahl label="Einheit" name="einheit" wert={a?.einheit ?? "Stk"} optionen={["Stk", "Std", "Pauschal", "l", "Satz", "km"].map((x) => [x, x])} className="sm:col-span-2 xl:col-span-1" />
      <Feld label="Preis brutto €" name="preis" wert={a ? (a.preis_brutto_cent / 100).toFixed(2).replace(".", ",") : ""} inputMode="decimal" className="sm:col-span-2 xl:col-span-1 [&_input]:text-right [&_input]:tabular-nums" />
      <Auswahl label="MwSt." name="mwst_satz" wert={String(a?.mwst_satz ?? 19)} optionen={[["19", "19 %"], ["7", "7 %"], ["0", "0 %"]]} className="sm:col-span-1 xl:col-span-1" />
      <Auswahl label="Gehört zu Leistung" name="leistung_id" wert={a?.leistung_id} leer="–" optionen={leistungen} className="sm:col-span-3 xl:col-span-1" />
      <div className="sm:col-span-3 xl:col-span-1">
        <Schalter label="aktiv" name="aktiv" an={a?.aktiv ?? true} zeile />
      </div>
      <Senden className="w-full sm:col-span-3 xl:col-span-1" vorab={a ? "Gespeichert" : "Angelegt"}>
        {a ? "Speichern" : "Anlegen"}
      </Senden>
    </Formular>
  );
}

export default async function ArtikelSeite() {
  await benutzerMitRecht("rechnungen");
  const [{ data }, { data: l }] = await Promise.all([db().from("artikel").select("*").order("sortierung"), db().from("leistungen").select("id, name").order("sortierung")]);
  const leistungen = (l ?? []).map((x) => [x.id, x.name] as [string, string]);
  return (
    <>
      <Kopf titel="Artikel" unter="Feste Positionen für Rechnungen. Ist ein Artikel einer Leistung zugeordnet, steht er in der Rechnung zum Termin schon drin." />
      <Abschnitt titel="Neuer Artikel">
        <Zeile leistungen={leistungen} />
      </Abschnitt>
      <Abschnitt>
        {((data ?? []) as A[]).map((a) => (
          <Zeile key={a.id} a={a} leistungen={leistungen} />
        ))}
      </Abschnitt>
    </>
  );
}
