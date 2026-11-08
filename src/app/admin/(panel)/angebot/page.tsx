import Link from "next/link";
import { Formular, Senden } from "@/components/admin/formular";
import { Abschnitt, Auswahl, Feld, Kopf, Leer, Marke, Reiter, Schalter } from "@/components/admin/ui";
import { artikelSpeichern } from "@/lib/aktionen/rechnungen";
import { benutzerMitRecht } from "@/lib/auth";
import { euro } from "@/lib/format";
import { db } from "@/lib/supabase/admin";

export const metadata = { title: "Angebot" };

/** Eine feste Position des Angebots. In der Datenbank heißt die Tabelle weiter „artikel“. */
type Position = { id: string; nummer: string; name: string; einheit: string; preis_brutto_cent: number; mwst_satz: number; aktiv: boolean; leistung_id: string | null };

const EINHEITEN = ["Stk", "Std", "Pauschal", "l", "Satz", "km"];
const ANSICHTEN = { aktiv: "Aktiv", inaktiv: "Ausgeblendet", alle: "Alle" } as const;

/** Spalten der Liste, einmal festgelegt für Kopf und Zeilen, damit alles untereinander steht. */
const SPALTEN = "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 md:grid-cols-[6.5rem_minmax(0,1fr)_5.5rem_4.5rem_7rem]";

const netto = (p: Position) => Math.round(p.preis_brutto_cent / (1 + Number(p.mwst_satz) / 100));

/**
 * Das Angebot: alle festen Positionen mit Preis, aus denen Rechnungen zusammengestellt werden.
 * Links die Liste, rechts das Feld zum Bearbeiten. Welche Position offen ist, steht in der URL
 * (?bearbeiten=…), so funktionieren Zurück-Taste und Links. Gruppiert wird danach, ob eine Position
 * zu einer Leistung gehört: Die steht in der Rechnung zum Termin schon drin.
 */
export default async function AngebotSeite({ searchParams }: { searchParams: Promise<{ bearbeiten?: string; ansicht?: string; q?: string }> }) {
  await benutzerMitRecht("rechnungen");
  const sp = await searchParams;
  const ansicht = (sp.ansicht && sp.ansicht in ANSICHTEN ? sp.ansicht : "aktiv") as keyof typeof ANSICHTEN;
  const q = (sp.q ?? "").trim().toLowerCase();
  const [{ data }, { data: l }] = await Promise.all([db().from("artikel").select("*").order("sortierung"), db().from("leistungen").select("id, name").order("sortierung")]);
  const alle = (data ?? []) as Position[];
  const leistungen = (l ?? []).map((x) => [x.id, x.name] as [string, string]);
  const leistungName = new Map(leistungen);

  const liste = alle
    .filter((p) => (ansicht === "aktiv" ? p.aktiv : ansicht === "inaktiv" ? !p.aktiv : true))
    .filter((p) => !q || [p.name, p.nummer, p.leistung_id ? leistungName.get(p.leistung_id) : ""].some((x) => x?.toLowerCase().includes(q)));
  const gruppen = [
    { titel: "Gehört zu einer Leistung", hinweis: "steht in der Rechnung zum Termin schon drin", eintraege: liste.filter((p) => p.leistung_id) },
    { titel: "Weitere Positionen", hinweis: "Teile, Material, Arbeitszeit", eintraege: liste.filter((p) => !p.leistung_id) },
  ].filter((g) => g.eintraege.length);

  const offen = sp.bearbeiten === "neu" ? "neu" : alle.find((p) => p.id === sp.bearbeiten);
  const link = (extra: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const werte = { ansicht: ansicht === "aktiv" ? undefined : ansicht, q: sp.q || undefined, ...extra };
    for (const [k, v] of Object.entries(werte)) if (v) p.set(k, v);
    const s = p.toString();
    return `/admin/angebot${s ? `?${s}` : ""}`;
  };

  return (
    <>
      <Kopf titel="Angebot" unter={`${alle.filter((p) => p.aktiv).length} aktive Positionen mit festem Preis. Daraus stellen Sie Rechnungen zusammen.`}>
        <Link href={link({ bearbeiten: "neu" })} className="knopf knopf-dunkel">
          Neue Position
        </Link>
      </Kopf>

      <Reiter aktiv={link({})} eintraege={Object.entries(ANSICHTEN).map(([k, t]) => ({ href: link({ ansicht: k === "aktiv" ? undefined : k }), text: t }))} />

      <div className={`grid items-start gap-x-8 ${offen ? "lg:grid-cols-[minmax(0,1fr)_22rem]" : ""}`}>
        {offen ? (
          <div className="lg:sticky lg:top-6 lg:order-2">
            <Bearbeiten p={offen === "neu" ? undefined : offen} leistungen={leistungen} schliessen={link({})} />
          </div>
        ) : null}

        <div className="min-w-0">
          <form className="mb-4 max-w-sm" action="/admin/angebot">
            {ansicht !== "aktiv" ? <input type="hidden" name="ansicht" value={ansicht} /> : null}
            <input name="q" defaultValue={sp.q} placeholder="Suche: Bezeichnung, Nummer, Leistung" className="feld" aria-label="Suche" />
          </form>

          {gruppen.length ? (
            gruppen.map((g) => (
              <section key={g.titel} className="mb-8 bg-weiss">
                <div className="flex h-12 items-center justify-between gap-4 border-b border-linie px-4 md:px-6">
                  <h2 className="truncate font-semibold">{g.titel}</h2>
                  <span className="hidden truncate text-sm text-grau sm:block">{g.hinweis}</span>
                </div>
                <div className={`${SPALTEN} hidden border-b-2 border-tinte px-4 py-2 text-sm font-semibold md:grid md:px-6`}>
                  <span>Nr.</span>
                  <span>Bezeichnung</span>
                  <span>Einheit</span>
                  <span className="text-right">MwSt.</span>
                  <span className="text-right">Preis</span>
                </div>
                <ul className="divide-y divide-linie">
                  {g.eintraege.map((p) => {
                    const gewaehlt = offen !== "neu" && offen?.id === p.id;
                    return (
                      <li key={p.id}>
                        <Link
                          href={link({ bearbeiten: p.id })}
                          aria-current={gewaehlt ? "true" : undefined}
                          scroll={false}
                          className={`${SPALTEN} relative min-h-16 px-4 py-3 transition-colors md:px-6 ${gewaehlt ? "bg-papier" : "hover:bg-papier"} ${p.aktiv ? "" : "text-grau"}`}
                        >
                          {gewaehlt ? <span className="absolute inset-y-0 left-0 w-1 bg-tinte" aria-hidden /> : null}
                          <span className="hidden truncate text-sm tabular-nums text-grau md:block">{p.nummer || "–"}</span>
                          <span className="min-w-0">
                            <span className="flex items-center gap-2">
                              <span className="truncate font-semibold">{p.name}</span>
                              {!p.aktiv ? <Marke ton="hell">ausgeblendet</Marke> : null}
                            </span>
                            <span className="block truncate text-sm text-grau">
                              {p.leistung_id ? `zur Leistung ${leistungName.get(p.leistung_id) ?? ""}` : "frei verwendbar"}
                              {/* Nummer und Einheit haben am Rechner eigene Spalten, auf dem Telefon stehen sie hier. */}
                              <span className="md:hidden">
                                {p.nummer ? ` · Nr. ${p.nummer}` : ""} · {p.einheit}
                              </span>
                            </span>
                          </span>
                          <span className="hidden text-grau md:block">{p.einheit}</span>
                          <span className="hidden text-right tabular-nums text-grau md:block">{Number(p.mwst_satz)} %</span>
                          <span className="text-right">
                            <span className="block font-semibold tabular-nums">{euro(p.preis_brutto_cent)}</span>
                            <span className="block text-xs tabular-nums text-grau">netto {euro(netto(p))}</span>
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))
          ) : (
            <div className="bg-weiss">
              <Leer>{q ? "Keine Position passt zur Suche." : "Noch keine Positionen. Legen Sie die erste an."}</Leer>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

/** Feld zum Anlegen oder Bearbeiten. Der key sorgt dafür, dass beim Wechsel der Position die neuen Werte drinstehen. */
function Bearbeiten({ p, leistungen, schliessen }: { p?: Position; leistungen: [string, string][]; schliessen: string }) {
  return (
    <Abschnitt
      titel={p ? "Position bearbeiten" : "Neue Position"}
      aktion={
        <Link href={schliessen} scroll={false} className="knopf knopf-rahmen knopf-klein">
          Schließen
        </Link>
      }
    >
      <Formular key={p?.id ?? "neu"} aktion={artikelSpeichern.bind(null, p?.id ?? null)} zuruecksetzen={!p} className="grid grid-cols-2 gap-4">
        <Feld label="Bezeichnung" name="name" wert={p?.name} required className="col-span-2" placeholder="z. B. Ventil, Arbeitszeit, Altreifen-Entsorgung" />
        <Feld label="Nummer" name="nummer" wert={p?.nummer} placeholder="optional" />
        <Auswahl label="Einheit" name="einheit" wert={p?.einheit ?? "Stk"} optionen={EINHEITEN.map((x) => [x, x])} />
        <Feld label="Preis brutto €" name="preis" wert={p ? (p.preis_brutto_cent / 100).toFixed(2).replace(".", ",") : ""} inputMode="decimal" className="[&_input]:text-right [&_input]:tabular-nums" />
        <Auswahl label="MwSt." name="mwst_satz" wert={String(p?.mwst_satz ?? 19)} optionen={[["19", "19 %"], ["7", "7 %"], ["0", "0 %"]]} />
        <Auswahl label="Gehört zu Leistung" name="leistung_id" wert={p?.leistung_id} leer="keine" optionen={leistungen} className="col-span-2" />
        <div className="col-span-2">
          <Schalter label="Aktiv" name="aktiv" an={p?.aktiv ?? true} hilfe="Steht beim Schreiben einer Rechnung zur Auswahl." />
        </div>
        <Senden className="col-span-2" vorab={p ? "Gespeichert" : "Angelegt"}>
          {p ? "Speichern" : "Anlegen"}
        </Senden>
      </Formular>
    </Abschnitt>
  );
}
