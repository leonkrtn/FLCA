"use client";

import { useRouter } from "next/navigation";
import { createContext, use, useCallback, useEffect, useId, useRef, useState } from "react";
import {
  anhangVorbereiten,
  belegAnhaengen,
  belegeSuchen,
  type EntwurfDaten,
  type EntwurfEingabe,
  entwurfSenden,
  entwurfSichern,
  entwurfVerwerfen,
  entwurfVorbereiten,
  jetztVersenden,
  kontakteVorschlagen,
  sendenRueckgaengig,
} from "@/lib/aktionen/mail";
import { adresseZerlegen, groesse, istAdresse } from "@/lib/mail/adressen";
import { hatText } from "@/lib/mail/inhalt";
import type { Anhang } from "@/lib/mail/postfach";
import { IconFeld, IconKnopf, unsichtbaresFeld } from "@/components/icon-knopf";
import { Bueroklammer, Dokument, Fenster as NormalGross, Kreuz, Minus, Papierkorb, Uhr, Vollbild } from "@/components/icons";
import { Editor, type EditorApi } from "./editor";

type Oeffnen = (art: EntwurfDaten["art"], mailId?: string | null, wunsch?: { postfach?: "firma" | "ich"; an?: string; betreff?: string }) => void;

const Kontext = createContext<Oeffnen | null>(null);

type Meldung = { id: string; text: string; mailId?: string; bis?: number; fehler?: boolean };

/**
 * Schreibfenster des Postfachs (wie Outlook ein eigenes Fenster über der Liste, am Handy bildschirmfüllend) und
 * die Meldung nach dem Senden mit „Rückgängig“. Liegt im Layout der Mail-Seiten, damit beides beim Wechsel
 * zwischen Ordnern und Mails stehen bleibt.
 */
export function SchreibenRahmen({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [daten, setDaten] = useState<EntwurfDaten | null>(null);
  const [laedt, setLaedt] = useState(false);
  const [meldungen, setMeldungen] = useState<Meldung[]>([]);
  const [klein, setKlein] = useState(false);
  // Uhr für den Countdown von „Rückgängig“ (tickt nur, solange eine Meldung wartet)
  const [jetzt, setJetzt] = useState(0);

  const melden = useCallback((m: Meldung) => setMeldungen((alt) => [...alt.filter((x) => x.id !== m.id), m]), []);
  const weg = useCallback((id: string) => setMeldungen((alt) => alt.filter((x) => x.id !== id)), []);

  const oeffnen: Oeffnen = useCallback(
    async (art, mailId = null, wunsch = {}) => {
      setLaedt(true);
      const r = await entwurfVorbereiten(art, mailId, wunsch);
      setLaedt(false);
      if (!r.ok) return melden({ id: "fehler", text: r.meldung, fehler: true });
      setKlein(false);
      setDaten(r.daten);
    },
    [melden],
  );

  // Nach „Senden“: 10 Sekunden „Rückgängig“, dann schickt der Browser los (sonst der Minutentakt)
  useEffect(() => {
    const offen = meldungen.filter((m) => m.bis && m.mailId);
    if (!offen.length) return;
    const t = setInterval(() => {
      const nun = Date.now();
      for (const m of offen) {
        if (m.bis! <= nun) {
          melden({ id: m.id, text: "Wird gesendet …" });
          jetztVersenden(m.mailId!).then((r) => {
            melden(r.ok ? { id: m.id, text: "Gesendet." } : { id: m.id, text: r.meldung, fehler: true });
            if (r.ok) setTimeout(() => weg(m.id), 4000);
            router.refresh();
          });
        }
      }
      setJetzt(nun);
    }, 500);
    return () => clearInterval(t);
  }, [meldungen, melden, weg, router]);

  return (
    <Kontext value={oeffnen}>
      {children}
      {daten ? (
        <Fenster
          key={daten.id ?? `${daten.art}-${daten.bezug}`}
          daten={daten}
          klein={klein}
          setKlein={setKlein}
          schliessen={() => setDaten(null)}
          gesendet={(id, sendenAm, geplant) => {
            setDaten(null);
            if (geplant) melden({ id, text: `Geplant für ${new Date(sendenAm).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" })}. Liegt im Postausgang.` });
            else melden({ id, text: "Wird gesendet", mailId: id, bis: new Date(sendenAm).getTime() });
            router.refresh();
          }}
          hinweis={(text) => melden({ id: `h-${Date.now()}`, text })}
        />
      ) : null}
      {laedt ? <div className="fixed bottom-4 right-4 z-50 rounded-md bg-tinte px-4 py-3 text-sm text-weiss shadow-xl">Wird geöffnet …</div> : null}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-50 flex flex-col items-center gap-2 px-4 lg:bottom-6 lg:left-auto lg:right-6 lg:items-end">
        {meldungen.map((m) => (
          <div key={m.id} className={`pointer-events-auto flex max-w-md items-center gap-4 rounded-md px-4 py-3 text-sm shadow-xl ${m.fehler ? "bg-rot text-weiss" : "bg-tinte text-weiss"}`}>
            <span>
              {m.text}
              {m.bis && jetzt ? <span className="zahlen"> ({Math.min(10, Math.max(0, Math.ceil((m.bis - jetzt) / 1000)))})</span> : null}
            </span>
            {m.bis && m.mailId ? (
              <button
                type="button"
                className="font-semibold underline"
                onClick={async () => {
                  weg(m.id);
                  const r = await sendenRueckgaengig(m.mailId!);
                  if (r.ok && r.daten) oeffnen("entwurf", m.mailId);
                  else melden({ id: m.id, text: "Zu spät, die Mail ist schon unterwegs.", fehler: true });
                  router.refresh();
                }}
              >
                Rückgängig
              </button>
            ) : (
              <button type="button" className="text-weiss/70 hover:text-weiss" aria-label="Schließen" onClick={() => weg(m.id)}>
                ×
              </button>
            )}
          </div>
        ))}
      </div>
    </Kontext>
  );
}

export function useSchreiben(): Oeffnen {
  const o = use(Kontext);
  if (!o) throw new Error("SchreibenRahmen fehlt");
  return o;
}

/** Knopf, der das Schreibfenster öffnet (neue Mail, Antwort, Weiterleitung, Entwurf). */
export function SchreibenKnopf({
  art,
  mailId,
  wunsch,
  className = "knopf knopf-rahmen knopf-klein",
  children,
}: {
  art: EntwurfDaten["art"];
  mailId?: string;
  wunsch?: { postfach?: "firma" | "ich"; an?: string; betreff?: string };
  className?: string;
  children: React.ReactNode;
}) {
  const oeffnen = useSchreiben();
  return (
    <button type="button" className={className} onClick={() => oeffnen(art, mailId ?? null, wunsch)}>
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Fenster
// ---------------------------------------------------------------------------

function Fenster({
  daten,
  klein,
  setKlein,
  schliessen,
  gesendet,
  hinweis,
}: {
  daten: EntwurfDaten;
  klein: boolean;
  setKlein: (k: boolean) => void;
  schliessen: () => void;
  gesendet: (id: string, sendenAm: string, geplant: boolean) => void;
  hinweis: (text: string) => void;
}) {
  const router = useRouter();
  const editor = useRef<EditorApi>(null);
  const [id, setId] = useState(daten.id);
  const [von, setVon] = useState(daten.von);
  const [an, setAn] = useState(daten.an);
  const [cc, setCc] = useState(daten.cc);
  const [bcc, setBcc] = useState(daten.bcc);
  const [mitCc, setMitCc] = useState(daten.cc.length > 0 || daten.bcc.length > 0);
  const [betreff, setBetreff] = useState(daten.betreff);
  const [html, setHtml] = useState(daten.html);
  const [anhaenge, setAnhaenge] = useState<Anhang[]>(daten.anhaenge);
  const [status, setStatus] = useState(daten.versand?.fehler ? `Letzter Versuch fehlgeschlagen: ${daten.versand.fehler}` : "");
  const [fehler, setFehler] = useState("");
  const [hochladen, setHochladen] = useState(0);
  const [beschaeftigt, setBeschaeftigt] = useState(false);
  const [spaeterOffen, setSpaeterOffen] = useState(false);
  const [belege, setBelege] = useState<{ kunde: string; belege: { art: "rechnung" | "kv" | "auftrag"; id: string; text: string }[] }[] | null>(null);
  const [gross, setGross] = useState(false);
  const geaendert = useRef(false);
  const speichernLaeuft = useRef<Promise<string | null> | null>(null);
  const titelId = useId();

  const eingabe = useCallback(
    (): EntwurfEingabe => ({ id, von, an, cc: mitCc ? cc : [], bcc: mitCc ? bcc : [], betreff, html: editor.current?.html() ?? html, anhaenge, bezug: daten.bezug }),
    [id, von, an, cc, bcc, mitCc, betreff, html, anhaenge, daten.bezug],
  );

  const sichern = useCallback(async (): Promise<string | null> => {
    if (speichernLaeuft.current) await speichernLaeuft.current;
    if (!geaendert.current && id) return id;
    geaendert.current = false;
    const lauf = entwurfSichern(eingabe()).then((r) => {
      if (r.ok) {
        setId(r.daten);
        setStatus(`Entwurf gespeichert ${new Date().toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}`);
        return r.daten;
      }
      setStatus(r.meldung);
      return null;
    });
    speichernLaeuft.current = lauf;
    const ergebnis = await lauf;
    speichernLaeuft.current = null;
    return ergebnis;
  }, [eingabe, id]);

  // Automatisch speichern: 3 Sekunden nach der letzten Änderung
  useEffect(() => {
    if (!geaendert.current) return;
    const t = setTimeout(() => void sichern(), 3000);
    return () => clearTimeout(t);
  }, [an, cc, bcc, betreff, html, anhaenge, von, sichern]);

  const aendern = <T,>(setzer: (w: T) => void) => (w: T) => {
    geaendert.current = true;
    setzer(w);
  };

  async function senden(spaeter: string | null) {
    setFehler("");
    const offen = [...an, ...cc, ...bcc];
    if (!offen.length) return setFehler("Bitte mindestens einen Empfänger eintragen.");
    if (!betreff.trim() && !window.confirm("Ohne Betreff senden?")) return;
    if (!hatText(editor.current?.html() ?? html) && !anhaenge.length) return setFehler("Die Mail ist leer.");
    setBeschaeftigt(true);
    if (speichernLaeuft.current) await speichernLaeuft.current;
    const r = await entwurfSenden(eingabe(), spaeter);
    setBeschaeftigt(false);
    if (!r.ok) return setFehler(r.meldung);
    gesendet(r.daten.id, r.daten.senden_am, Boolean(spaeter));
  }

  async function zumachen() {
    const leer = !an.length && !betreff.trim() && !anhaenge.length && !geaendert.current && !id;
    if (!leer && geaendert.current) {
      await sichern();
      hinweis("Als Entwurf gespeichert.");
      router.refresh();
    }
    schliessen();
  }

  async function verwerfen() {
    if (!window.confirm("Diesen Entwurf verwerfen?")) return;
    if (speichernLaeuft.current) await speichernLaeuft.current;
    if (id) await entwurfVerwerfen(id);
    router.refresh();
    schliessen();
  }

  async function dateien(liste: FileList | null) {
    if (!liste?.length) return;
    setFehler("");
    for (const f of Array.from(liste)) {
      setHochladen((n) => n + 1);
      try {
        const a = await anhangVorbereiten(f.name, f.size);
        if (!a.ok) {
          setFehler(`${f.name}: ${a.meldung}`);
          continue;
        }
        const body = new FormData();
        body.append("", f);
        const res = await fetch(a.url, { method: "PUT", body }).catch(() => null);
        if (!res?.ok) {
          setFehler(`${f.name}: Upload fehlgeschlagen.`);
          continue;
        }
        anhangDazu({ pfad: a.pfad, name: f.name, typ: f.type || "application/octet-stream", groesse: f.size });
      } finally {
        setHochladen((n) => n - 1);
      }
    }
  }
  function anhangDazu(a: Anhang) {
    geaendert.current = true;
    setAnhaenge((alt) => [...alt, a]);
  }

  const firmaAbsender = daten.absender.find((a) => a.adresse === von)?.firma;

  if (klein) {
    return (
      <div className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] right-4 z-50 w-72 lg:bottom-0 rounded-t-md bg-tinte text-weiss shadow-xl lg:right-6">
        <button type="button" className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm font-semibold" onClick={() => setKlein(false)}>
          <span className="truncate">{betreff || "Neue Mail"}</span>
          <span aria-hidden>▴</span>
        </button>
      </div>
    );
  }

  return (
    <div
      role="dialog"
      aria-labelledby={titelId}
      className={`fixed z-50 flex flex-col bg-weiss shadow-2xl ring-1 ring-black/10 inset-0 pt-[env(safe-area-inset-top)] lg:pt-0 ${
        gross ? "lg:inset-8 lg:rounded-md" : "lg:inset-auto lg:bottom-0 lg:right-6 lg:h-[min(46rem,calc(100dvh-3rem))] lg:w-[44rem] lg:rounded-t-md"
      }`}
    >
      <div className="flex items-center justify-between gap-2 border-b border-linie bg-boden px-4 py-2">
        <h2 id={titelId} className="truncate font-semibold">
          {daten.art === "antwort" ? "Antworten" : daten.art === "weiter" ? "Weiterleiten" : daten.art === "entwurf" ? "Entwurf" : "Neue Mail"}
        </h2>
        <div className="flex items-center gap-0.5 text-sm">
          <span className="hidden lg:contents">
            <IconKnopf text="Verkleinern" aufBoden onClick={() => setKlein(true)}>
              <Minus />
            </IconKnopf>
            <IconKnopf text={gross ? "Normale Größe" : "Groß"} aufBoden onClick={() => setGross(!gross)}>
              {gross ? <NormalGross /> : <Vollbild />}
            </IconKnopf>
          </span>
          <IconKnopf text="Schließen" aufBoden lage={{ ausrichtung: "rechts" }} onClick={zumachen}>
            <Kreuz />
          </IconKnopf>
        </div>
      </div>

      <div className="grid gap-0 border-b border-linie px-4 text-sm">
        {daten.absender.length > 1 ? (
          <label className="flex min-h-11 items-center gap-3 border-b border-linie">
            <span className="w-12 shrink-0 text-grau">Von</span>
            <select value={von} onChange={(e) => aendern(setVon)(e.target.value)} className="min-w-0 flex-1 bg-transparent py-2 outline-none">
              {daten.absender.map((a) => (
                <option key={a.adresse} value={a.adresse}>
                  {a.name} &lt;{a.adresse}&gt;{a.firma ? " · Firma" : ""}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <EmpfaengerFeld label="An" werte={an} setWerte={aendern(setAn)} autoFokus={!an.length} zusatz={!mitCc ? <button type="button" className="shrink-0 text-grau hover:text-tinte" onClick={() => setMitCc(true)}>Cc/Bcc</button> : null} />
        {mitCc ? (
          <>
            <EmpfaengerFeld label="Cc" werte={cc} setWerte={aendern(setCc)} />
            <EmpfaengerFeld label="Bcc" werte={bcc} setWerte={aendern(setBcc)} />
          </>
        ) : null}
        <label className="flex min-h-11 items-center gap-3">
          <span className="w-12 shrink-0 text-grau">Betreff</span>
          <input value={betreff} onChange={(e) => aendern(setBetreff)(e.target.value)} maxLength={300} className="min-w-0 flex-1 bg-transparent py-2 outline-none" />
        </label>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        <Editor ref={editor} wert={daten.html} onAenderung={aendern(setHtml)} vorlagen={daten.vorlagen} minHoehe="16rem" />
        {anhaenge.length ? (
          <ul className="mt-3 flex flex-wrap gap-2 text-sm">
            {anhaenge.map((a) => (
              <li key={a.pfad} className="flex items-center gap-2 rounded-sm border border-linie px-2 py-1">
                <span className="max-w-56 truncate">{a.name}</span>
                <span className="zahlen text-grau">{groesse(a.groesse)}</span>
                <button type="button" aria-label={`${a.name} entfernen`} className="text-grau hover:text-tinte" onClick={() => aendern(setAnhaenge)(anhaenge.filter((x) => x.pfad !== a.pfad))}>
                  ×
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        {belege ? (
          <div className="mt-3 rounded-sm border border-linie p-3 text-sm">
            <div className="mb-2 flex items-center justify-between">
              <span className="font-semibold">Beleg anhängen</span>
              <button type="button" className="text-grau" onClick={() => setBelege(null)}>Schließen</button>
            </div>
            {belege.length ? (
              belege.map((k) => (
                <div key={k.kunde} className="mb-2">
                  <p className="text-grau">{k.kunde}</p>
                  <div className="flex flex-wrap gap-2">
                    {k.belege.map((b) => (
                      <button
                        key={`${b.art}-${b.id}`}
                        type="button"
                        className="knopf knopf-rahmen knopf-klein"
                        onClick={async () => {
                          setHochladen((n) => n + 1);
                          const r = await belegAnhaengen(b.art, b.id);
                          setHochladen((n) => n - 1);
                          if (r.ok) anhangDazu(r.daten);
                          else setFehler(r.meldung);
                        }}
                      >
                        {b.text}
                      </button>
                    ))}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-grau">Zu den Empfängern gibt es keinen Kunden mit Belegen in der Kartei.</p>
            )}
          </div>
        ) : null}
      </div>

      <div className="border-t border-linie px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {fehler ? <p role="alert" className="mb-2 text-sm font-semibold text-rot">{fehler}</p> : null}
        {spaeterOffen ? <SpaeterSenden abbrechen={() => setSpaeterOffen(false)} senden={(iso) => senden(iso)} /> : null}
        <div className="flex items-center gap-1">
          <button type="button" disabled={beschaeftigt || hochladen > 0} className="knopf knopf-dunkel mr-1" onClick={() => senden(null)}>
            {beschaeftigt ? "Wird gesendet …" : "Senden"}
          </button>
          <IconKnopf text="Später senden" lage={{ seite: "oben" }} disabled={beschaeftigt || hochladen > 0} onClick={() => setSpaeterOffen(!spaeterOffen)} aria-expanded={spaeterOffen}>
            <Uhr />
          </IconKnopf>
          <IconFeld text="Datei anhängen" lage={{ seite: "oben" }} icon={<Bueroklammer />}>
            <input type="file" multiple aria-label="Datei anhängen" className={unsichtbaresFeld} onChange={(e) => { void dateien(e.target.files); e.target.value = ""; }} />
          </IconFeld>
          <IconKnopf
            text="Beleg anhängen"
            lage={{ seite: "oben" }}
            onClick={async () => {
              const r = await belegeSuchen([...an, ...cc]);
              if (r.ok) setBelege(r.daten);
              else setFehler(r.meldung);
            }}
          >
            <Dokument />
          </IconKnopf>
          <span className="ml-auto" />
          <IconKnopf text="Verwerfen" lage={{ seite: "oben", ausrichtung: "rechts" }} onClick={verwerfen}>
            <Papierkorb />
          </IconKnopf>
        </div>
        <p className="mt-2 min-h-5 truncate text-xs text-grau">
          {hochladen ? "Anhang wird vorbereitet … " : ""}
          {firmaAbsender ? "Aus dem Firmenpostfach. " : ""}
          {status}
        </p>
      </div>
    </div>
  );
}

function SpaeterSenden({ abbrechen, senden }: { abbrechen: () => void; senden: (iso: string) => void }) {
  // Vorschlag: morgen 8 Uhr (Ortszeit des Geräts, in Deutschland also Berliner Zeit)
  const morgen = new Date();
  morgen.setDate(morgen.getDate() + 1);
  morgen.setHours(8, 0, 0, 0);
  const lokal = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  const [wert, setWert] = useState(lokal(morgen));
  return (
    <div className="mb-3 flex flex-wrap items-end gap-2 rounded-sm bg-boden p-3">
      <label className="block">
        <span className="label">Senden am</span>
        <input type="datetime-local" value={wert} min={lokal(new Date())} onChange={(e) => setWert(e.target.value)} className="feld" />
      </label>
      <button type="button" className="knopf knopf-dunkel" onClick={() => wert && senden(new Date(wert).toISOString())}>Planen</button>
      <button type="button" className="knopf knopf-rahmen" onClick={abbrechen}>Abbrechen</button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empfänger mit Vorschlägen
// ---------------------------------------------------------------------------

/**
 * Empfänger als Kästchen wie in Outlook: Tippen zeigt Vorschläge aus Kundenkartei, Team und bisherigen Kontakten.
 * Enter, Komma, Semikolon oder Verlassen des Felds übernehmen die getippte Adresse; Rücktaste im leeren Feld
 * nimmt die letzte wieder heraus.
 */
function EmpfaengerFeld({ label, werte, setWerte, autoFokus, zusatz }: { label: string; werte: string[]; setWerte: (w: string[]) => void; autoFokus?: boolean; zusatz?: React.ReactNode }) {
  const [text, setText] = useState("");
  const [vorschlaege, setVorschlaege] = useState<{ name: string; adresse: string; art: string }[]>([]);
  const [markiert, setMarkiert] = useState(0);
  const listeId = useId();

  useEffect(() => {
    const q = text.trim();
    if (q.length < 2) return;
    let aktuell = true;
    const t = setTimeout(async () => {
      const r = await kontakteVorschlagen(q).catch(() => []);
      if (aktuell) {
        setVorschlaege(r.filter((k) => !werte.includes(k.adresse)));
        setMarkiert(0);
      }
    }, 200);
    return () => {
      aktuell = false;
      clearTimeout(t);
    };
  }, [text, werte]);

  // Erst ab zwei Zeichen; ältere Vorschläge verschwinden, sobald das Feld wieder kürzer ist
  const treffer = text.trim().length >= 2 ? vorschlaege : [];

  const uebernehmen = (roh: string) => {
    const neu = roh
      .split(/[,;\s]+/)
      .map((a) => adresseZerlegen(a).adresse)
      .filter(Boolean);
    if (!neu.length) return;
    setWerte([...werte, ...neu.filter((a) => !werte.includes(a))]);
    setText("");
    setVorschlaege([]);
  };

  return (
    <div className="relative flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1 border-b border-linie py-1.5">
      <span className="w-12 shrink-0 text-grau">{label}</span>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
        {werte.map((a) => (
          <span key={a} className={`flex items-center gap-1 rounded-sm px-2 py-0.5 ${istAdresse(a) ? "bg-boden" : "bg-rot/15 text-rot"}`}>
            {a}
            <button type="button" aria-label={`${a} entfernen`} className="text-grau hover:text-tinte" onClick={() => setWerte(werte.filter((x) => x !== a))}>
              ×
            </button>
          </span>
        ))}
        <input
          value={text}
          autoFocus={autoFokus}
          onChange={(e) => {
            const v = e.target.value;
            if (/[,;]$/.test(v)) uebernehmen(v.slice(0, -1));
            else setText(v);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown" && treffer.length) {
              e.preventDefault();
              setMarkiert((m) => Math.min(m + 1, treffer.length - 1));
            } else if (e.key === "ArrowUp" && treffer.length) {
              e.preventDefault();
              setMarkiert((m) => Math.max(m - 1, 0));
            } else if ((e.key === "Enter" || e.key === "Tab") && (text.trim() || treffer.length)) {
              if (e.key === "Enter" || treffer.length) e.preventDefault();
              uebernehmen(treffer[markiert]?.adresse ?? text);
            } else if (e.key === "Backspace" && !text && werte.length) setWerte(werte.slice(0, -1));
            else if (e.key === "Escape") setVorschlaege([]);
          }}
          onBlur={() => setTimeout(() => text.trim() && uebernehmen(text), 150)}
          inputMode="email"
          autoComplete="off"
          autoCapitalize="none"
          aria-label={label}
          aria-autocomplete="list"
          aria-controls={treffer.length ? listeId : undefined}
          className="min-w-32 flex-1 bg-transparent py-1 outline-none"
        />
      </div>
      {zusatz}
      {treffer.length ? (
        <ul id={listeId} role="listbox" className="absolute left-14 right-0 top-full z-10 mt-1 max-h-72 overflow-y-auto rounded-md bg-weiss py-1 shadow-xl ring-1 ring-black/10">
          {treffer.map((k, i) => (
            <li key={k.adresse} role="option" aria-selected={i === markiert}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  uebernehmen(k.adresse);
                }}
                className={`grid w-full px-3 py-2 text-left ${i === markiert ? "bg-boden" : "hover:bg-boden"}`}
              >
                <span className="font-semibold">{k.name || k.adresse}</span>
                <span className="text-xs text-grau">
                  {k.adresse} · {k.art === "kunde" ? "Kunde" : k.art === "team" ? "Team" : "zuletzt"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
