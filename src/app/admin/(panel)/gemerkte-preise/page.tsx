import { Formular, Senden } from "@/components/admin/formular";
import { Kopf, Leer, Reiter } from "@/components/admin/ui";
import { gemerktAendern, gemerktLoeschen, paketLoeschen, paketUmbenennen } from "@/lib/aktionen/gedaechtnis";
import { benutzerMitRecht } from "@/lib/auth";
import { datum, euro } from "@/lib/format";
import { grundform } from "@/lib/rechnung/aehnlich";
import { berechne } from "@/lib/rechnung/berechnung";
import type { Gemerkt, Paket } from "@/lib/rechnung/preisgedaechtnis";
import { db } from "@/lib/supabase/admin";

export const metadata = { title: "Gemerkte Preise" };

const ANSICHTEN = { preise: "Preise", pakete: "Pakete" } as const;
const zahlText = (n: number | null | undefined) => (n == null ? "" : String(n).replace(".", ","));
const centText = (c: number | null | undefined) => (c == null ? "" : (Number(c) / 100).toFixed(2).replace(".", ","));

/**
 * Was sich das System je Marke + Modell gemerkt hat. Gemerkt wird von selbst beim Stellen einer Rechnung,
 * hier lässt sich ein falscher Preis korrigieren oder löschen. Pakete entstehen beim Stellen, hier werden
 * sie umbenannt oder gelöscht.
 */
export default async function GemerktePreise({ searchParams }: { searchParams: Promise<{ ansicht?: string; q?: string }> }) {
  await benutzerMitRecht("rechnungen");
  const sp = await searchParams;
  const ansicht = sp.ansicht === "pakete" ? "pakete" : "preise";
  const q = grundform(sp.q ?? "");
  const passt = (...felder: string[]) => !q || q.split(" ").every((w) => grundform(felder.join(" ")).includes(w));

  const [pr, pk] = await Promise.all([
    db().from("preis_gedaechtnis").select("*").order("marke").order("modell").order("text").limit(5000),
    db().from("pakete").select("*").order("name").limit(1000),
  ]);
  const fehlt = pr.error?.code === "42P01" || pk.error?.code === "42P01";
  const preise = ((pr.data ?? []) as Gemerkt[]).filter((g) => passt(g.marke, g.modell, g.text));
  const pakete = ((pk.data ?? []) as Paket[]).filter((p) => passt(p.marke, p.modell, p.name));

  // Nach Auto gruppiert, damit man „alles für den Golf“ auf einen Blick sieht.
  const gruppen = new Map<string, Gemerkt[]>();
  for (const g of preise) {
    const k = `${g.marke} ${g.modell}`;
    gruppen.set(k, [...(gruppen.get(k) ?? []), g]);
  }

  const link = (a: string) => `/admin/gemerkte-preise${a === "preise" ? "" : `?ansicht=${a}`}${sp.q ? `${a === "preise" ? "?" : "&"}q=${encodeURIComponent(sp.q)}` : ""}`;

  return (
    <>
      <Kopf
        titel="Gemerkte Preise"
        unter="Beim Stellen einer Rechnung merkt sich jede Position ihren Preis für Marke und Modell. Beim nächsten Auto dieser Art setzt der Editor ihn direkt ein."
      />
      {fehlt ? (
        <p className="mb-6 border-l-2 border-rot bg-weiss px-4 py-3">
          Die Datenbank ist noch nicht auf dem neuen Stand. Bitte im Supabase SQL-Editor <span className="font-semibold">supabase/migrations/20261121150000_preisgedaechtnis.sql</span> ausführen.
        </p>
      ) : null}

      <Reiter aktiv={link(ansicht)} eintraege={Object.entries(ANSICHTEN).map(([k, t]) => ({ href: link(k), text: t, anzahl: k === "preise" ? preise.length : pakete.length }))} />

      <form className="mb-6 max-w-sm" action="/admin/gemerkte-preise">
        {ansicht === "pakete" ? <input type="hidden" name="ansicht" value="pakete" /> : null}
        <input name="q" defaultValue={sp.q} placeholder="Suche: Marke, Modell, Bezeichnung" className="feld" aria-label="Suche" />
      </form>

      {ansicht === "preise" ? (
        gruppen.size ? (
          [...gruppen].map(([auto, eintraege]) => (
            <section key={auto} className="mb-8 bg-weiss">
              <h2 className="flex h-12 items-center border-b border-linie px-4 font-semibold md:px-6">
                {auto} <span className="ml-2 font-normal tabular-nums text-grau">{eintraege.length}</span>
              </h2>
              <ul className="divide-y divide-linie">
                {eintraege.map((g) => (
                  <li key={g.id} className="grid gap-3 px-4 py-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end md:px-6">
                    <div className="min-w-0">
                      <p className="font-semibold">{g.text}</p>
                      <p className="zahlen text-sm text-grau">
                        {zahlText(g.menge)} {g.einheit} × {euro(Number(g.einzel_netto_cent))} netto
                        {g.lohnart ? ` · ${g.lohnart}` : ""}
                        {g.ek_cent ? ` · Einkauf ${euro(Number(g.ek_cent))}` : ""} · {datum(g.aktualisiert_am)}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-end gap-2">
                      <Formular aktion={gemerktAendern.bind(null, g.id)} className="flex flex-wrap items-end gap-2">
                        <label className="block w-20">
                          <span className="mb-1 block text-xs text-grau">Menge</span>
                          <input name="menge" defaultValue={zahlText(g.menge)} inputMode="decimal" className="feld min-h-9 py-1 text-right text-sm" />
                        </label>
                        <label className="block w-28">
                          <span className="mb-1 block text-xs text-grau">€ netto</span>
                          <input name="preis" defaultValue={centText(g.einzel_netto_cent)} inputMode="decimal" className="feld min-h-9 py-1 text-right text-sm" />
                        </label>
                        {g.einheit !== "Std" ? (
                          <label className="block w-28">
                            <span className="mb-1 block text-xs text-grau">Einkauf</span>
                            <input name="ek" defaultValue={centText(g.ek_cent)} inputMode="decimal" className="feld min-h-9 py-1 text-right text-sm" />
                          </label>
                        ) : null}
                        <Senden art="rahmen" klein>Speichern</Senden>
                      </Formular>
                      <form action={gemerktLoeschen.bind(null, g.id)}>
                        <button className="knopf knopf-rahmen knopf-klein">Vergessen</button>
                      </form>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))
        ) : (
          <div className="bg-weiss">
            <Leer>{q ? "Nichts passt zur Suche." : "Noch nichts gemerkt. Sobald eine Rechnung mit Marke und Modell gestellt ist, stehen ihre Preise hier."}</Leer>
          </div>
        )
      ) : pakete.length ? (
        <section className="bg-weiss">
          <ul className="divide-y divide-linie">
            {pakete.map((p) => (
              <li key={p.id} className="grid gap-3 px-4 py-4 md:grid-cols-[minmax(0,1fr)_auto] md:px-6">
                <div className="min-w-0">
                  <p className="font-semibold">
                    {p.name} <span className="font-normal text-grau">· {p.marke ? `${p.marke} ${p.modell}` : "ohne Fahrzeug"}</span>
                  </p>
                  <ul className="mt-1 text-sm text-grau">
                    {p.positionen.map((x, i) => (
                      <li key={i}>
                        {zahlText(x.menge)} {x.einheit} {x.text}
                      </li>
                    ))}
                  </ul>
                  <p className="zahlen mt-1 text-sm">
                    {euro(berechne(p.positionen).netto)} netto · {datum(p.aktualisiert_am)}
                  </p>
                </div>
                <div className="flex flex-wrap items-end gap-2">
                  <Formular aktion={paketUmbenennen.bind(null, p.id)} className="flex items-end gap-2">
                    <label className="block w-44">
                      <span className="mb-1 block text-xs text-grau">Name</span>
                      <input name="name" defaultValue={p.name} className="feld min-h-9 py-1 text-sm" />
                    </label>
                    <Senden art="rahmen" klein>Umbenennen</Senden>
                  </Formular>
                  <form action={paketLoeschen.bind(null, p.id)}>
                    <button className="knopf knopf-rahmen knopf-klein">Löschen</button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <div className="bg-weiss">
          <Leer>{q ? "Kein Paket passt zur Suche." : "Noch keine Pakete. Beim Stellen einer Rechnung lassen sich Positionen als Paket benennen, z. B. „Bremsen vorne“."}</Leer>
        </div>
      )}
    </>
  );
}
