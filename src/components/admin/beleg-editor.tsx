"use client";

import { useActionState, useMemo, useState } from "react";
import { Kreuz } from "@/components/icons";
import type { BelegArt } from "@/lib/aktionen/belege";
import { kvEntwurfSpeichernAktion } from "@/lib/aktionen/kostenvoranschlaege";
import { entwurfSpeichernAktion } from "@/lib/aktionen/rechnungen";
import { LEER } from "@/lib/forms";
import type { KundenTreffer } from "@/lib/kunden";
import { berechne, type Position } from "@/lib/rechnung/berechnung";
import { KundenSuche } from "./kunden-suche";

/** Eine Position aus der Preisliste (Leistung oder Teil). */
type Artikel = { id: string; name: string; einheit: string; preis_brutto_cent: number; mwst_satz: number };

export type BelegDaten = {
  kunde_id: string | null;
  empfaenger: Record<string, string>;
  fahrzeug: { kennzeichen?: string; modell?: string; km?: number | null };
  positionen: Position[];
  /** Rechnung: Leistungsdatum; Kostenvoranschlag: gültig bis */
  leistungsdatum?: string | null;
  gueltig_bis?: string | null;
  hinweis: string;
};

const euro = (cent: number) => new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(cent / 100);
const centZuText = (c: number) => (c / 100).toFixed(2).replace(".", ",");
const textZuCent = (t: string) => {
  const n = Number(t.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
};

const TEXTE = {
  rechnung: {
    stellen: "Rechnung stellen",
    frage: "Rechnung jetzt stellen? Danach bekommt sie eine feste Nummer und kann nicht mehr geändert werden.",
    pdf: (id: string) => `/admin/rechnungen/${id}/pdf`,
  },
  kostenvoranschlag: {
    stellen: "Abschließen",
    frage: "Kostenvoranschlag jetzt abschließen? Er bekommt eine feste Nummer, der Kunde kann ihn danach über seinen Link annehmen.",
    pdf: (id: string) => `/admin/kostenvoranschlaege/${id}/pdf`,
  },
} as const;

/**
 * Entwurf einer Rechnung oder eines Kostenvoranschlags bearbeiten. Beträge werden live mit derselben
 * Funktion gerechnet wie auf dem PDF und in der E-Rechnung (lib/rechnung/berechnung.ts), die Vorschau
 * weicht also nie vom Ergebnis ab.
 *
 * Darstellung: `kompakt` (Handy-App) immer gestapelt. Sonst am Rechner eine Tabelle und unterhalb der
 * Tablet-Breite dieselbe gestapelte Form, denn die volle Verwaltung wird auch am Handy geöffnet und die
 * sechs Spalten passen dort nicht hinein.
 */
export function BelegEditor({
  art,
  id,
  start,
  preisliste,
  zuletzt,
  kompakt = false,
}: {
  art: BelegArt;
  id: string;
  start: BelegDaten;
  preisliste: Artikel[];
  zuletzt: KundenTreffer[];
  kompakt?: boolean;
}) {
  const [d, setD] = useState<BelegDaten>(start);
  const [preisTexte, setPreisTexte] = useState<string[]>(start.positionen.map((p) => centZuText(p.einzel_brutto_cent)));
  const [suche, setSuche] = useState(!start.empfaenger?.name);
  const [zustand, aktion, laeuft] = useActionState((art === "rechnung" ? entwurfSpeichernAktion : kvEntwurfSpeichernAktion).bind(null, id), LEER);
  const summen = useMemo(() => berechne(d.positionen), [d.positionen]);
  const t = TEXTE[art];

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

  // Klassen je Darstellung. Ausgeschrieben statt zusammengesetzt, damit Tailwind sie findet.
  const tabelle = !kompakt;
  const zeile = tabelle
    ? "grid-cols-[minmax(0,1fr)_2.5rem] md:grid-cols-[minmax(0,1fr)_5rem_7rem_7rem_7rem_2.5rem] md:items-center"
    : "grid-cols-[minmax(0,1fr)_2.5rem]";

  return (
    <form action={aktion} className="grid min-w-0 gap-8">
      <input type="hidden" name="daten" value={JSON.stringify(d)} />

      <section className="grid gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">Empfänger</h2>
          {suche ? (
            d.empfaenger?.name ? (
              <button type="button" onClick={() => setSuche(false)} className="text-sm text-grau underline">
                Suche schließen
              </button>
            ) : null
          ) : (
            <button type="button" onClick={() => setSuche(true)} className="knopf knopf-rahmen knopf-klein">
              {d.kunde_id ? "Anderen Kunden wählen" : "Kunden übernehmen"}
            </button>
          )}
        </div>
        {suche ? (
          <div className="bg-papier p-3">
            <KundenSuche
              zuletzt={zuletzt}
              onWahl={({ kunde: k, fahrzeug: f }) => {
                setD((x) => ({
                  ...x,
                  kunde_id: k.id,
                  empfaenger: { name: k.name, firma: k.firma, strasse: k.strasse, plz: k.plz, ort: k.ort, email: k.email, ust_id: k.ust_id, leitweg_id: k.leitweg_id },
                  fahrzeug: f ? { kennzeichen: f.kennzeichen, modell: f.marke_modell, km: f.km_stand } : x.fahrzeug,
                }));
                setSuche(false);
              }}
            />
          </div>
        ) : null}
        {d.kunde_id && !suche ? (
          <p className="text-sm text-grau">
            Aus der Kundenkartei übernommen.{" "}
            <button type="button" onClick={() => setD((x) => ({ ...x, kunde_id: null }))} className="underline">
              Verknüpfung lösen
            </button>
          </p>
        ) : null}
        <div className={`grid gap-4 ${kompakt ? "" : "sm:grid-cols-2"}`}>
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
              <input id={`e-${k}`} value={e(k)} onChange={(ev) => setE(k, ev.target.value)} className="feld" type={k === "email" ? "email" : "text"} />
            </div>
          ))}
        </div>
      </section>

      <section className="min-w-0">
        <h2 className="mb-3 font-semibold">Positionen</h2>
        {tabelle ? (
          <div className="hidden grid-cols-[minmax(0,1fr)_5rem_7rem_7rem_7rem_2.5rem] gap-2 border-b-2 border-tinte pb-2 text-sm font-semibold md:grid">
            <span>Bezeichnung</span>
            <span className="text-right">Menge</span>
            <span>Einheit</span>
            <span className="text-right">Einzelpreis</span>
            <span className="text-right">Gesamt</span>
            <span />
          </div>
        ) : null}
        <div className={`divide-y divide-linie border-b border-linie ${tabelle ? "border-t-2 border-t-tinte md:border-t-0" : "border-t-2 border-t-tinte"}`}>
          {d.positionen.map((p, i) => (
            <div key={i} className={`grid gap-2 py-3 ${zeile}`}>
              <input value={p.text} onChange={(ev) => setPos(i, { text: ev.target.value })} className="feld min-h-10 min-w-0" aria-label="Bezeichnung" placeholder="Bezeichnung" />
              <Entfernen onClick={() => weg(i)} className={tabelle ? "flex md:hidden" : "flex"} />
              {/* Menge braucht wenig Platz, „Pauschal“ in der Einheit dagegen schon. */}
              <div className={tabelle ? "col-span-2 grid grid-cols-[4.5rem_minmax(0,1fr)_minmax(0,1fr)] gap-2 md:contents" : "col-span-2 grid grid-cols-[4.5rem_minmax(0,1fr)_minmax(0,1fr)] gap-2"}>
                <Spalte text="Menge" tabelle={tabelle}>
                  <input value={String(p.menge).replace(".", ",")} onChange={(ev) => setPos(i, { menge: Number(ev.target.value.replace(",", ".")) || 0 })} inputMode="decimal" className="feld min-h-10 text-right tabular-nums" aria-label="Menge" />
                </Spalte>
                <Spalte text="Einheit" tabelle={tabelle}>
                  <select value={p.einheit} onChange={(ev) => setPos(i, { einheit: ev.target.value })} className="feld min-h-10" aria-label="Einheit">
                    {["Stk", "Std", "Pauschal", "l", "Satz", "km"].map((x) => <option key={x}>{x}</option>)}
                  </select>
                </Spalte>
                <Spalte text="Preis € brutto" tabelle={tabelle}>
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
              <span className={`zahlen col-span-2 text-right text-sm text-grau ${tabelle ? "md:hidden" : ""}`}>Zeile: {euro(summen.zeilenBrutto[i] ?? 0)}</span>
              {tabelle ? (
                <>
                  <span className="zahlen hidden text-right md:block">{euro(summen.zeilenBrutto[i] ?? 0)}</span>
                  <Entfernen onClick={() => weg(i)} className="hidden md:flex" />
                </>
              ) : null}
            </div>
          ))}
          {!d.positionen.length ? <p className="py-6 text-center text-grau">Noch keine Position. Aus der Preisliste wählen oder eine freie Position anlegen.</p> : null}
        </div>
        <div className={`mt-3 grid gap-2 ${tabelle ? "md:flex md:flex-wrap md:items-center" : ""}`}>
          <select
            value=""
            onChange={(ev) => {
              const a = preisliste.find((x) => x.id === ev.target.value);
              if (a) neu(a);
            }}
            // Ohne max-w-full wird die Auswahl so breit wie der längste Eintrag und schiebt das Handy-Layout auf.
            className={`feld min-h-10 max-w-full ${tabelle ? "md:w-auto" : ""}`}
            aria-label="Position aus der Preisliste hinzufügen"
          >
            <option value="">+ Aus der Preisliste</option>
            {preisliste.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} · {euro(a.preis_brutto_cent)}
              </option>
            ))}
          </select>
          <button type="button" onClick={() => neu()} className="knopf knopf-rahmen min-h-10">+ freie Position</button>
        </div>
        <dl className="zahlen ml-auto mt-4 grid max-w-xs grid-cols-[minmax(0,1fr)_auto] gap-y-1 text-right [&_dd]:pl-6">
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
        <p className="mt-1 text-right text-xs text-grau">Preise brutto eingeben, {art === "rechnung" ? "die Rechnung" : "der Kostenvoranschlag"} weist Netto und Steuer aus.</p>
      </section>

      <section className={`grid gap-4 ${kompakt ? "" : "sm:grid-cols-2 lg:grid-cols-4"}`}>
        <h2 className={`font-semibold ${kompakt ? "" : "sm:col-span-2 lg:col-span-4"}`}>{art === "rechnung" ? "Fahrzeug und Leistung" : "Fahrzeug und Gültigkeit"}</h2>
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
        {art === "rechnung" ? (
          <div>
            <label className="label" htmlFor="ld">Leistungsdatum</label>
            <input id="ld" type="date" value={d.leistungsdatum ?? ""} onChange={(ev) => setD((x) => ({ ...x, leistungsdatum: ev.target.value || null }))} className="feld" />
          </div>
        ) : (
          <div>
            <label className="label" htmlFor="gb">Gültig bis</label>
            <input id="gb" type="date" value={d.gueltig_bis ?? ""} onChange={(ev) => setD((x) => ({ ...x, gueltig_bis: ev.target.value || null }))} className="feld" />
            <p className="mt-1 text-xs text-grau">Leer: Frist aus den Einstellungen</p>
          </div>
        )}
        <div className={kompakt ? "" : "sm:col-span-2 lg:col-span-4"}>
          <label className="label" htmlFor="hw">Hinweis {art === "rechnung" ? "auf der Rechnung" : "für den Kunden"} (optional)</label>
          <textarea id="hw" rows={2} value={d.hinweis} onChange={(ev) => setD((x) => ({ ...x, hinweis: ev.target.value }))} className="feld" />
        </div>
      </section>

      {/* In der Handy-App sitzt die Tab-Leiste unten, die Knopfleiste klebt deshalb darüber statt dahinter. */}
      <div className={`sticky ${kompakt ? "bottom-[calc(3.5rem+1px+env(safe-area-inset-bottom)-var(--luecke,0px))]" : "bottom-0"} z-10 -mx-4 grid grid-cols-[auto_auto_minmax(0,1fr)] items-center max-[359px]:grid-cols-2 gap-2 border-t border-linie bg-weiss/95 px-4 py-3 backdrop-blur-sm md:static md:mx-0 md:flex md:flex-wrap md:gap-3 md:border-0 md:bg-transparent md:p-0`}>
        <button type="submit" name="weiter" value="" disabled={laeuft} className="knopf knopf-rahmen px-3 md:px-5">Speichern</button>
        <a href={t.pdf(id)} target="_blank" className="knopf knopf-rahmen px-3 md:px-5">Vorschau</a>
        <button
          type="submit"
          name="weiter"
          value="stellen"
          disabled={laeuft || !d.positionen.length}
          // Wird es eng, bricht „Rechnung stellen“ um; unter 360 px (iPhone SE) steht der Knopf in einer eigenen Zeile,
          // weil „Abschließen“ sonst nicht neben die anderen beiden Knöpfe passt.
          className="knopf knopf-dunkel min-w-0 whitespace-normal px-3 text-center leading-tight max-[359px]:col-span-full md:whitespace-nowrap md:px-5"
          onClick={(ev) => {
            if (!window.confirm(t.frage)) ev.preventDefault();
          }}
        >
          {t.stellen}
        </button>
        <label className="col-span-full flex items-center gap-2 text-sm">
          <input type="checkbox" name="senden" defaultChecked className="size-4 accent-tinte" /> und per E-Mail senden
        </label>
        {zustand.meldung ? <p className={`col-span-full w-full text-sm font-semibold ${zustand.status === "fehler" ? "text-rot" : "text-ok"}`}>{zustand.meldung}</p> : null}
      </div>
    </form>
  );
}

/** Gestapelt steht über jedem Feld der Position eine kleine Beschriftung, in der Tabelle reicht der Spaltenkopf. */
function Spalte({ text, tabelle, children }: { text: string; tabelle: boolean; children: React.ReactNode }) {
  return (
    <label className="block min-w-0">
      <span className={`mb-1 block text-xs text-grau ${tabelle ? "md:sr-only" : ""}`}>{text}</span>
      {children}
    </label>
  );
}

/** `className` bringt die Anzeige mit (flex bzw. hidden md:flex), damit sich keine zwei display-Klassen streiten. */
function Entfernen({ onClick, className }: { onClick: () => void; className: string }) {
  return (
    <button type="button" onClick={onClick} className={`size-10 items-center justify-center self-center justify-self-end rounded-sm text-grau hover:bg-papier hover:text-rot ${className}`} aria-label="Position entfernen">
      <Kreuz className="size-4" />
    </button>
  );
}
