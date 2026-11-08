import { Formular, Senden } from "@/components/admin/formular";
import { Abschnitt, Auswahl, Feld, Kopf, Schalter } from "@/components/admin/ui";
import { artikelSpeichern } from "@/lib/aktionen/rechnungen";
import { benutzerMitRecht } from "@/lib/auth";
import { db } from "@/lib/supabase/admin";

export const metadata = { title: "Artikel" };

type A = { id: string; nummer: string; name: string; einheit: string; preis_brutto_cent: number; mwst_satz: number; aktiv: boolean; leistung_id: string | null };

function Zeile({ a, leistungen }: { a?: A; leistungen: [string, string][] }) {
  return (
    <Formular aktion={artikelSpeichern.bind(null, a?.id ?? null)} zuruecksetzen={!a} className="grid items-end gap-3 border-b border-linie py-3 sm:grid-cols-[6rem_minmax(0,1fr)_6rem_7rem_5rem_10rem_auto_auto]">
      <Feld label="Nr." name="nummer" wert={a?.nummer} />
      <Feld label="Bezeichnung" name="name" wert={a?.name} required />
      <Auswahl label="Einheit" name="einheit" wert={a?.einheit ?? "Stk"} optionen={["Stk", "Std", "Pauschal", "l", "Satz", "km"].map((x) => [x, x])} />
      <Feld label="Preis brutto €" name="preis" wert={a ? (a.preis_brutto_cent / 100).toFixed(2).replace(".", ",") : ""} inputMode="decimal" />
      <Auswahl label="MwSt." name="mwst_satz" wert={String(a?.mwst_satz ?? 19)} optionen={[["19", "19 %"], ["7", "7 %"], ["0", "0 %"]]} />
      <Auswahl label="Gehört zu Leistung" name="leistung_id" wert={a?.leistung_id} leer="–" optionen={leistungen} />
      <div className="pb-3"><Schalter label="aktiv" name="aktiv" an={a?.aktiv ?? true} /></div>
      <Senden klein>{a ? "Speichern" : "Anlegen"}</Senden>
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
