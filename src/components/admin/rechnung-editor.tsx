"use client";

import { useActionState, useMemo, useState } from "react";
import { Kreuz } from "@/components/icons";
import { entwurfSpeichernAktion } from "@/lib/aktionen/rechnungen";
import { LEER } from "@/lib/forms";
import { berechne, type Position } from "@/lib/rechnung/berechnung";

type Artikel = { id: string; name: string; einheit: string; preis_brutto_cent: number; mwst_satz: number };
type Daten = {
  empfaenger: Record<string, string>;
  fahrzeug: { kennzeichen?: string; modell?: string; km?: number | null };
  positionen: Position[];
  leistungsdatum: string | null;
  hinweis: string;
};

const euro = (cent: number) => new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(cent / 100);
const centZuText = (c: number) => (c / 100).toFixed(2).replace(".", ",");
const textZuCent = (t: string) => {
  const n = Number(t.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
};

/**
 * Rechnungsentwurf bearbeiten. Beträge werden live mit derselben Funktion gerechnet wie auf dem PDF und
 * in der E-Rechnung (lib/rechnung/berechnung.ts), die Vorschau weicht also nie vom Ergebnis ab.
 */
export function RechnungEditor({ id, start, artikel, kompakt = false }: { id: string; start: Daten; artikel: Artikel[]; kompakt?: boolean }) {
  const [d, setD] = useState<Daten>(start);
  const [preisTexte, setPreisTexte] = useState<string[]>(start.positionen.map((p) => centZuText(p.einzel_brutto_cent)));
  const [zustand, aktion, laeuft] = useActionState(entwurfSpeichernAktion.bind(null, id), LEER);
  const summen = useMemo(() => berechne(d.positionen), [d.positionen]);

  const setPos = (i: number, p: Partial<Position>) => setD((x) => ({ ...x, positionen: x.positionen.map((q, j) => (j === i ? { ...q, ...p } : q)) }));
  const neu = (a?: Artikel) => {
    setD((x) => ({
      ...x,
      positionen: [...x.positionen, { text: a?.name ?? "", menge: 1, einheit: a?.einheit ?? "Stk", einzel_brutto_cent: a?.preis_brutto_cent ?? 0, mwst_satz: a ? Number(a.mwst_satz) : 19, artikel_id: a?.id ?? null }],
    }));
    setPreisTexte((t) => [...t, centZuText(a?.preis_brutto_cent ?? 0)]);
  };
  const weg = (i: number) => {
    setD((x) => ({ ...x, positionen: x.positionen.filter((_, j) => j !== i) }));
    setPreisTexte((t) => t.filter((_, j) => j !== i));
  };
  const e = (k: string) => d.empfaenger[k] ?? "";
  const setE = (k: string, v: string) => setD((x) => ({ ...x, empfaenger: { ...x.empfaenger, [k]: v } }));

  return (
    <form action={aktion} className="grid gap-8">
      <input type="hidden" name="daten" value={JSON.stringify(d)} />

      <section>
        <h2 className="mb-3 font-semibold">Positionen</h2>
        {/* Am Rechner eine Tabelle mit Spaltenköpfen, auf dem Handy je Position zwei Zeilen mit kleinen Beschriftungen. */}
        {!kompakt ? (
          <div className="grid grid-cols-[minmax(0,1fr)_5rem_7rem_7rem_7rem_2.5rem] gap-2 border-b-2 border-tinte pb-2 text-sm font-semibold">
            <span>Bezeichnung</span>
            <span className="text-right">Menge</span>
            <span>Einheit</span>
            <span className="text-right">Einzelpreis</span>
            <span className="text-right">Gesamt</span>
            <span />
          </div>
        ) : null}
        <div className={`divide-y divide-linie border-b border-linie ${kompakt ? "border-t-2 border-t-tinte" : ""}`}>
          {d.positionen.map((p, i) => (
            <div key={i} className={`grid gap-2 py-3 ${kompakt ? "grid-cols-[minmax(0,1fr)_2.5rem]" : "grid-cols-[minmax(0,1fr)_5rem_7rem_7rem_7rem_2.5rem] items-center"}`}>
              <input value={p.text} onChange={(ev) => setPos(i, { text: ev.target.value })} className="feld min-h-10" aria-label="Bezeichnung" placeholder="Bezeichnung" />
              {kompakt ? <Entfernen onClick={() => weg(i)} /> : null}
              <div className={kompakt ? "col-span-2 grid grid-cols-3 gap-2" : "contents"}>
                <Spalte text="Menge" kompakt={kompakt}>
                  <input value={String(p.menge).replace(".", ",")} onChange={(ev) => setPos(i, { menge: Number(ev.target.value.replace(",", ".")) || 0 })} inputMode="decimal" className="feld min-h-10 text-right tabular-nums" aria-label="Menge" />
                </Spalte>
                <Spalte text="Einheit" kompakt={kompakt}>
                  <select value={p.einheit} onChange={(ev) => setPos(i, { einheit: ev.target.value })} className="feld min-h-10" aria-label="Einheit">
                    {["Stk", "Std", "Pauschal", "l", "Satz", "km"].map((x) => <option key={x}>{x}</option>)}
                  </select>
                </Spalte>
                <Spalte text="Preis € brutto" kompakt={kompakt}>
                  <input
                    value={preisTexte[i] ?? ""}
                    onChange={(ev) => {
                      const t = ev.target.value;
                      setPreisTexte((alt) => alt.map((x, j) => (j === i ? t : x)));
                      setPos(i, { einzel_brutto_cent: textZuCent(t) });
                    }}
                    inputMode="decimal"
                    className="feld min-h-10 text-right tabular-nums"
                    aria-label="Einzelpreis brutto in Euro"
                  />
                </Spalte>
              </div>
              {!kompakt ? (
                <>
                  <span className="zahlen text-right">{euro(summen.zeilenBrutto[i] ?? 0)}</span>
                  <Entfernen onClick={() => weg(i)} />
                </>
              ) : (
                <span className="zahlen col-span-2 text-right text-sm text-grau">Zeile: {euro(summen.zeilenBrutto[i] ?? 0)}</span>
              )}
            </div>
          ))}
          {!d.positionen.length ? <p className="py-6 text-center text-grau">Noch keine Position. Artikel wählen oder eine freie Position anlegen.</p> : null}
        </div>
        <div className={`mt-3 gap-2 ${kompakt ? "grid" : "flex flex-wrap items-center"}`}>
          <select
            value=""
            onChange={(ev) => {
              const a = artikel.find((x) => x.id === ev.target.value);
              if (a) neu(a);
            }}
            className={`feld min-h-10 ${kompakt ? "" : "w-auto"}`}
            aria-label="Artikel hinzufügen"
          >
            <option value="">+ Artikel hinzufügen</option>
            {artikel.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} · {euro(a.preis_brutto_cent)}
              </option>
            ))}
          </select>
          <button type="button" onClick={() => neu()} className="knopf knopf-rahmen min-h-10">+ freie Position</button>
        </div>
        <dl className="zahlen ml-auto mt-4 grid max-w-xs grid-cols-[1fr_auto] gap-y-1 text-right [&_dd]:pl-6">
          <dt className="font-sans text-grau">Netto</dt>
          <dd>{euro(summen.netto)}</dd>
          {summen.gruppen.map((g) => (
            <div key={g.satz} className="contents">
              <dt className="font-sans text-grau">MwSt. {g.satz} %</dt>
              <dd>{euro(g.steuer)}</dd>
            </div>
          ))}
          <dt className="border-t-2 border-tinte pt-1 font-sans font-semibold">Gesamt</dt>
          <dd className="border-t-2 border-tinte pt-1 text-lg font-medium">{euro(summen.brutto)}</dd>
        </dl>
        <p className="mt-1 text-right text-xs text-grau">Preise brutto eingeben, die Rechnung weist Netto und Steuer aus.</p>
      </section>

      <section className={`grid gap-4 ${kompakt ? "" : "sm:grid-cols-2"}`}>
        <h2 className={`font-semibold ${kompakt ? "" : "sm:col-span-2"}`}>Empfänger</h2>
        {(
          [
            ["name", "Name"],
            ["firma", "Firma"],
            ["strasse", "Straße"],
            ["email", "E-Mail"],
            ["plz", "PLZ"],
            ["ort", "Ort"],
            ["ust_id", "USt-IdNr. (Geschäftskunde)"],
            ["leitweg_id", "Leitweg-ID (Behörde)"],
          ] as const
        ).map(([k, l]) => (
          <div key={k}>
            <label className="label" htmlFor={`e-${k}`}>{l}</label>
            <input id={`e-${k}`} value={e(k)} onChange={(ev) => setE(k, ev.target.value)} className="feld" />
          </div>
        ))}
      </section>

      <section className={`grid gap-4 ${kompakt ? "" : "sm:grid-cols-4"}`}>
        <h2 className={`font-semibold ${kompakt ? "" : "sm:col-span-4"}`}>Fahrzeug und Leistung</h2>
        <div>
          <label className="label" htmlFor="kz">Kennzeichen</label>
          <input id="kz" value={d.fahrzeug.kennzeichen ?? ""} onChange={(ev) => setD((x) => ({ ...x, fahrzeug: { ...x.fahrzeug, kennzeichen: ev.target.value } }))} className="feld" />
        </div>
        <div>
          <label className="label" htmlFor="mm">Fahrzeug</label>
          <input id="mm" value={d.fahrzeug.modell ?? ""} onChange={(ev) => setD((x) => ({ ...x, fahrzeug: { ...x.fahrzeug, modell: ev.target.value } }))} className="feld" />
        </div>
        <div>
          <label className="label" htmlFor="km">Kilometerstand</label>
          <input id="km" inputMode="numeric" value={d.fahrzeug.km ?? ""} onChange={(ev) => setD((x) => ({ ...x, fahrzeug: { ...x.fahrzeug, km: Number(ev.target.value.replace(/\D/g, "")) || null } }))} className="feld" />
        </div>
        <div>
          <label className="label" htmlFor="ld">Leistungsdatum</label>
          <input id="ld" type="date" value={d.leistungsdatum ?? ""} onChange={(ev) => setD((x) => ({ ...x, leistungsdatum: ev.target.value || null }))} className="feld" />
        </div>
        <div className={kompakt ? "" : "sm:col-span-4"}>
          <label className="label" htmlFor="hw">Hinweis auf der Rechnung (optional)</label>
          <textarea id="hw" rows={2} value={d.hinweis} onChange={(ev) => setD((x) => ({ ...x, hinweis: ev.target.value }))} className="feld" />
        </div>
      </section>

      {/* In der Handy-App sitzt die Tab-Leiste unten, die Knopfleiste klebt deshalb darüber statt dahinter. */}
      <div className={`sticky ${kompakt ? "bottom-[calc(3.5rem+1px+env(safe-area-inset-bottom))]" : "bottom-0"} -mx-4 flex flex-wrap items-center gap-3 border-t border-linie bg-weiss/95 px-4 py-3 backdrop-blur-sm md:static md:mx-0 md:border-0 md:bg-transparent md:p-0`}>
        <button type="submit" name="weiter" value="" disabled={laeuft} className="knopf knopf-rahmen">Speichern</button>
        <a href={`/admin/rechnungen/${id}/pdf`} target="_blank" className="knopf knopf-rahmen">Vorschau</a>
        <button
          type="submit"
          name="weiter"
          value="stellen"
          disabled={laeuft || !d.positionen.length}
          className="knopf knopf-dunkel"
          onClick={(ev) => {
            if (!window.confirm("Rechnung jetzt stellen? Danach bekommt sie eine feste Nummer und kann nicht mehr geändert werden.")) ev.preventDefault();
          }}
        >
          Rechnung stellen
        </button>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="senden" defaultChecked className="size-4 accent-tinte" /> und per E-Mail senden
        </label>
        {zustand.meldung ? <p className={`w-full text-sm font-semibold ${zustand.status === "fehler" ? "text-rot" : "text-ok"}`}>{zustand.meldung}</p> : null}
      </div>
    </form>
  );
}

/** Auf dem Handy steht über jedem Feld der Position eine kleine Beschriftung, am Rechner reicht der Spaltenkopf. */
function Spalte({ text, kompakt, children }: { text: string; kompakt: boolean; children: React.ReactNode }) {
  if (!kompakt) return <>{children}</>;
  return (
    <label className="block min-w-0">
      <span className="mb-1 block text-xs text-grau">{text}</span>
      {children}
    </label>
  );
}

function Entfernen({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex size-10 items-center justify-center self-center justify-self-end rounded-sm text-grau hover:bg-papier hover:text-rot" aria-label="Position entfernen">
      <Kreuz className="size-4" />
    </button>
  );
}
