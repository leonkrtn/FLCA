"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Formular, Senden } from "@/components/admin/formular";
import { euro } from "@/lib/format";
import type { Ergebnis } from "@/lib/forms";
import type { FahrzeugTypen } from "@/lib/sprache/merkmale";
import { type Grundlagen, positionenBauen } from "@/lib/sprache/positionen";
import { absichtErkennen, type Art, ART_TEXT, type Leistungswahl, notizVerstehen, type Person, rechnungVerstehen, terminVerstehen } from "@/lib/sprache/verstehen";
import { berlinDatum } from "@/lib/zeit";

/**
 * Sprechen statt Tippen (Werkstatt-App). Zwei Wege zum Text: der Knopf „Aufnahme“ (Spracherkennung des
 * Browsers, auf dem iPhone die von Apple) oder die Mikrofon-Taste der iPhone-Tastatur im Textfeld. Der
 * zweite geht immer, auch wenn die Web-App vom Home-Bildschirm die Spracherkennung nicht bekommt.
 *
 * Was erkannt wird, steht live darunter. Gespeichert wird nichts: „Weiter“ öffnet das gewohnte Formular
 * vorausgefüllt, bei einer Rechnung einen Entwurf.
 */

type Erkennung = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};
type ErkennungKlasse = new () => Erkennung;

const nichtsAbonnieren = () => () => {};

function erkennungKlasse(): ErkennungKlasse | null {
  const w = window as unknown as { SpeechRecognition?: ErkennungKlasse; webkitSpeechRecognition?: ErkennungKlasse };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const FEHLER: Record<string, string> = {
  "not-allowed": "Kein Zugriff aufs Mikrofon. In den Einstellungen erlauben oder die Diktiertaste der Tastatur nehmen.",
  "service-not-allowed": "Die Spracherkennung ist hier nicht verfügbar. Bitte die Diktiertaste der Tastatur nehmen.",
  "no-speech": "Nichts gehört. Bitte noch einmal.",
  network: "Die Spracherkennung ist gerade nicht erreichbar. Bitte die Diktiertaste der Tastatur nehmen.",
  "audio-capture": "Kein Mikrofon gefunden.",
};

/** „Ölwechsel inkl. Filter“ → „Ölwechsel“: so, wie man es sagt. */
const kurzName = (n: string) => n.split(/\s+(?:inkl\.?|inklusive|mit)\s+|[(,/]/i)[0].trim();

/** Beispiele mit den Namen aus der aktuellen Preisliste, damit sie auch nach einer Umbenennung passen. */
function beispiele(leistungen: Leistungswahl[], preisliste: Grundlagen["preisliste"]): Record<Art, string> {
  const l = leistungen.slice(0, 2).map((x) => kurzName(x.name));
  const p = preisliste.find((x) => x.einheit !== "Std" && !leistungen.slice(0, 2).some((y) => y.id === x.id)) ?? preisliste[0];
  return {
    notiz: "Erinnere mich morgen um 9, Bremsbeläge für den Golf von Müller bestellen",
    termin: `Termin für Herrn Müller, ${l.length ? l.join(" und ") : "Bremsen vorne"}, nächsten Dienstag halb neun, Kennzeichen OF AB 123, Telefon 0151 2345678`,
    rechnung: `Rechnung für Müller, ${p ? `${kurzName(p.name)}, ` : ""}zwei Stunden Arbeit, Bremsscheiben vorne 180 Euro brutto`,
  };
}

const KNOPF: Record<Art, string> = { notiz: "Weiter zur Notiz", termin: "Weiter zum Termin", rechnung: "Rechnungsentwurf anlegen" };
const HINWEIS: Record<Art, string> = {
  notiz: "Gespeichert wird erst im Formular danach.",
  termin: "Gespeichert wird erst im Formular danach. Kunde und Fahrzeug werden in der Kartei gesucht.",
  rechnung: "Es entsteht ein Entwurf im Editor. Kunde, Fahrzeug und gemerkte Preise kommen aus der Kartei. Preise ohne Angabe sind netto.",
};

const tagText = (d: string | null) =>
  d ? new Intl.DateTimeFormat("de-DE", { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }).format(new Date(`${d}T12:00:00Z`)) : null;
const WDH: Record<string, string> = { taeglich: "täglich", woechentlich: "wöchentlich", monatlich: "monatlich" };
const zahl = (n: number) => String(n).replace(".", ",");

export function SprachEingabe({
  aktion,
  leistungen,
  team,
  typen,
  grundlagen,
}: {
  aktion: (v: Ergebnis, fd: FormData) => Promise<Ergebnis>;
  leistungen: Leistungswahl[];
  team: Person[];
  /** Marken und Modelle aus der Kartei */
  typen: FahrzeugTypen;
  grundlagen: Omit<Grundlagen, "gemerkt">;
}) {
  const [text, setText] = useState("");
  const [zwischen, setZwischen] = useState("");
  const [gewaehlt, setGewaehlt] = useState<Art | null>(null);
  const [hoert, setHoert] = useState(false);
  const [fehler, setFehler] = useState("");
  const erkennung = useRef<Erkennung | null>(null);

  // Auf dem Server gibt es keine Spracherkennung; im Browser wird nach dem Laden nachgesehen
  const kann = useSyncExternalStore(
    nichtsAbonnieren,
    () => Boolean(erkennungKlasse()),
    () => false,
  );
  useEffect(() => () => erkennung.current?.stop(), []);

  const erkannt = useMemo(() => absichtErkennen(text), [text]);
  const vorlagen = useMemo(() => beispiele(leistungen, grundlagen.preisliste), [leistungen, grundlagen.preisliste]);
  const art = gewaehlt ?? erkannt;

  const starten = () => {
    const K = erkennungKlasse();
    if (!K) return;
    setFehler("");
    const r = new K();
    r.lang = "de-DE";
    r.continuous = true;
    r.interimResults = true;
    r.onresult = (e) => {
      let fertig = "";
      let offen = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) fertig += t;
        else offen += t;
      }
      if (fertig) setText((alt) => `${alt.trim()} ${fertig.trim()}`.trim());
      setZwischen(offen);
    };
    r.onerror = (e) => {
      if (e.error !== "aborted") setFehler(FEHLER[e.error] ?? "Die Aufnahme hat nicht geklappt. Bitte die Diktiertaste der Tastatur nehmen.");
    };
    r.onend = () => {
      setHoert(false);
      setZwischen("");
      erkennung.current = null;
    };
    erkennung.current = r;
    try {
      r.start();
      setHoert(true);
    } catch {
      setFehler("Die Aufnahme ließ sich nicht starten. Bitte die Diktiertaste der Tastatur nehmen.");
    }
  };
  const anhalten = () => erkennung.current?.stop();

  return (
    <div className="grid gap-2 p-2">
      <div className="bg-weiss px-4 py-4">
        <Formular aktion={aktion} className="grid gap-4">
          <fieldset>
            <legend className="label">Was soll es werden?</legend>
            <div className="grid grid-cols-3 gap-1 rounded-md bg-boden p-1">
              {(["notiz", "termin", "rechnung"] as Art[]).map((a) => (
                <button
                  key={a}
                  type="button"
                  aria-pressed={art === a}
                  onClick={() => setGewaehlt(gewaehlt === a ? null : a)}
                  className={`min-h-10 rounded-sm text-sm font-semibold ${art === a ? "bg-weiss text-tinte shadow-sm" : "text-grau"}`}
                >
                  {ART_TEXT[a]}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-sm text-grau">
              {gewaehlt ? "Von Hand gewählt. Nochmal tippen hebt die Wahl auf." : erkannt ? `Als ${ART_TEXT[erkannt]} erkannt.` : "Wird am ersten Wort erkannt, z. B. „Termin …“, „Erinnere mich …“, „Rechnung …“."}
            </p>
          </fieldset>

          <input type="hidden" name="art" value={art ?? ""} />
          <label className="block">
            <span className="label">Gesprochener Text</span>
            <textarea
              name="text"
              rows={5}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={vorlagen[art ?? "termin"]}
              className="feld"
              maxLength={1500}
            />
          </label>
          {zwischen ? <p className="-mt-2 text-sm text-grau">{zwischen}</p> : null}

          <div className="grid gap-2">
            {kann ? (
              <button type="button" onClick={hoert ? anhalten : starten} className="knopf knopf-rahmen w-full">
                {hoert ? (
                  <span className="flex items-center gap-2">
                    <span aria-hidden className="size-2.5 animate-pulse rounded-full bg-rot" />
                    Hört zu, tippen zum Beenden
                  </span>
                ) : (
                  "Aufnahme starten"
                )}
              </button>
            ) : null}
            <p className="text-sm text-grau">
              {kann ? "Oder ins Textfeld tippen und auf der Tastatur das Mikrofon nutzen." : "Ins Textfeld tippen und auf der Tastatur das Mikrofon nutzen."}
            </p>
            {fehler ? <p className="text-sm font-semibold text-rot">{fehler}</p> : null}
          </div>

          {text.trim() && art ? <Vorschau art={art} text={text} leistungen={leistungen} team={team} typen={typen} grundlagen={grundlagen} /> : null}

          <div className="grid gap-2">
            <Senden className="w-full">{art ? KNOPF[art] : "Weiter"}</Senden>
            {art ? <p className="text-sm text-grau">{HINWEIS[art]}</p> : null}
            {text ? (
              <button type="button" onClick={() => setText("")} className="knopf knopf-rahmen w-full">
                Text leeren
              </button>
            ) : null}
          </div>
        </Formular>
      </div>

      {!text ? (
        <div className="bg-weiss px-4 py-4">
          <h2 className="font-semibold">Beispiele</h2>
          <p className="mt-1 text-sm text-grau">Reihenfolge egal, fehlende Angaben werden im Formular ergänzt. Tippen übernimmt das Beispiel.</p>
          <ul className="mt-3 grid gap-2">
            {(["notiz", "termin", "rechnung"] as Art[]).map((a) => (
              <li key={a}>
                <button type="button" onClick={() => setText(vorlagen[a])} className="w-full rounded-md border border-linie px-3 py-2 text-left text-sm active:bg-papier">
                  <span className="block font-semibold">{ART_TEXT[a]}</span>
                  {vorlagen[a]}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

/** Erkannte Felder als Liste. Fehlt etwas Wichtiges, steht es rot da. */
function Vorschau({
  art,
  text,
  leistungen,
  team,
  typen,
  grundlagen,
}: {
  art: Art;
  text: string;
  leistungen: Leistungswahl[];
  team: Person[];
  typen: FahrzeugTypen;
  grundlagen: Omit<Grundlagen, "gemerkt">;
}) {
  const zeilen = useMemo((): [string, string | null, boolean?][] => {
    const heute = berlinDatum();
    if (art === "notiz") {
      const v = notizVerstehen(text, { heute, jetzt: new Date(), team });
      return [
        ["Titel", v.titel || null, true],
        ["Text", v.text ? `${v.text.slice(0, 80)}${v.text.length > 80 ? " …" : ""}` : null],
        ["Erinnerung", v.datum ? `${tagText(v.datum)}, ${v.uhrzeit ?? "08:00"} Uhr${v.wiederholung !== "keine" ? `, ${WDH[v.wiederholung]}` : ""}` : "keine"],
        ["Erinnern an", v.erinnernAn?.name ?? null],
        ["Sichtbar", v.sichtbar === "buero" ? "Büro" : v.sichtbar === "privat" ? "Nur ich" : null],
      ];
    }
    if (art === "termin") {
      const v = terminVerstehen(text, { heute, leistungen, team, typen });
      return [
        ["Leistungen", [...v.leistungen.map((l) => l.name), v.leistungFrei].filter(Boolean).join(", ") || null, true],
        ["Datum", tagText(v.datum), true],
        ["Uhrzeit", v.uhrzeit ? `${v.uhrzeit} Uhr` : null, true],
        ["Name", v.name || null, true],
        ["Telefon", v.telefon || null],
        ["E-Mail", v.email || null],
        ["Kennzeichen", v.kennzeichen || null],
        ["Fahrzeug", v.fahrzeug ? `${v.fahrzeug.marke} ${v.fahrzeug.modell}`.trim() : null],
        ["Dauer", v.dauerMin ? `${v.dauerMin} Min.` : null],
        ["Mitarbeiter", v.mitarbeiter?.name ?? null],
        ["Notiz", v.notiz || null],
      ];
    }
    const v = rechnungVerstehen(text, { heute, preisliste: grundlagen.preisliste, lohnarten: grundlagen.stundensaetze.map((s) => s.name), typen });
    const pos = positionenBauen(v.positionen, { ...grundlagen, gemerkt: [] });
    return [
      ["Kunde", v.name || null, !v.kennzeichen],
      ["Kennzeichen", v.kennzeichen || null],
      ["Fahrzeug", v.fahrzeug ? `${v.fahrzeug.marke} ${v.fahrzeug.modell}`.trim() : null],
      ["Leistungsdatum", v.leistungsdatum ? tagText(v.leistungsdatum) : "heute"],
      ...pos.map(({ position: p, herkunft }, i): [string, string] => [
        `Position ${i + 1}`,
        p.rabatt
          ? `Rabatt ${p.rabatt.prozent != null ? `${zahl(p.rabatt.prozent)} %` : euro(p.rabatt.betrag_cent ?? 0)}`
          : `${zahl(p.menge)} ${p.einheit} ${p.text} · ${herkunft === "ohne Preis" ? "Preis gemerkt oder im Editor" : `${euro(Math.round(p.einzel_netto_cent ?? 0))} netto (${herkunft})`}`,
      ]),
      ...(pos.length ? [] : [["Positionen", null, true] as [string, null, boolean]]),
    ];
  }, [art, text, leistungen, team, typen, grundlagen]);

  return (
    <div className="rounded-md border border-linie px-3 py-2" aria-live="polite">
      <h2 className="mb-1 text-sm font-semibold">Erkannt</h2>
      <dl className="grid grid-cols-[minmax(0,7rem)_minmax(0,1fr)] gap-x-3 gap-y-1 text-sm">
        {zeilen
          .filter(([, wert, wichtig]) => wert || wichtig)
          .map(([name, wert]) => (
            <div key={name} className="contents">
              <dt className="text-grau">{name}</dt>
              <dd className={wert ? "" : "text-rot"}>{wert ?? "fehlt"}</dd>
            </div>
          ))}
      </dl>
    </div>
  );
}
