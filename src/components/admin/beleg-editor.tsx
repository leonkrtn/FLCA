"use client";

import { useActionState, useId, useMemo, useState, useTransition } from "react";
import { Kreuz } from "@/components/icons";
import { DateiKnopf } from "@/components/mobil/datei-knopf";
import { type BelegArt, gemerktLadenAktion } from "@/lib/aktionen/belege";
import { auftragEntwurfSpeichernAktion } from "@/lib/aktionen/auftrag";
import { kvEntwurfSpeichernAktion } from "@/lib/aktionen/kostenvoranschlaege";
import { entwurfSpeichernAktion } from "@/lib/aktionen/rechnungen";
import { LEER } from "@/lib/forms";
import type { KundenTreffer } from "@/lib/kunden";
import { besterTreffer, fahrzeugSchluessel, fahrzeugText, markeModellTrennen, markeNorm, modellNorm } from "@/lib/rechnung/aehnlich";
import { zahlAusText } from "@/lib/format";
import { alsNetto, ausEk, berechne, centGenau, nettoAusBruttoPreis, type Position, rohertrag, runden } from "@/lib/rechnung/berechnung";
import type { EditorDaten } from "@/lib/rechnung/editor-daten";
import type { Gemerkt, Paket } from "@/lib/rechnung/preisgedaechtnis";
import { KundenSuche } from "./kunden-suche";
import { MarkeModell } from "./marke-modell";

export type BelegDaten = {
  kunde_id: string | null;
  empfaenger: Record<string, string>;
  fahrzeug: { kennzeichen?: string; marke?: string; modell?: string; km?: number | null };
  positionen: Position[];
  /** Rechnung: Leistungsdatum; Kostenvoranschlag: gültig bis */
  leistungsdatum?: string | null;
  gueltig_bis?: string | null;
  /** Werkstattauftrag: bis zu diesem Betrag (brutto) ohne Rückfrage */
  kostengrenze_cent?: number | null;
  hinweis: string;
};

type Artikel = EditorDaten["preisliste"][number];

/** Was zu einer Zeile nur im Editor gehört: Eingabetexte, Hinweis zum Preis und ob der Preis noch automatisch ist. */
type Zeile = {
  /** Menge, wie getippt: „2,“ muss stehen bleiben dürfen, sonst lässt sich „2,5“ nie eingeben */
  menge: string;
  preis: string;
  ek: string;
  aufschlag: string;
  hinweis?: { text: string; warnung?: boolean };
  /** Preis kam aus Liste oder Gedächtnis und darf beim Ändern der Bezeichnung ersetzt werden */
  auto: boolean;
  /** Bezeichnung, für die zuletzt nachgeschlagen wurde */
  gesucht: string;
};

const euro = (cent: number) => new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(cent / 100);
const centZuText = (c: number | null | undefined) => (c == null ? "" : (c / 100).toFixed(2).replace(".", ","));
/** Getippter Preis in Cent, auf Hundertstel Cent genau wie gespeichert („12,605“ bleibt 1260,5). */
const textZuCent = (t: string) => centGenau((zahlAusText(t) ?? 0) * 100);
const textZuZahl = zahlAusText;
const mengeText = (n: number) => String(n).replace(".", ",");

const EINHEITEN = ["Stk", "Std", "Pauschal", "l", "Satz", "km"];
/** Zeilen mit diesen Einheiten können Teile mit Einkaufspreis sein. */
const MIT_EK = new Set(["Stk", "l", "Satz"]);

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
  // Der Auftrag wird nicht „gestellt“: Er bleibt änderbar, erteilt wird er am Termin.
  auftrag: {
    stellen: "Speichern und zurück",
    frage: "",
    pdf: (id: string) => `/admin/termine/${id}/auftrag/pdf`,
  },
} as const;

const SPEICHERN = { rechnung: entwurfSpeichernAktion, kostenvoranschlag: kvEntwurfSpeichernAktion, auftrag: auftragEntwurfSpeichernAktion } as const;

function zeileFuer(p: Position, extra: Partial<Zeile> = {}): Zeile {
  return {
    menge: mengeText(p.menge),
    preis: p.rabatt ? (p.rabatt.prozent != null ? mengeText(p.rabatt.prozent) : centZuText(p.rabatt.betrag_cent)) : centZuText(p.einzel_netto_cent),
    ek: centZuText(p.ek_cent),
    aufschlag: p.aufschlag != null ? mengeText(p.aufschlag) : "",
    auto: false,
    gesucht: p.text,
    ...extra,
  };
}

/**
 * Entwurf einer Rechnung oder eines Kostenvoranschlags bearbeiten, oder die Positionen eines Werkstattauftrags
 * (dann ohne Empfänger und Fahrzeug, die kommen vom Termin, und mit Kostengrenze statt Datum). Preise netto, Beträge werden live mit
 * derselben Funktion gerechnet wie auf dem PDF und in der E-Rechnung (lib/rechnung/berechnung.ts).
 *
 * Preise je Auto: Für Marke + Modell des Fahrzeugs setzt der Editor den zuletzt berechneten Preis einer
 * Position direkt ein und zeigt darunter, woher er kommt. Ohne Marke und Modell gilt nur die Preisliste.
 * Gemerkt wird beim Stellen einer Rechnung (lib/rechnung/preisgedaechtnis.ts).
 *
 * Darstellung: `kompakt` (Handy-App) immer gestapelt. Sonst am Rechner eine Tabelle und unterhalb der
 * Tablet-Breite dieselbe gestapelte Form, denn die volle Verwaltung wird auch am Handy geöffnet.
 */
export function BelegEditor({
  art,
  id,
  start,
  daten,
  zuletzt,
  kompakt = false,
  korrektur,
}: {
  art: BelegArt | "auftrag";
  /** Beleg, beim Auftrag der Termin */
  id: string;
  start: BelegDaten;
  daten: EditorDaten;
  zuletzt: KundenTreffer[];
  kompakt?: boolean;
  /**
   * Korrekturentwurf einer gestellten Rechnung: Beim Stellen wird das Original storniert. Gesendet wird nur
   * vorbelegt, wenn der Kunde das Original per Mail bekommen hat.
   */
  korrektur?: { original: string; fassung: string; gesendet: boolean };
}) {
  const { preisliste, preise, pakete, bezeichnungen, typen } = daten;
  const listeId = useId();
  const vorschauId = useId();
  // Alte Entwürfe (brutto) und alte Fahrzeugangaben (ein Feld) beim Öffnen umstellen.
  const [d, setD] = useState<BelegDaten>(() => ({
    ...start,
    fahrzeug: start.fahrzeug.marke ? start.fahrzeug : { ...start.fahrzeug, ...markeModellTrennen(start.fahrzeug.modell ?? "") },
    positionen: start.positionen.map(alsNetto),
  }));
  const [zeilen, setZeilen] = useState<Zeile[]>(() => start.positionen.map((p) => zeileFuer(alsNetto(p))));
  const [gemerkt, setGemerkt] = useState<Gemerkt[]>(daten.gemerkt);
  const [gemerktFuer, setGemerktFuer] = useState(() => schluesselText(d.fahrzeug));
  const [laedt, starten] = useTransition();
  const [suche, setSuche] = useState(!start.empfaenger?.name);
  const [stellenOffen, setStellenOffen] = useState(false);
  const [paketWuensche, setPaketWuensche] = useState<{ name: string; indizes: number[] }[]>([]);
  const [zustand, aktion, laeuft] = useActionState(SPEICHERN[art].bind(null, id), LEER);
  const auftrag = art === "auftrag";
  const [grenze, setGrenze] = useState(() => centZuText(start.kostengrenze_cent));
  const summen = useMemo(() => berechne(d.positionen), [d.positionen]);
  const ertrag = useMemo(() => rohertrag(d.positionen, summen), [d.positionen, summen]);
  const t = TEXTE[art];
  const typ = fahrzeugSchluessel(d.fahrzeug.marke, d.fahrzeug.modell);
  const autoName = fahrzeugText(d.fahrzeug);
  const standardLohn = preise.stundensaetze[0];
  const satzFuer = (lohnart?: string | null) => preise.stundensaetze.find((l) => l.name === lohnart)?.netto_cent;

  // --- Zeilen ändern (Positionen und Editor-Zustand laufen immer gemeinsam) ---
  const setPos = (i: number, p: Partial<Position>, z: Partial<Zeile> = {}) => {
    setD((x) => ({ ...x, positionen: x.positionen.map((q, j) => (j === i ? { ...q, ...p } : q)) }));
    setZeilen((x) => x.map((q, j) => (j === i ? { ...q, ...z } : q)));
  };
  const anhaengen = (neu: { p: Position; z: Zeile }[]) => {
    setD((x) => ({ ...x, positionen: [...x.positionen, ...neu.map((n) => n.p)] }));
    setZeilen((x) => [...x, ...neu.map((n) => n.z)]);
  };
  const weg = (i: number) => {
    setD((x) => ({ ...x, positionen: x.positionen.filter((_, j) => j !== i) }));
    setZeilen((x) => x.filter((_, j) => j !== i));
    setPaketWuensche((w) => w.map((p) => ({ ...p, indizes: p.indizes.filter((k) => k !== i).map((k) => (k > i ? k - 1 : k)) })));
  };

  /** Eine gemerkte Position übernehmen. Lohn: gemerkte Stunden mit dem heutigen Stundensatz. */
  const ausGedaechtnis = (basis: Position, g: Gemerkt, quelle?: string): { p: Position; z: Zeile } => {
    const satz = g.einheit === "Std" ? satzFuer(g.lohnart) : undefined;
    const p: Position = {
      ...basis,
      text: basis.text || g.text,
      menge: g.menge,
      einheit: g.einheit,
      einzel_netto_cent: satz ?? g.einzel_netto_cent,
      mwst_satz: g.mwst_satz,
      artikel_id: g.artikel_id ?? basis.artikel_id ?? null,
      lohnart: g.einheit === "Std" ? (g.lohnart ?? standardLohn?.name ?? null) : null,
      ek_cent: g.ek_cent,
      aufschlag: g.aufschlag,
    };
    const wie = g.einheit === "Std" ? `${mengeText(g.menge)} Std` : `${euro(g.einzel_netto_cent)} netto`;
    return { p, z: zeileFuer(p, { auto: true, hinweis: { text: `${quelle ?? "zuletzt"} bei ${g.marke} ${g.modell}: ${wie}` } }) };
  };

  const treffer = (text: string, artikelId?: string | null) =>
    typ ? (besterTreffer(text, gemerkt) ?? (artikelId ? (gemerkt.find((g) => g.artikel_id === artikelId) ?? null) : null)) : null;

  /** Position aus der Preisliste: runder Bruttopreis wird netto. Kennt das Gedächtnis sie für dieses Auto, gilt dessen Preis. */
  const ausListe = (a: Artikel): { p: Position; z: Zeile } => {
    const lohn = a.einheit === "Std" && standardLohn;
    const p: Position = {
      text: a.name,
      menge: 1,
      einheit: a.einheit,
      einzel_netto_cent: lohn ? standardLohn.netto_cent : nettoAusBruttoPreis(a.preis_brutto_cent, a.mwst_satz),
      mwst_satz: a.mwst_satz,
      artikel_id: a.id,
      ...(lohn && { lohnart: standardLohn.name }),
      ...(a.angebot && !lohn && { angebot: a.angebot }),
    };
    // Ein laufendes Angebot geht dem gemerkten Preis vor: Der Kunde hat den Angebotspreis auf der Website gesehen.
    if (a.angebot && !lohn) return { p, z: zeileFuer(p, { auto: true, hinweis: { text: `Angebot „${a.angebot}“, statt ${euro(a.listen_brutto_cent)} brutto` } }) };
    const g = treffer(a.name, a.id);
    return g ? ausGedaechtnis(p, g) : { p, z: zeileFuer(p, { auto: true }) };
  };

  const neuFrei = () => {
    const p: Position = { text: "", menge: 1, einheit: "Stk", einzel_netto_cent: 0, mwst_satz: 19 };
    anhaengen([{ p, z: zeileFuer(p, { auto: true, preis: "" }) }]);
  };
  const neuRabatt = () => {
    const p: Position = { text: "Rabatt", menge: 1, einheit: "", einzel_netto_cent: 0, mwst_satz: 19, rabatt: { prozent: 10 } };
    anhaengen([{ p, z: zeileFuer(p) }]);
  };

  /** Bezeichnung fertig getippt: gemerkten Preis oder Listenpreis einsetzen, solange der Preis nicht von Hand kam. */
  const bezeichnungFertig = (i: number) => {
    const p = d.positionen[i];
    const z = zeilen[i];
    if (!p || p.rabatt || !z || p.text.trim() === z.gesucht.trim()) return;
    if (!z.auto && (p.einzel_netto_cent ?? 0) !== 0) return setZeilen((x) => x.map((q, j) => (j === i ? { ...q, gesucht: p.text } : q)));
    const a = preisliste.find((x) => x.name.toLowerCase() === p.text.trim().toLowerCase());
    const g = a?.angebot ? null : treffer(p.text, p.artikel_id);
    if (g) {
      const n = ausGedaechtnis({ ...p, artikel_id: null }, g);
      return setPos(i, { ...n.p, text: p.text }, { ...n.z, gesucht: p.text });
    }
    if (a) {
      const n = ausListe(a);
      return setPos(i, { ...n.p, text: p.text }, { ...n.z, gesucht: p.text });
    }
    setZeilen((x) => x.map((q, j) => (j === i ? { ...q, gesucht: p.text, hinweis: undefined } : q)));
  };

  const einheitAendern = (i: number, einheit: string) => {
    const p = d.positionen[i];
    if (einheit === "Std" && p.einheit !== "Std" && standardLohn) {
      // Lohn: Stundensatz aus den Einstellungen, Menge = Stunden
      return setPos(i, { einheit, lohnart: standardLohn.name, einzel_netto_cent: standardLohn.netto_cent, ek_cent: null, aufschlag: null }, { preis: centZuText(standardLohn.netto_cent), ek: "", aufschlag: "" });
    }
    if (einheit !== "Std" && p.einheit === "Std") return setPos(i, { einheit, lohnart: null });
    if (!MIT_EK.has(einheit)) return setPos(i, { einheit, ek_cent: null, aufschlag: null }, { ek: "", aufschlag: "" });
    setPos(i, { einheit });
  };

  const lohnartAendern = (i: number, lohnart: string) => {
    const satz = satzFuer(lohnart);
    setPos(i, { lohnart, ...(satz != null && { einzel_netto_cent: satz }) }, satz != null ? { preis: centZuText(satz), auto: false } : {});
  };

  /** Einkauf oder Aufschlag geändert: Verkaufspreis neu rechnen. */
  const ekAendern = (i: number, ekText: string, aufschlagText: string) => {
    const ek = ekText.trim() ? textZuCent(ekText) : null;
    const a = textZuZahl(aufschlagText) ?? preise.aufschlagProzent;
    const aufschlag = aufschlagText.trim() ? a : ek != null ? preise.aufschlagProzent : null;
    if (ek == null || ek <= 0) return setPos(i, { ek_cent: null, aufschlag: null }, { ek: ekText, aufschlag: aufschlagText });
    const vk = ausEk(ek, aufschlag ?? 0);
    setPos(i, { ek_cent: ek, aufschlag, einzel_netto_cent: vk }, { ek: ekText, aufschlag: aufschlagText || mengeText(aufschlag ?? 0), preis: centZuText(vk), auto: false });
  };

  /** Verkaufspreis von Hand: bei einem Teil mit Einkauf ergibt sich der Aufschlag daraus. */
  const preisAendern = (i: number, text: string) => {
    const p = d.positionen[i];
    const vk = textZuCent(text);
    if (p.ek_cent && p.ek_cent > 0) {
      const aufschlag = Math.round((vk / p.ek_cent - 1) * 1000) / 10;
      return setPos(i, { einzel_netto_cent: vk, aufschlag, angebot: null }, { preis: text, aufschlag: mengeText(aufschlag), auto: false, hinweis: undefined });
    }
    setPos(i, { einzel_netto_cent: vk, angebot: null }, { preis: text, auto: false, hinweis: undefined });
  };

  // --- Pakete ---
  const paketAuswahl = useMemo(() => {
    const eigene = typ ? pakete.filter((p) => p.marke_norm === typ.marke_norm && p.modell_norm === typ.modell_norm) : [];
    const andere = pakete.filter((p) => !eigene.includes(p));
    return { eigene, andere };
  }, [pakete, typ]);

  const paketEinfuegen = (paket: Paket) => {
    const passt = typ && paket.marke_norm === typ.marke_norm && paket.modell_norm === typ.modell_norm;
    const fremd = paket.marke_norm ? `${paket.marke} ${paket.modell}` : "einem Beleg ohne Fahrzeug";
    anhaengen(
      paket.positionen.map((roh) => {
        const pp = alsNetto(roh);
        // Ein Angebotspreis von damals gilt nicht mehr: heutiger Preis aus der Preisliste (mit heutigem Angebot)
        const aktuell = pp.angebot ? preisliste.find((x) => x.id === pp.artikel_id) : undefined;
        if (aktuell) {
          const n = ausListe(aktuell);
          return { p: { ...n.p, text: pp.text, menge: pp.menge }, z: n.z };
        }
        const g = treffer(pp.text, pp.artikel_id);
        if (g) return ausGedaechtnis(pp, g);
        // Lohn kommt immer mit dem heutigen Stundensatz
        const satz = pp.einheit === "Std" ? satzFuer(pp.lohnart) : undefined;
        const p = { ...pp, ...(satz != null && { einzel_netto_cent: satz }) };
        return {
          p,
          z: zeileFuer(p, {
            auto: true,
            hinweis: passt ? { text: `aus Paket „${paket.name}“` } : { text: `von ${fremd} übernommen, bitte prüfen`, warnung: true },
          }),
        };
      }),
    );
  };

  // --- Fahrzeug: gemerkte Preise für das neue Auto laden ---
  const fahrzeugFertig = (f = d.fahrzeug) => {
    const schluessel = schluesselText(f);
    if (schluessel === gemerktFuer) return;
    setGemerktFuer(schluessel);
    if (!schluessel) return setGemerkt([]);
    starten(async () => setGemerkt(await gemerktLadenAktion(f.marke ?? "", f.modell ?? "")));
  };

  /** Nach einem Fahrzeugwechsel: alle Zeilen, die das Gedächtnis kennt, auf dessen Preis setzen. */
  const anpassbar = d.positionen.map((p) => (p.rabatt || p.angebot ? null : treffer(p.text, p.artikel_id))).filter((g, i) => g && Math.abs((d.positionen[i].einzel_netto_cent ?? 0) - g.einzel_netto_cent) >= 1);
  const alleAnpassen = () => {
    d.positionen.forEach((p, i) => {
      const g = p.rabatt || p.angebot ? null : treffer(p.text, p.artikel_id);
      if (g) {
        const n = ausGedaechtnis({ ...p, artikel_id: null }, g);
        setPos(i, { ...n.p, text: p.text }, { ...n.z, gesucht: p.text });
      }
    });
  };

  const e = (k: string) => d.empfaenger[k] ?? "";
  const setE = (k: string, v: string) => setD((x) => ({ ...x, empfaenger: { ...x.empfaenger, [k]: v } }));

  // Klassen je Darstellung. Ausgeschrieben statt zusammengesetzt, damit Tailwind sie findet.
  const tabelle = !kompakt;
  const zeile = tabelle
    ? "grid-cols-[minmax(0,1fr)_2.5rem] @3xl:grid-cols-[minmax(0,1fr)_5rem_7rem_7rem_7rem_2.5rem] @3xl:items-start"
    : "grid-cols-[minmax(0,1fr)_2.5rem]";
  const regulaer = d.positionen.map((p, i) => (p.rabatt ? -1 : i)).filter((i) => i >= 0);

  return (
    <>
      {/* Eigenes Formular für die Vorschau (Formulare dürfen nicht ineinander stecken): schickt den
          aktuellen Stand per POST in einen neuen Tab, ohne zu speichern. */}
      <form id={vorschauId} method="post" action={t.pdf(id)} target="_blank" hidden>
        <input type="hidden" name="daten" value={JSON.stringify({ ...d, ...(auftrag && { kostengrenze_cent: grenze.trim() ? textZuCent(grenze) : null }) })} />
      </form>
    <form action={aktion} className="grid min-w-0 gap-8">
      <input
        type="hidden"
        name="daten"
        value={JSON.stringify({ ...d, pakete: art === "rechnung" && stellenOffen ? paketWuensche : [], ...(auftrag && { kostengrenze_cent: grenze.trim() ? Math.round(textZuCent(grenze)) : null }) })}
      />
      {auftrag ? <input type="hidden" name="ort" value={kompakt ? "app" : "admin"} /> : null}
      <datalist id={listeId}>
        {[...new Set([...bezeichnungen, ...preisliste.map((a) => a.name)])].map((b) => (
          <option key={b} value={b} />
        ))}
      </datalist>

      {auftrag ? null : (
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
                const fahrzeug = f
                  ? { kennzeichen: f.kennzeichen, ...(f.marke || f.modell ? { marke: f.marke, modell: f.modell } : markeModellTrennen(f.marke_modell)), km: f.km_stand }
                  : d.fahrzeug;
                setD((x) => ({
                  ...x,
                  kunde_id: k.id,
                  empfaenger: { name: k.name, firma: k.firma, strasse: k.strasse, plz: k.plz, ort: k.ort, email: k.email, ust_id: k.ust_id, leitweg_id: k.leitweg_id },
                  fahrzeug,
                }));
                fahrzeugFertig(fahrzeug);
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
      )}

      {/* Fahrzeug vor den Positionen: Marke und Modell bestimmen, welche Preise gemerkt sind. Beim Auftrag
          kommt das Fahrzeug vom Termin; dort steht stattdessen die Kostengrenze. */}
      {auftrag ? (
        <section className="grid gap-2">
          <h2 className="font-semibold">Kostengrenze</h2>
          <label className="block max-w-xs">
            <span className="label">Bis zu diesem Betrag (brutto) ohne Rückfrage</span>
            <input value={grenze} onChange={(ev) => setGrenze(ev.target.value)} inputMode="decimal" placeholder="keine" className="feld" />
          </label>
          <p className="text-sm text-grau">
            Voraussichtlich {euro(summen.brutto)} brutto
            {grenze.trim() && summen.brutto > textZuCent(grenze) ? <span className="font-semibold text-rot"> · über der Kostengrenze, bitte mit dem Kunden absprechen</span> : null}
            {autoName ? ` · Preise für ${autoName}` : ""}
          </p>
        </section>
      ) : (
      <section className={`grid gap-4 ${kompakt ? "" : "sm:grid-cols-2 lg:grid-cols-4"}`}>
        <h2 className={`font-semibold ${kompakt ? "" : "sm:col-span-2 lg:col-span-4"}`}>{art === "rechnung" ? "Fahrzeug und Leistung" : "Fahrzeug und Gültigkeit"}</h2>
        <MarkeModell
          typen={typen}
          marke={d.fahrzeug.marke ?? ""}
          modell={d.fahrzeug.modell ?? ""}
          onChange={(w) => setD((x) => ({ ...x, fahrzeug: { ...x.fahrzeug, ...w } }))}
          onFertig={() => fahrzeugFertig()}
          className={kompakt ? "" : "sm:col-span-2"}
        />
        <div>
          <label className="label" htmlFor="kz">Kennzeichen</label>
          <input id="kz" value={d.fahrzeug.kennzeichen ?? ""} onChange={(ev) => setD((x) => ({ ...x, fahrzeug: { ...x.fahrzeug, kennzeichen: ev.target.value } }))} className="feld" />
        </div>
        <div>
          <label className="label" htmlFor="km">Kilometerstand</label>
          <input id="km" inputMode="numeric" value={d.fahrzeug.km ?? ""} onChange={(ev) => setD((x) => ({ ...x, fahrzeug: { ...x.fahrzeug, km: Number(ev.target.value.replace(/\D/g, "")) || null } }))} className="feld" />
        </div>
        <p className={`text-sm text-grau ${kompakt ? "" : "sm:col-span-2 lg:col-span-4"}`} aria-live="polite">
          {laedt
            ? "Gemerkte Preise werden geladen …"
            : typ
              ? gemerkt.length
                ? `${gemerkt.length} gemerkte ${gemerkt.length === 1 ? "Position" : "Positionen"} für ${autoName}.`
                : `Für ${autoName} ist noch nichts gemerkt. Beim Stellen der Rechnung merken sich die Preise.`
              : "Marke und Modell eintragen, dann kommen gemerkte Preise für dieses Auto. Ohne gilt die Preisliste."}
          {anpassbar.length && !laedt ? (
            <>
              {" "}
              <button type="button" onClick={alleAnpassen} className="font-semibold text-tinte underline">
                {anpassbar.length} {anpassbar.length === 1 ? "Preis" : "Preise"} auf {autoName} anpassen
              </button>
            </>
          ) : null}
        </p>
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
      </section>
      )}

      {/* Tabelle nach der Breite des Abschnitts, nicht des Bildschirms: Neben der Verlauf-Spalte (iPad quer,
          Laptop) blieb der Bezeichnung sonst kaum Platz, die festen Spalten brauchen schon rund 500 px. */}
      <section className="@container min-w-0">
        <h2 className="mb-3 font-semibold">Positionen</h2>
        {tabelle ? (
          <div className="hidden grid-cols-[minmax(0,1fr)_5rem_7rem_7rem_7rem_2.5rem] gap-2 border-b-2 border-tinte pb-2 text-sm font-semibold @3xl:grid">
            <span>Bezeichnung</span>
            <span className="text-right">Menge</span>
            <span>Einheit</span>
            <span className="text-right">Einzel netto</span>
            <span className="text-right">Gesamt netto</span>
            <span />
          </div>
        ) : null}
        <div className={`divide-y divide-linie border-b border-linie ${tabelle ? "border-t-2 border-t-tinte @3xl:border-t-0" : "border-t-2 border-t-tinte"}`}>
          {d.positionen.map((p, i) => {
            const z = zeilen[i];
            if (p.rabatt) {
              const prozent = p.rabatt.prozent != null;
              return (
                <div key={i} className={`grid gap-2 py-3 ${zeile}`}>
                  <input value={p.text} onChange={(ev) => setPos(i, { text: ev.target.value })} className="feld min-h-10 min-w-0" aria-label="Bezeichnung des Rabatts" />
                  <Entfernen onClick={() => weg(i)} className={tabelle ? "flex @3xl:hidden" : "flex"} />
                  <div className={tabelle ? "col-span-2 grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2 @3xl:col-span-3 @3xl:grid-cols-[5rem_minmax(0,1fr)_7rem]" : "col-span-2 grid grid-cols-2 gap-2"}>
                    <Spalte text="Art" tabelle={tabelle}>
                      <select
                        value={prozent ? "%" : "€"}
                        onChange={(ev) => setPos(i, { rabatt: ev.target.value === "%" ? { prozent: 10 } : { betrag_cent: 0 } }, { preis: ev.target.value === "%" ? "10" : "" })}
                        className="feld min-h-10"
                        aria-label="Rabatt in Prozent oder Euro"
                      >
                        <option value="%">%</option>
                        <option value="€">€ netto</option>
                      </select>
                    </Spalte>
                    <span className="hidden @3xl:block" />
                    <Spalte text={prozent ? "Prozent" : "Betrag € netto"} tabelle={tabelle}>
                      <input
                        value={z?.preis ?? ""}
                        onChange={(ev) => {
                          const v = ev.target.value;
                          setPos(i, { rabatt: prozent ? { prozent: Math.min(Math.max(textZuZahl(v) ?? 0, 0), 100) } : { betrag_cent: textZuCent(v) } }, { preis: v });
                        }}
                        inputMode="decimal"
                        className="feld min-h-10 text-right tabular-nums"
                        aria-label={prozent ? "Rabatt in Prozent" : "Rabatt in Euro netto"}
                      />
                    </Spalte>
                  </div>
                  <span className={`zahlen col-span-2 text-right text-sm text-grau ${tabelle ? "@3xl:hidden" : ""}`}>Rabatt: {euro(summen.zeilenNetto[i] ?? 0)}</span>
                  {tabelle ? (
                    <>
                      <span className="zahlen hidden pt-2 text-right @3xl:block">{euro(summen.zeilenNetto[i] ?? 0)}</span>
                      <Entfernen onClick={() => weg(i)} className="hidden @3xl:flex" />
                    </>
                  ) : null}
                  <p className={`text-xs text-grau ${tabelle ? "col-span-2 @3xl:col-span-6" : "col-span-2"}`}>Gilt für alle Positionen dieses Belegs.</p>
                </div>
              );
            }
            const vk = p.einzel_netto_cent ?? 0;
            return (
              <div key={i} className={`grid gap-2 py-3 ${zeile}`}>
                <input
                  value={p.text}
                  onChange={(ev) => setPos(i, { text: ev.target.value })}
                  onBlur={() => bezeichnungFertig(i)}
                  list={listeId}
                  className="feld min-h-10 min-w-0"
                  aria-label="Bezeichnung"
                  placeholder="Bezeichnung"
                />
                <Entfernen onClick={() => weg(i)} className={tabelle ? "flex @3xl:hidden" : "flex"} />
                {/* Menge braucht wenig Platz, „Pauschal“ in der Einheit dagegen schon. */}
                <div className={tabelle ? "col-span-2 grid grid-cols-[4.5rem_minmax(0,1fr)_minmax(0,1fr)] gap-2 @3xl:contents" : "col-span-2 grid grid-cols-[4.5rem_minmax(0,1fr)_minmax(0,1fr)] gap-2"}>
                  <Spalte text={p.einheit === "Std" ? "Stunden" : "Menge"} tabelle={tabelle}>
                    <input
                      value={z?.menge ?? mengeText(p.menge)}
                      onChange={(ev) => setPos(i, { menge: textZuZahl(ev.target.value) ?? 0 }, { menge: ev.target.value, auto: false })}
                      inputMode="decimal"
                      className="feld min-h-10 text-right tabular-nums"
                      aria-label="Menge"
                    />
                  </Spalte>
                  <Spalte text="Einheit" tabelle={tabelle}>
                    <select value={p.einheit} onChange={(ev) => einheitAendern(i, ev.target.value)} className="feld min-h-10" aria-label="Einheit">
                      {[...new Set([...EINHEITEN, p.einheit])].map((x) => <option key={x}>{x}</option>)}
                    </select>
                  </Spalte>
                  <Spalte text="Einzel € netto" tabelle={tabelle}>
                    <input
                      value={z?.preis ?? ""}
                      onChange={(ev) => preisAendern(i, ev.target.value)}
                      inputMode="decimal"
                      className="feld min-h-10 text-right tabular-nums"
                      aria-label="Einzelpreis netto in Euro"
                    />
                    <span className="zahlen mt-0.5 block text-right text-xs text-grau">brutto {euro(runden(vk * (1 + p.mwst_satz / 100)))}</span>
                  </Spalte>
                </div>
                <span className={`zahlen col-span-2 text-right text-sm text-grau ${tabelle ? "@3xl:hidden" : ""}`}>
                  Zeile: {euro(summen.zeilenNetto[i] ?? 0)} netto · {euro(summen.zeilenBrutto[i] ?? 0)} brutto
                </span>
                {tabelle ? (
                  <>
                    <span className="hidden pt-2 text-right @3xl:block">
                      <span className="zahlen block">{euro(summen.zeilenNetto[i] ?? 0)}</span>
                      <span className="zahlen block text-xs text-grau">brutto {euro(summen.zeilenBrutto[i] ?? 0)}</span>
                    </span>
                    <Entfernen onClick={() => weg(i)} className="hidden @3xl:flex" />
                  </>
                ) : null}

                {/* Zusatz je Art: Lohn wählt den Stundensatz, ein Teil rechnet aus Einkauf und Aufschlag. */}
                {p.einheit === "Std" || MIT_EK.has(p.einheit) || z?.hinweis ? (
                  <div className={`flex flex-wrap items-end gap-x-4 gap-y-2 ${tabelle ? "col-span-2 @3xl:col-span-6" : "col-span-2"}`}>
                    {p.einheit === "Std" ? (
                      <label className="block min-w-0">
                        <span className="mb-1 block text-xs text-grau">Lohnart</span>
                        <select value={p.lohnart ?? ""} onChange={(ev) => lohnartAendern(i, ev.target.value)} className="feld min-h-9 py-1 text-sm">
                          {!p.lohnart ? <option value="">ohne</option> : null}
                          {preise.stundensaetze.map((l) => (
                            <option key={l.name} value={l.name}>
                              {l.name} · {euro(l.netto_cent)}/Std
                            </option>
                          ))}
                          {p.lohnart && satzFuer(p.lohnart) == null ? <option value={p.lohnart}>{p.lohnart}</option> : null}
                        </select>
                      </label>
                    ) : null}
                    {MIT_EK.has(p.einheit) ? (
                      <>
                        <label className="block w-28">
                          <span className="mb-1 block text-xs text-grau">Einkauf € netto</span>
                          <input
                            value={z?.ek ?? ""}
                            onChange={(ev) => ekAendern(i, ev.target.value, z?.aufschlag ?? "")}
                            inputMode="decimal"
                            placeholder="optional"
                            className="feld min-h-9 py-1 text-right text-sm tabular-nums"
                            aria-label="Einkaufspreis netto"
                          />
                        </label>
                        {p.ek_cent ? (
                          <label className="block w-24">
                            <span className="mb-1 block text-xs text-grau">Aufschlag %</span>
                            <input
                              value={z?.aufschlag ?? ""}
                              onChange={(ev) => ekAendern(i, z?.ek ?? "", ev.target.value)}
                              inputMode="decimal"
                              className="feld min-h-9 py-1 text-right text-sm tabular-nums"
                              aria-label="Aufschlag in Prozent"
                            />
                          </label>
                        ) : null}
                      </>
                    ) : null}
                    {z?.hinweis ? (
                      <p className={`pb-2 text-xs ${z.hinweis.warnung ? "font-semibold text-rot" : "text-grau"}`}>{z.hinweis.text}</p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })}
          {!d.positionen.length ? <p className="py-6 text-center text-grau">Noch keine Position. Aus der Preisliste oder einem Paket wählen oder eine freie Position anlegen.</p> : null}
        </div>
        <div className={`mt-3 grid gap-2 ${tabelle ? "@3xl:flex @3xl:flex-wrap @3xl:items-center" : ""}`}>
          <select
            value=""
            onChange={(ev) => {
              const a = preisliste.find((x) => x.id === ev.target.value);
              if (a) anhaengen([ausListe(a)]);
            }}
            // Ohne max-w-full wird die Auswahl so breit wie der längste Eintrag und schiebt das Handy-Layout auf.
            className={`feld min-h-10 max-w-full ${tabelle ? "@3xl:w-auto" : ""}`}
            aria-label="Position aus der Preisliste hinzufügen"
          >
            <option value="">+ Aus der Preisliste</option>
            {preisliste.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} · {euro(a.preis_brutto_cent)} brutto{a.angebot ? ` · ${a.angebot}` : ""}
              </option>
            ))}
          </select>
          {pakete.length ? (
            <select
              value=""
              onChange={(ev) => {
                const p = pakete.find((x) => x.id === ev.target.value);
                if (p) paketEinfuegen(p);
              }}
              className={`feld min-h-10 max-w-full ${tabelle ? "@3xl:w-auto" : ""}`}
              aria-label="Paket hinzufügen"
            >
              <option value="">+ Paket</option>
              {paketAuswahl.eigene.length ? (
                <optgroup label={`Für ${autoName}`}>
                  {paketAuswahl.eigene.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </optgroup>
              ) : null}
              {paketAuswahl.andere.length ? (
                <optgroup label={typ ? "Von anderen Autos (Preise prüfen)" : "Pakete"}>
                  {paketAuswahl.andere.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} · {p.marke ? `${p.marke} ${p.modell}` : "ohne Fahrzeug"}
                    </option>
                  ))}
                </optgroup>
              ) : null}
            </select>
          ) : null}
          <button type="button" onClick={neuFrei} className="knopf knopf-rahmen min-h-10">+ freie Position</button>
          <button type="button" onClick={neuRabatt} disabled={!regulaer.length} className="knopf knopf-rahmen min-h-10">+ Rabatt</button>
        </div>
        <dl className="zahlen ml-auto mt-4 grid max-w-xs grid-cols-[minmax(0,1fr)_auto] gap-y-1 text-right [&_dd]:pl-6">
          {summen.rabatt ? (
            <>
              <dt className="font-sans text-grau">Positionen</dt>
              <dd>{euro(summen.basis)}</dd>
              <dt className="font-sans text-grau">Rabatt</dt>
              <dd>{euro(-summen.rabatt)}</dd>
            </>
          ) : null}
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
        {ertrag ? (
          // Nur hier im Editor, nie im PDF oder beim Kunden.
          <p className="zahlen mt-1 text-right text-xs text-grau">
            Teile-Einkauf {euro(ertrag.ek)} · Rohertrag {euro(ertrag.ertrag)}
          </p>
        ) : null}
        <p className="mt-1 text-right text-xs text-grau">Preise netto eingeben. Preise aus der Preisliste werden netto übernommen und ergeben brutto den runden Listenpreis.</p>
      </section>

      {/* Beim Auftrag steht, was der Kunde beanstandet, in der Fahrzeugannahme am Termin. */}
      {auftrag ? null : (
      <section>
        <label className="label" htmlFor="hw">Hinweis {art === "rechnung" ? "auf der Rechnung" : "für den Kunden"} (optional)</label>
        <textarea id="hw" rows={2} value={d.hinweis} onChange={(ev) => setD((x) => ({ ...x, hinweis: ev.target.value }))} className="feld" />
      </section>
      )}

      {stellenOffen ? (
        <section className="grid gap-4 border-2 border-tinte p-4">
          <h2 className="font-semibold">{korrektur ? "Berichtigte Rechnung stellen" : t.stellen}</h2>
          <p className="text-sm">
            {korrektur
              ? `Jetzt stellen? Rechnung ${korrektur.original} wird storniert (Stornorechnung mit eigener Nummer), diese Fassung bekommt die Nummer ${korrektur.fassung} und ist danach unveränderlich.`
              : t.frage}
          </p>
          <div className="grid gap-3">
            <p className="text-sm text-grau">
              Die Preise merken sich automatisch{autoName ? ` für ${autoName}` : " (nur mit Marke und Modell)"}. Gehören mehrere Positionen zu einer Arbeit, kannst du sie hier als Paket benennen, z. B. „Bremsen vorne“.
            </p>
            {paketWuensche.map((w, k) => (
              <fieldset key={k} className="grid gap-2 bg-papier p-3">
                <div className="flex items-end gap-2">
                  <label className="block min-w-0 flex-1">
                    <span className="label">Name des Pakets</span>
                    <input
                      value={w.name}
                      onChange={(ev) => setPaketWuensche((x) => x.map((q, j) => (j === k ? { ...q, name: ev.target.value } : q)))}
                      placeholder="Bremsen vorne"
                      className="feld"
                    />
                  </label>
                  <Entfernen onClick={() => setPaketWuensche((x) => x.filter((_, j) => j !== k))} className="flex" />
                </div>
                {regulaer.map((i) => (
                  <label key={i} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={w.indizes.includes(i)}
                      onChange={(ev) =>
                        setPaketWuensche((x) => x.map((q, j) => (j === k ? { ...q, indizes: ev.target.checked ? [...q.indizes, i] : q.indizes.filter((n) => n !== i) } : q)))
                      }
                      className="size-4 accent-tinte"
                    />
                    {d.positionen[i].text || "ohne Bezeichnung"}
                  </label>
                ))}
              </fieldset>
            ))}
            <button type="button" onClick={() => setPaketWuensche((x) => [...x, { name: "", indizes: [] }])} className="knopf knopf-rahmen knopf-klein justify-self-start">
              + Positionen als Paket merken
            </button>
          </div>
          <div className="flex flex-wrap gap-3">
            <button type="submit" name="weiter" value="stellen" disabled={laeuft} className="knopf knopf-dunkel">Jetzt stellen</button>
            <button type="button" onClick={() => setStellenOffen(false)} className="knopf knopf-rahmen">Abbrechen</button>
          </div>
        </section>
      ) : null}

      {/* In der Handy-App sitzt die Tab-Leiste unten, die Knopfleiste klebt deshalb darüber statt dahinter. */}
      <div className={`sticky ${kompakt ? "bottom-[calc(3.5rem+1px+env(safe-area-inset-bottom))]" : "bottom-0"} z-10 -mx-4 grid grid-cols-[auto_auto_minmax(0,1fr)] items-center max-[359px]:grid-cols-2 gap-2 border-t border-linie bg-weiss px-4 py-3 md:static md:mx-0 md:flex md:flex-wrap md:gap-3 md:border-0 md:bg-transparent md:p-0`}>
        <button type="submit" name="weiter" value="" disabled={laeuft} className="knopf knopf-rahmen px-3 md:px-5">Speichern</button>
        <DateiKnopf art="datei" formular={vorschauId} className="knopf knopf-rahmen px-3 md:px-5">Vorschau</DateiKnopf>
        <button
          type={art === "rechnung" ? "button" : "submit"}
          name={art === "rechnung" ? undefined : "weiter"}
          value={art === "rechnung" ? undefined : auftrag ? "zurueck" : "stellen"}
          disabled={laeuft || (!auftrag && !regulaer.length)}
          // Wird es eng, bricht „Rechnung stellen“ um; unter 360 px (iPhone SE) steht der Knopf in einer eigenen Zeile,
          // weil „Abschließen“ sonst nicht neben die anderen beiden Knöpfe passt.
          className="knopf knopf-dunkel min-w-0 whitespace-normal px-3 text-center leading-tight max-[359px]:col-span-full md:whitespace-nowrap md:px-5"
          onClick={(ev) => {
            // Rechnung: erst der Abschnitt zum Bestätigen und Pakete benennen; Kostenvoranschlag wie bisher.
            if (art === "rechnung") return setStellenOffen(true);
            if (t.frage && !window.confirm(t.frage)) ev.preventDefault();
          }}
        >
          {t.stellen}
        </button>
        {auftrag ? null : (
          <label className="col-span-full flex items-center gap-2 text-sm">
            <input type="checkbox" name="senden" defaultChecked={korrektur ? korrektur.gesendet : true} className="size-4 accent-tinte" />{" "}
            {korrektur ? "und mit der Stornorechnung per E-Mail an den Kunden senden" : "und per E-Mail senden"}
          </label>
        )}
        {zustand.meldung ? <p className={`col-span-full w-full text-sm font-semibold ${zustand.status === "fehler" ? "text-rot" : "text-ok"}`}>{zustand.meldung}</p> : null}
      </div>
    </form>
    </>
  );
}

/** Vergleichsschlüssel für „anderes Auto?“: nur Marke und Modell, Schreibweise egal. */
function schluesselText(f: BelegDaten["fahrzeug"]): string {
  const m = markeNorm(f.marke ?? "");
  const o = modellNorm(f.modell ?? "");
  return m && o ? `${m}|${o}` : "";
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
