"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { UnterschriftFeld } from "@/components/admin/unterschrift";
import { Logo } from "@/components/logo";
import { bildschirmGeschicktVerwerfen, bildschirmSpeichern, bildschirmStand, bildschirmSuchen, bildschirmUnterschreiben } from "@/lib/aktionen/kundenbildschirm";
import { euro } from "@/lib/format";
import { type Ergebnis, LEER } from "@/lib/forms";
import type { BildschirmAuftrag, BildschirmKunde } from "@/lib/kundenbildschirm/daten";
import { type Sprache, SPRACHEN, type TextSchluessel, tx } from "@/lib/kundenbildschirm/texte";

type Schritt = "start" | "suche" | "auswahl" | "daten" | "auftrag" | "fertig";

type Props = { schluessel: string; firma: string; datenschutz: string; agb: string };

/** Wie oft der Bildschirm nachfragt, ob das Büro einen Auftrag geschickt hat. */
const ABFRAGE_MS = 4000;

/**
 * Der Kundenbildschirm: ein Rechner im Büro, zum Kunden gedreht, mit Tastatur und Maus. Bewusst ein einziger
 * Ablauf ohne Navigation: Start → neu oder suchen → Daten → (Auftrag unterschreiben) → Danke. Zurück an den
 * Anfang geht es nur über „Neu beginnen“, damit ein Kunde, der kurz wegschaut, nichts verliert.
 * „Neu beginnen“ baut alles neu auf (key), so bleibt von einem Kunden nichts für den nächsten stehen.
 */
export function Kundenbildschirm(props: Props) {
  const [durchlauf, setDurchlauf] = useState(0);
  const [sprache, setSprache] = useState<Sprache>("de");
  return <Ablauf key={durchlauf} {...props} sprache={sprache} setSprache={setSprache} neu={() => setDurchlauf((n) => n + 1)} />;
}

function Ablauf({ schluessel, firma, datenschutz, agb, sprache, setSprache, neu }: Props & { sprache: Sprache; setSprache: (s: Sprache) => void; neu: () => void }) {
  const t = (s: TextSchluessel) => tx(sprache, s);
  const [schritt, setSchritt] = useState<Schritt>("start");
  const [treffer, setTreffer] = useState<BildschirmKunde[]>([]);
  const [kunde, setKunde] = useState<BildschirmKunde | null>(null);
  const [kundeId, setKundeId] = useState<string | null>(null);
  const [auftraege, setAuftraege] = useState<BildschirmAuftrag[]>([]);
  const [vomBuero, setVomBuero] = useState<BildschirmAuftrag | null>(null);
  const [gueltig, setGueltig] = useState(true);
  const [text, setText] = useState<"datenschutz" | "agb" | null>(null);
  const [meldung, setMeldung] = useState("");
  // Ohne Unterschrift beendete Aufträge vom Büro: nicht wieder öffnen, auch wenn eine laufende Abfrage sie noch liefert
  const verworfen = useRef(new Set<string>());

  // Läuft der Kunde gerade nicht durch ein Formular, öffnet ein geschickter Auftrag sich von selbst; sonst Hinweis.
  const ruhig = schritt === "start" || schritt === "fertig";
  const geschicktOffen = auftraege[0]?.terminId === vomBuero?.terminId;
  // Die Abfrage läuft im Takt und braucht den aktuellen Stand, ohne bei jedem Schritt neu zu starten
  const ruhigRef = useRef(ruhig);
  useEffect(() => {
    ruhigRef.current = ruhig;
  });

  function geschicktOeffnen(a: BildschirmAuftrag) {
    setAuftraege([a]);
    setMeldung("");
    setSchritt("auftrag");
  }

  useEffect(() => {
    let aus = false;
    const fragen = async () => {
      const stand = await bildschirmStand(schluessel).catch(() => null);
      if (aus || !stand) return;
      setGueltig(stand.gueltig);
      const a = stand.auftrag && !verworfen.current.has(stand.auftrag.terminId) ? stand.auftrag : null;
      setVomBuero(a);
      if (a && ruhigRef.current) {
        ruhigRef.current = false;
        setAuftraege([a]);
        setMeldung("");
        setSchritt("auftrag");
      }
    };
    fragen();
    const takt = window.setInterval(fragen, ABFRAGE_MS);
    return () => {
      aus = true;
      window.clearInterval(takt);
    };
  }, [schluessel]);

  function auftragFertig(unterschrieben: boolean) {
    const aktuell = auftraege[0];
    if (!unterschrieben && aktuell && aktuell.terminId === vomBuero?.terminId) {
      verworfen.current.add(aktuell.terminId);
      setVomBuero(null);
      void bildschirmGeschicktVerwerfen(schluessel);
    }
    if (unterschrieben && aktuell?.terminId === vomBuero?.terminId) setVomBuero(null);
    const rest = auftraege.slice(1);
    setAuftraege(rest);
    if (!rest.length) setSchritt("fertig");
  }

  if (!gueltig) {
    return (
      <Rahmen firma={firma} sprache={sprache} setSprache={setSprache} neu={neu}>
        <p className="text-xl font-semibold text-fehler">{t("fehlerGeraet")}</p>
      </Rahmen>
    );
  }

  return (
    <Rahmen firma={firma} sprache={sprache} setSprache={setSprache} neu={schritt === "start" ? undefined : neu}>
      {vomBuero && !ruhig && !geschicktOffen ? (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-tinte bg-flaeche p-4">
          <p className="font-semibold">{t("vomBuero")}</p>
          <button type="button" onClick={() => geschicktOeffnen(vomBuero)} className="knopf knopf-dunkel">
            {t("oeffnen")}
          </button>
        </div>
      ) : null}

      {schritt === "start" ? (
        <Start t={t} weiter={(s) => setSchritt(s)} />
      ) : schritt === "suche" || schritt === "auswahl" ? (
        <Suche
          schluessel={schluessel}
          sprache={sprache}
          t={t}
          treffer={schritt === "auswahl" ? treffer : []}
          gefunden={(liste) => {
            if (liste.length === 1) {
              setKunde(liste[0]);
              setSchritt("daten");
            } else {
              setTreffer(liste);
              setSchritt("auswahl");
            }
          }}
          gewaehlt={(k) => {
            setKunde(k);
            setSchritt("daten");
          }}
        />
      ) : schritt === "daten" ? (
        <Daten
          schluessel={schluessel}
          sprache={sprache}
          t={t}
          kunde={kunde}
          zeigeText={setText}
          gespeichert={(id, liste) => {
            setKundeId(id);
            setMeldung(t("gespeichert"));
            setAuftraege(liste);
            setSchritt(liste.length ? "auftrag" : "fertig");
          }}
        />
      ) : schritt === "auftrag" && auftraege[0] ? (
        <>
          {meldung ? <p role="status" className="mb-4 font-semibold text-ok">{meldung}</p> : null}
          <AuftragUnterschreiben
            key={auftraege[0].terminId}
            schluessel={schluessel}
            sprache={sprache}
            t={t}
            auftrag={auftraege[0]}
            kundeId={kundeId}
            weitere={auftraege.length > 1}
            zeigeText={setText}
            fertig={auftragFertig}
          />
        </>
      ) : (
        <Fertig t={t} neu={neu} />
      )}

      {text ? <Rechtstext titel={text === "agb" ? t("agbTitel") : t("datenschutzTitel")} html={text === "agb" ? agb : datenschutz} schliessen={() => setText(null)} t={t} /> : null}
    </Rahmen>
  );
}

function Rahmen({ firma, sprache, setSprache, neu, children }: { firma: string; sprache: Sprache; setSprache: (s: Sprache) => void; neu?: () => void; children: React.ReactNode }) {
  const t = (s: TextSchluessel) => tx(sprache, s);
  return (
    <div className="flex min-h-dvh flex-col bg-boden text-lg text-tinte">
      <header className="flex items-center justify-between gap-4 border-b border-linie bg-flaeche px-6 py-4 md:px-10">
        <Logo className="h-12 w-auto" titel={firma} />
        <div className="flex items-center gap-3">
          {neu ? (
            <button type="button" onClick={neu} className="knopf knopf-rahmen">
              {t("neuBeginnen")}
            </button>
          ) : null}
          <div role="group" aria-label="Sprache / Language" className="flex overflow-hidden rounded-md border border-linie">
            {SPRACHEN.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSprache(s)}
                aria-pressed={sprache === s}
                className={`px-3 py-2 text-base font-semibold uppercase ${sprache === s ? "bg-tinte text-boden" : "bg-flaeche text-grau hover:text-tinte"}`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">{children}</main>
      <footer className="flex justify-end gap-4 px-6 pb-3 text-xs text-grau-hell">
        <button
          type="button"
          onClick={() => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()).catch(() => undefined)}
          className="hover:text-grau"
        >
          {t("vollbild")}
        </button>
        <Link href="/admin/kundenbildschirm" className="hover:text-grau">
          {t("beenden")}
        </Link>
      </footer>
    </div>
  );
}

function Start({ t, weiter }: { t: (s: TextSchluessel) => string; weiter: (s: Schritt) => void }) {
  return (
    <div className="grid gap-8">
      <div>
        <h1 className="schmal text-5xl uppercase md:text-6xl">{t("willkommen")}</h1>
        <p className="mt-2 text-grau">{t("einleitung")}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Wahl titel={t("neu")} unter={t("neuUnter")} onClick={() => weiter("daten")} autoFocus />
        <Wahl titel={t("bekannt")} unter={t("bekanntUnter")} onClick={() => weiter("suche")} />
      </div>
    </div>
  );
}

function Wahl({ titel, unter, onClick, autoFocus }: { titel: string; unter: string; onClick: () => void; autoFocus?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      autoFocus={autoFocus}
      className="grid min-h-40 content-end gap-1 rounded-lg border border-linie bg-flaeche p-6 text-left transition-colors hover:border-tinte focus-visible:border-tinte"
    >
      <span className="schmal text-3xl uppercase">{titel}</span>
      <span className="text-base text-grau">{unter}</span>
    </button>
  );
}

function Suche({
  schluessel,
  sprache,
  t,
  treffer,
  gefunden,
  gewaehlt,
}: {
  schluessel: string;
  sprache: Sprache;
  t: (s: TextSchluessel) => string;
  treffer: BildschirmKunde[];
  gefunden: (k: BildschirmKunde[]) => void;
  gewaehlt: (k: BildschirmKunde) => void;
}) {
  const [zustand, aktion] = useActionState(async (v: Ergebnis, fd: FormData) => {
    const e = await bildschirmSuchen(schluessel, v, fd);
    if (e.status === "ok") gefunden((e.daten?.kunden as BildschirmKunde[]) ?? []);
    return e;
  }, LEER);

  if (treffer.length) {
    return (
      <div className="grid gap-4">
        <p className="font-semibold">{t("mehrereGefunden")}</p>
        {treffer.map((k, i) => (
          <button key={k.id} type="button" autoFocus={i === 0} onClick={() => gewaehlt(k)} className="rounded-lg border border-linie bg-flaeche p-4 text-left hover:border-tinte focus-visible:border-tinte">
            <span className="block font-semibold">{k.name}</span>
            <span className="block text-base text-grau">{[k.firma, k.ort, k.fahrzeuge.map((f) => f.kennzeichen).join(", ")].filter(Boolean).join(" · ")}</span>
          </button>
        ))}
      </div>
    );
  }

  return (
    <form action={aktion} className="grid gap-4">
      <input type="hidden" name="sprache" value={sprache} />
      <label className="block">
        <span className="schmal mb-2 block text-3xl uppercase">{t("suchFeld")}</span>
        <input name="q" required autoFocus autoComplete="off" spellCheck={false} placeholder={t("suchBeispiel")} className="feld h-16 text-2xl" defaultValue={zustand.werte?.q} />
      </label>
      <Knopf text={t("suchen")} laeuft={t("suchen")} />
      {zustand.status === "fehler" ? <p role="alert" className="font-semibold text-fehler">{zustand.meldung}</p> : null}
    </form>
  );
}

/** Absendeknopf groß; wird beim Absenden gesperrt, damit ein Doppelklick nichts doppelt anlegt. */
function Knopf({ text, laeuft }: { text: string; laeuft: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={`knopf knopf-dunkel h-14 text-lg ${pending ? "cursor-progress" : ""}`}>
      {pending ? laeuft : text}
    </button>
  );
}

function Daten({
  schluessel,
  sprache,
  t,
  kunde,
  zeigeText,
  gespeichert,
}: {
  schluessel: string;
  sprache: Sprache;
  t: (s: TextSchluessel) => string;
  kunde: BildschirmKunde | null;
  zeigeText: (art: "datenschutz" | "agb") => void;
  gespeichert: (kundeId: string, auftraege: BildschirmAuftrag[]) => void;
}) {
  // Neue Kunden haben gleich einen Fahrzeugblock; bekannte können eins dazunehmen.
  const [neueFahrzeuge, setNeueFahrzeuge] = useState(kunde?.fahrzeuge.length ? 0 : 1);
  const [zustand, aktion] = useActionState(async (v: Ergebnis, fd: FormData) => {
    const e = await bildschirmSpeichern(schluessel, kunde?.id ?? null, v, fd);
    if (e.status === "ok") gespeichert(e.daten?.kundeId as string, (e.daten?.auftraege as BildschirmAuftrag[]) ?? []);
    return e;
  }, LEER);
  const fehlerRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (zustand.status === "fehler") fehlerRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [zustand]);
  // Nach einem Fehler gilt, was zuletzt eingetippt war; sonst die Kartei
  const w = (name: string, vorgabe?: string | number | null) => zustand.werte?.[name] ?? (vorgabe == null ? "" : String(vorgabe));
  const haken = (name: string, vorgabe: boolean) => (zustand.werte ? zustand.werte[name] === "on" : vorgabe);

  return (
    <form action={aktion} className="grid gap-8" key={zustand.versuch}>
      <input type="hidden" name="sprache" value={sprache} />
      {kunde ? <h1 className="schmal text-4xl uppercase">{t("willkommen")}, {kunde.name}</h1> : null}

      <Gruppe titel={t("abschnittKontakt")}>
        <Eingabe label={t("name")} name="name" wert={w("name", kunde?.name)} pflicht={t("pflicht")} autoFocus autoComplete="name" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Eingabe label={t("telefon")} name="telefon" typ="tel" wert={w("telefon", kunde?.telefon)} autoComplete="tel" />
          <Eingabe label={t("email")} name="email" typ="email" wert={w("email", kunde?.email)} autoComplete="email" />
        </div>
      </Gruppe>

      <Gruppe titel={t("abschnittAnschrift")}>
        <Eingabe label={t("strasse")} name="strasse" wert={w("strasse", kunde?.strasse)} autoComplete="street-address" />
        <div className="grid gap-4 sm:grid-cols-[10rem_minmax(0,1fr)]">
          <Eingabe label={t("plz")} name="plz" wert={w("plz", kunde?.plz)} inputMode="numeric" autoComplete="postal-code" />
          <Eingabe label={t("ort")} name="ort" wert={w("ort", kunde?.ort)} autoComplete="address-level2" />
        </div>
      </Gruppe>

      <Gruppe titel={kunde?.fahrzeuge.length ? t("abschnittFahrzeuge") : t("abschnittFahrzeug")}>
        {kunde?.fahrzeuge.map((f) => (
          <div key={f.id} className="grid gap-4 rounded-lg border border-linie bg-flaeche p-4 sm:grid-cols-3">
            <input type="hidden" name="fz_ids" value={f.id} />
            <p className="zahlen text-xl font-semibold sm:col-span-3">{f.kennzeichen}</p>
            <Eingabe label={t("marke")} name={`fz_${f.id}_marke`} wert={w(`fz_${f.id}_marke`, f.marke)} />
            <Eingabe label={t("modell")} name={`fz_${f.id}_modell`} wert={w(`fz_${f.id}_modell`, f.modell)} />
            <Eingabe label={t("km")} name={`fz_${f.id}_km`} wert={w(`fz_${f.id}_km`, f.km_stand)} inputMode="numeric" />
          </div>
        ))}
        {Array.from({ length: neueFahrzeuge }, (_, i) => (
          <div key={i} className="grid gap-4 rounded-lg border border-linie bg-flaeche p-4 sm:grid-cols-2">
            <Eingabe label={t("kennzeichen")} name={`neu_${i}_kennzeichen`} wert={w(`neu_${i}_kennzeichen`)} grossbuchstaben />
            <Eingabe label={t("km")} name={`neu_${i}_km`} wert={w(`neu_${i}_km`)} inputMode="numeric" />
            <Eingabe label={t("marke")} name={`neu_${i}_marke`} wert={w(`neu_${i}_marke`)} />
            <Eingabe label={t("modell")} name={`neu_${i}_modell`} wert={w(`neu_${i}_modell`)} />
          </div>
        ))}
        <div className="flex flex-wrap gap-4 text-base">
          {neueFahrzeuge < 3 ? (
            <button type="button" onClick={() => setNeueFahrzeuge((n) => n + 1)} className="font-semibold underline">
              {t("weiteresFahrzeug")}
            </button>
          ) : null}
          {neueFahrzeuge > (kunde?.fahrzeuge.length ? 0 : 1) ? (
            <button type="button" onClick={() => setNeueFahrzeuge((n) => n - 1)} className="text-grau underline">
              {t("fahrzeugEntfernen")}
            </button>
          ) : null}
        </div>
      </Gruppe>

      <Gruppe titel={t("abschnittFirma")}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Eingabe label={t("firma")} name="firma" wert={w("firma", kunde?.firma)} autoComplete="organization" />
          <Eingabe label={t("ustId")} name="ust_id" wert={w("ust_id", kunde?.ust_id)} grossbuchstaben />
        </div>
      </Gruppe>

      <Gruppe titel={t("abschnittEinwilligung")}>
        <Haken name="datenschutz" an={haken("datenschutz", Boolean(kunde?.datenschutz))} pflicht>
          {t("datenschutz")}{" "}
          <button type="button" onClick={() => zeigeText("datenschutz")} className="underline">
            {t("datenschutzLesen")}
          </button>
        </Haken>
        <Haken name="whatsapp" an={haken("whatsapp", Boolean(kunde?.whatsapp))}>{t("whatsapp")}</Haken>
        <Haken name="erinnerung" an={haken("erinnerung", Boolean(kunde?.erinnerung))}>{t("erinnerung")}</Haken>
      </Gruppe>

      {zustand.status === "fehler" ? (
        <p ref={fehlerRef} role="alert" className="font-semibold text-fehler">
          {zustand.meldung}
        </p>
      ) : null}
      <Knopf text={t("speichern")} laeuft={t("speichert")} />
    </form>
  );
}

/** Abschnitt mit Überschrift. Bewusst kein fieldset mit legend (Trennstrich lief sonst durch die Schrift, siehe Fehlerbuch). */
function Gruppe({ titel, children }: { titel: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-4">
      <h2 className="schmal text-2xl uppercase">{titel}</h2>
      {children}
    </section>
  );
}

function Eingabe({
  label,
  name,
  wert,
  typ = "text",
  pflicht,
  autoFocus,
  autoComplete = "off",
  inputMode,
  grossbuchstaben,
}: {
  label: string;
  name: string;
  wert: string;
  typ?: "text" | "tel" | "email";
  pflicht?: string;
  autoFocus?: boolean;
  autoComplete?: string;
  inputMode?: "numeric";
  grossbuchstaben?: boolean;
}) {
  return (
    <label className="block">
      <span className="label">
        {label}
        {pflicht ? <span className="text-grau"> ({pflicht})</span> : null}
      </span>
      <input
        name={name}
        type={typ}
        defaultValue={wert}
        required={Boolean(pflicht)}
        autoFocus={autoFocus}
        autoComplete={autoComplete}
        inputMode={inputMode}
        spellCheck={false}
        className={`feld h-12 text-lg ${grossbuchstaben ? "uppercase" : ""}`}
      />
    </label>
  );
}

function Haken({ name, an, pflicht, children }: { name: string; an: boolean; pflicht?: boolean; children: React.ReactNode }) {
  return (
    <label className="flex items-start gap-3">
      <input type="checkbox" name={name} defaultChecked={an} required={pflicht} className="mt-1 size-6 shrink-0 accent-tinte" />
      <span>{children}</span>
    </label>
  );
}

function AuftragUnterschreiben({
  schluessel,
  sprache,
  t,
  auftrag: a,
  kundeId,
  weitere,
  zeigeText,
  fertig,
}: {
  schluessel: string;
  sprache: Sprache;
  t: (s: TextSchluessel) => string;
  auftrag: BildschirmAuftrag;
  kundeId: string | null;
  weitere: boolean;
  zeigeText: (art: "datenschutz" | "agb") => void;
  fertig: (unterschrieben: boolean) => void;
}) {
  const [bild, setBild] = useState("");
  const [zustand, aktion] = useActionState(bildschirmUnterschreiben.bind(null, schluessel, a.terminId, kundeId), LEER);

  if (zustand.status === "ok") {
    return (
      <div className="grid gap-6">
        <p role="status" className="text-xl font-semibold text-ok">{zustand.meldung}</p>
        {weitere ? <p>{t("naechsterAuftrag")}</p> : null}
        <button type="button" autoFocus onClick={() => fertig(true)} className="knopf knopf-dunkel h-14 text-lg">
          {t("speichern")}
        </button>
      </div>
    );
  }

  return (
    <form action={aktion} className="grid gap-6">
      <input type="hidden" name="sprache" value={sprache} />
      <input type="hidden" name="bild" value={bild} />
      <div>
        <h1 className="schmal text-4xl uppercase">
          {t("auftragTitel")} <span className="zahlen">{a.nummer}</span>
        </h1>
        <p className="mt-1 text-grau">{t("auftragEinleitung")}</p>
      </div>
      <dl className="grid gap-x-6 gap-y-1 sm:grid-cols-[auto_minmax(0,1fr)]">
        <dt className="text-grau">{t("termin")}</dt>
        <dd>{a.termin[sprache]}</dd>
        {a.fahrzeug ? (
          <>
            <dt className="text-grau">{t("fahrzeug")}</dt>
            <dd className="zahlen">{a.fahrzeug}</dd>
          </>
        ) : null}
        {a.beschreibung ? (
          <>
            <dt className="text-grau">{t("beschreibung")}</dt>
            <dd className="whitespace-pre-line">{a.beschreibung}</dd>
          </>
        ) : null}
      </dl>

      <div className="rounded-lg border border-linie bg-flaeche p-5">
        <h2 className="schmal mb-2 text-2xl uppercase">{t("positionen")}</h2>
        <ul className="divide-y divide-linie">
          {a.zeilen.map((z, i) => (
            <li key={i} className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 py-2">
              <span className="min-w-0 break-words">
                {z.text}
                {z.detail ? <span className="block text-base text-grau">{z.detail}</span> : null}
              </span>
              <span className="zahlen text-right">{euro(z.betrag)}</span>
            </li>
          ))}
        </ul>
        <dl className="zahlen mt-3 grid grid-cols-[minmax(0,1fr)_auto] gap-x-6 border-t-2 border-tinte pt-2 text-right">
          <dt className="font-sans text-grau">{t("netto")}</dt>
          <dd>{euro(a.netto)}</dd>
          <dt className="font-sans text-grau">{t("mwst")}</dt>
          <dd>{euro(a.steuer)}</dd>
          <dt className="font-sans font-semibold">{t("gesamt")}</dt>
          <dd className="text-2xl">{euro(a.brutto)}</dd>
        </dl>
        {a.kostengrenze != null ? (
          <p className="mt-3 text-base text-grau">
            {t("kostengrenze")} <span className="zahlen font-semibold text-tinte">{euro(a.kostengrenze)}</span>
          </p>
        ) : null}
      </div>

      <label className="block">
        <span className="label">{t("unterzeichner")}</span>
        <input name="name" defaultValue={zustand.werte?.name ?? a.kundeName} required autoComplete="off" spellCheck={false} className="feld h-12 text-lg" />
      </label>
      <UnterschriftFeld onBild={setBild} label={t("unterschrift")} hilfe={t("unterschriftHilfe")} neuText={t("unterschriftNeu")} hoch />
      <Haken name="agb" an={zustand.werte?.agb === "on"} pflicht>
        {t("agb")}{" "}
        <button type="button" onClick={() => zeigeText("agb")} className="underline">
          {t("agbLesen")}
        </button>
      </Haken>

      {zustand.status === "fehler" ? <p role="alert" className="font-semibold text-fehler">{zustand.meldung}</p> : null}
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
        <Knopf text={t("erteilen")} laeuft={t("speichert")} />
        <button type="button" onClick={() => fertig(false)} className="knopf knopf-rahmen h-14 text-lg">
          {t("spaeter")}
        </button>
      </div>
    </form>
  );
}

function Fertig({ t, neu }: { t: (s: TextSchluessel) => string; neu: () => void }) {
  return (
    <div className="grid gap-6">
      <h1 className="schmal text-5xl uppercase md:text-6xl">{t("fertigTitel")}</h1>
      <p className="text-xl">{t("fertigText")}</p>
      <button type="button" onClick={neu} className="knopf knopf-rahmen h-14 text-lg sm:justify-self-start">
        {t("neuBeginnen")}
      </button>
    </div>
  );
}

/** Datenschutzhinweis oder AGB über dem Formular, damit der Kunde nicht von der Seite weg muss. */
function Rechtstext({ titel, html, schliessen, t }: { titel: string; html: string; schliessen: () => void; t: (s: TextSchluessel) => string }) {
  const knopf = useRef<HTMLButtonElement>(null);
  // Der Bildschirm zeichnet alle paar Sekunden neu (Abfrage beim Büro); der Fokus soll nur beim Öffnen springen.
  const zu = useRef(schliessen);
  useEffect(() => {
    zu.current = schliessen;
  });
  useEffect(() => {
    knopf.current?.focus();
    const taste = (e: KeyboardEvent) => e.key === "Escape" && zu.current();
    window.addEventListener("keydown", taste);
    return () => window.removeEventListener("keydown", taste);
  }, []);
  return (
    <div role="dialog" aria-modal="true" aria-label={titel} className="fixed inset-0 z-50 grid place-items-center bg-tinte/40 p-6">
      <div className="flex max-h-[85dvh] w-full max-w-3xl flex-col rounded-lg bg-flaeche">
        <div className="flex items-center justify-between gap-4 border-b border-linie px-6 py-4">
          <h2 className="schmal text-2xl uppercase">{titel}</h2>
          <button ref={knopf} type="button" onClick={schliessen} className="knopf knopf-dunkel">
            {t("schliessen")}
          </button>
        </div>
        {html ? (
          // Bereinigtes HTML aus rechtstexte.ts (wie auf /datenschutz und /agb)
          <div className="rechtstext overflow-y-auto px-6 py-4 text-base" dangerouslySetInnerHTML={{ __html: html }} />
        ) : (
          <p className="px-6 py-4 text-base text-grau">–</p>
        )}
      </div>
    </div>
  );
}
