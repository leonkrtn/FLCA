"use client";

import Link from "next/link";
import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { anfrageSenden } from "@/app/(site)/termin/actions";
import { Haken } from "@/components/icons";
import { FALLE, LEER } from "@/lib/forms";

type LeistungKurz = {
  id: string;
  slug: string;
  name: string;
  kurz: string;
  preis_cent: number | null;
  preis_ab: boolean;
  dauer_min: number;
  kategorie: string;
};
type Tag = { datum: string; slots: string[] };

const KATEGORIEN: Record<string, string> = { reifen: "Reifen", service: "Service und Reparatur", aufbereitung: "Aufbereitung", schutz: "Rostschutz" };

const preisText = (cent: number | null, ab: boolean) =>
  cent === null ? "auf Anfrage" : `${ab ? "ab " : ""}${new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 }).format(cent / 100)} €`;

const dauerText = (min: number) => (min >= 420 ? "ganzer Tag" : min >= 60 ? `ca. ${String(Math.round((min / 60) * 2) / 2).replace(".", ",")} Std.` : `ca. ${min} Min.`);

const heute = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin" }).format(new Date());
const plusTage = (d: string, n: number) => {
  const x = new Date(`${d}T12:00:00Z`);
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
};
const wt = new Intl.DateTimeFormat("de-DE", { weekday: "short", timeZone: "UTC" });
const tm = new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", timeZone: "UTC" });
const lang = new Intl.DateTimeFormat("de-DE", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
const alsDatum = (d: string) => new Date(`${d}T12:00:00Z`);

function Schritt({ nummer, titel, aktiv, children, id }: { nummer: number; titel: string; aktiv: boolean; children: React.ReactNode; id: string }) {
  return (
    <section id={id} aria-labelledby={`${id}-titel`} className={`scroll-mt-20 border-t-2 pt-5 transition-colors ${aktiv ? "border-grau-hell" : "border-linie"}`}>
      <h2 id={`${id}-titel`} className="mb-5 flex items-baseline gap-3">
        <span className="zahlen text-sm text-grau">0{nummer}</span>
        <span className={`schmal text-2xl ${aktiv ? "" : "text-grau"}`}>{titel}</span>
      </h2>
      {children}
    </section>
  );
}

export function Buchung({ leistungen, vorauswahl, telefon }: { leistungen: LeistungKurz[]; vorauswahl: string | null; telefon: string }) {
  const [leistungId, setLeistungId] = useState<string | null>(vorauswahl);
  // Mit Vorauswahl (Link von der Startseite) ist die Liste zugeklappt, damit es am Telefon direkt mit dem Tag weitergeht.
  const [listeOffen, setListeOffen] = useState(!vorauswahl);
  const [tage, setTage] = useState<Tag[]>([]);
  const [laedt, setLaedt] = useState(false);
  const [ladeFehler, setLadeFehler] = useState("");
  const [datum, setDatum] = useState<string | null>(null);
  const [uhrzeit, setUhrzeit] = useState<string | null>(null);
  const [zustand, aktion, sendet] = useActionState(anfrageSenden, LEER);
  const start = useRef(0);
  const leistung = leistungen.find((l) => l.id === leistungId) ?? null;

  useEffect(() => {
    start.current = Date.now();
  }, []);

  async function laden(id: string, von: string, anhaengen: boolean) {
    setLaedt(true);
    setLadeFehler("");
    try {
      const res = await fetch(`/api/termine/frei?leistung=${id}&von=${von}&tage=14`, { cache: "no-store" });
      if (!res.ok) throw new Error();
      const json = (await res.json()) as { tage: Tag[] };
      setTage((alt) => (anhaengen ? [...alt, ...json.tage] : json.tage));
      if (!anhaengen) {
        const erster = json.tage.find((t) => t.slots.length);
        setDatum(erster?.datum ?? null);
      }
    } catch {
      setLadeFehler("Die freien Termine konnten nicht geladen werden. Bitte die Seite neu laden oder anrufen.");
    } finally {
      setLaedt(false);
    }
  }

  function waehlen(id: string) {
    setLeistungId(id);
    setListeOffen(false);
    setTage([]);
    setDatum(null);
    setUhrzeit(null);
    void laden(id, heute(), false);
  }

  // Vorauswahl aus dem Link (/termin?leistung=radwechsel): Zeiten nach dem ersten Rendern laden.
  useEffect(() => {
    if (vorauswahl) void Promise.resolve().then(() => laden(vorauswahl, heute(), false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const gruppen = useMemo(
    () =>
      Object.entries(KATEGORIEN)
        .map(([k, name]) => ({ name, eintraege: leistungen.filter((l) => l.kategorie === k) }))
        .filter((g) => g.eintraege.length),
    [leistungen],
  );
  const tag = tage.find((t) => t.datum === datum);

  if (zustand.status === "ok" && zustand.daten && !zustand.daten.spam) {
    const d = zustand.daten as { token: string; leistung: string; wann: string; email: string };
    return (
      <div className="max-w-xl" role="status">
        <div className="mb-6 flex size-14 items-center justify-center rounded-full bg-white/10 text-tinte ring-1 ring-linie">
          <Haken className="size-7" />
        </div>
        <h2 className="schmal mb-3 text-3xl">Anfrage ist da.</h2>
        <p className="mb-6 text-lg">
          {d.leistung} am {d.wann}. Wir halten den Termin für Sie frei und bestätigen ihn per E-Mail an <span className="font-semibold">{d.email}</span>.
        </p>
        <p className="mb-8 text-grau">Keine Mail bekommen? Schauen Sie im Spam-Ordner nach oder rufen Sie uns an: {telefon}.</p>
        <Link href={`/t/${d.token}`} className="knopf knopf-dunkel">
          Anfrage ansehen
        </Link>
      </div>
    );
  }

  const fehler = zustand.fehler ?? {};
  const wert = (n: string) => zustand.werte?.[n] ?? "";

  return (
    <div className="grid gap-10 lg:grid-cols-12">
      <div className="space-y-12 lg:col-span-8">
        <Schritt nummer={1} titel="Leistung" aktiv={!leistung} id="schritt-leistung">
          {leistung && !listeOffen ? (
            <div className="flex min-h-16 items-center justify-between gap-4 rounded-md bg-flaeche px-4 py-3 ring-1 ring-tinte/40">
              <span>
                <span className="font-semibold">{leistung.name}</span>
                <span className="block text-sm text-grau">
                  {dauerText(leistung.dauer_min)} · <span className="zahlen">{preisText(leistung.preis_cent, leistung.preis_ab)}</span>
                </span>
              </span>
              <button type="button" onClick={() => setListeOffen(true)} className="knopf knopf-rahmen knopf-klein">
                ändern
              </button>
            </div>
          ) : (
          <div className="grid gap-8 md:grid-cols-2">
            {gruppen.map((g) => (
              <fieldset key={g.name}>
                <legend className="mb-2 text-sm font-semibold text-grau">{g.name}</legend>
                <div className="grid gap-2">
                  {g.eintraege.map((l) => {
                    const gewaehlt = l.id === leistungId;
                    return (
                      <label
                        key={l.id}
                        className={`flex min-h-16 cursor-pointer items-center justify-between gap-4 rounded-md px-4 py-3 ring-1 transition-colors ${
                          gewaehlt ? "bg-white/[0.08] ring-grau" : "bg-flaeche ring-linie hover:ring-grau-hell"
                        }`}
                      >
                        <input
                          type="radio"
                          name="leistung-wahl"
                          value={l.id}
                          checked={gewaehlt}
                          onChange={() => {
                            waehlen(l.id);
                            requestAnimationFrame(() => document.getElementById("schritt-termin")?.scrollIntoView({ behavior: "smooth", block: "start" }));
                          }}
                          className="sr-only"
                        />
                        <span>
                          <span className="font-semibold">{l.name}</span>
                          <span className={`block text-sm ${gewaehlt ? "opacity-70" : "text-grau"}`}>{dauerText(l.dauer_min)}</span>
                        </span>
                        <span className={`zahlen text-right ${l.preis_cent === null ? `text-sm ${gewaehlt ? "opacity-70" : "text-grau"}` : "font-semibold"}`}>{preisText(l.preis_cent, l.preis_ab)}</span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            ))}
          </div>
          )}
        </Schritt>

        <Schritt nummer={2} titel="Tag und Uhrzeit" aktiv={Boolean(leistung) && !uhrzeit} id="schritt-termin">
          {!leistung ? (
            <p className="text-grau">Wählen Sie zuerst eine Leistung, dann zeigen wir die freien Zeiten.</p>
          ) : (
            <div aria-busy={laedt}>
              {ladeFehler ? <p className="mb-4 text-fehler">{ladeFehler}</p> : null}
              <div className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-3 [scrollbar-width:thin] md:mx-0 md:px-0" role="listbox" aria-label="Tag wählen">
                {tage.map((t) => {
                  const frei = t.slots.length;
                  const gewaehlt = t.datum === datum;
                  return (
                    <button
                      key={t.datum}
                      type="button"
                      role="option"
                      aria-selected={gewaehlt}
                      disabled={!frei}
                      onClick={() => {
                        setDatum(t.datum);
                        setUhrzeit(null);
                      }}
                      className={`flex w-[4.5rem] shrink-0 snap-start flex-col items-center gap-0.5 rounded-md border py-2.5 transition-colors ${
                        gewaehlt ? "border-grau bg-white/[0.08]" : frei ? "border-linie bg-flaeche hover:border-tinte" : "border-transparent text-grau-hell"
                      }`}
                    >
                      <span className="text-xs uppercase">{wt.format(alsDatum(t.datum)).replace(".", "")}</span>
                      <span className="zahlen font-medium">{tm.format(alsDatum(t.datum))}</span>
                      <span className={`text-[11px] ${"text-grau"}`}>{frei ? `${frei} frei` : "voll"}</span>
                    </button>
                  );
                })}
                {/* Beim Laden stehen Platzhalter in Größe der Tageskacheln da, damit nichts springt. */}
                {laedt
                  ? Array.from({ length: tage.length ? 3 : 7 }, (_, i) => <div key={i} className="skelett h-[4.75rem] w-[4.5rem] shrink-0 rounded-md" aria-hidden />)
                  : null}
                {tage.length && !laedt ? (
                  <button
                    type="button"
                    onClick={() => leistung && laden(leistung.id, plusTage(tage.at(-1)!.datum, 1), true)}
                    disabled={laedt}
                    className="w-[4.5rem] shrink-0 rounded-md border border-dashed border-linie text-sm text-grau hover:border-tinte hover:text-tinte"
                  >
                    weitere Tage
                  </button>
                ) : null}
              </div>

              {tag ? (
                <div className="mt-6">
                  <p className="mb-3 font-semibold">{lang.format(alsDatum(tag.datum))}</p>
                  <div className="grid grid-cols-4 gap-2 sm:grid-cols-6" role="listbox" aria-label="Uhrzeit wählen">
                    {tag.slots.map((s) => (
                      <button
                        key={s}
                        type="button"
                        role="option"
                        aria-selected={s === uhrzeit}
                        onClick={() => {
                          setUhrzeit(s);
                          requestAnimationFrame(() => document.getElementById("schritt-daten")?.scrollIntoView({ behavior: "smooth", block: "start" }));
                        }}
                        className={`zahlen min-h-12 rounded-md border transition-colors ${
                          s === uhrzeit ? "border-grau bg-white/[0.08]" : "border-linie bg-flaeche hover:border-tinte"
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              ) : laedt && !tage.length ? (
                <div className="mt-6" aria-hidden>
                  <div className="skelett mb-3 h-5 w-48" />
                  <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                    {Array.from({ length: 8 }, (_, i) => (
                      <div key={i} className="skelett min-h-12 rounded-md" />
                    ))}
                  </div>
                </div>
              ) : !laedt && !tage.length && !ladeFehler ? (
                <p className="text-grau">
                  Gerade können wir keine freien Zeiten anzeigen. Rufen Sie uns an: {telefon}
                </p>
              ) : !laedt && tage.length ? (
                <p className="mt-4 text-grau">
                  In diesem Zeitraum ist nichts mehr frei. Tippen Sie auf „weitere Tage“ oder rufen Sie an: {telefon}
                </p>
              ) : null}
              {fehler.zeit ? (
                <p className="mt-4 font-semibold text-fehler">
                  {fehler.zeit}{" "}
                  <button type="button" onClick={() => leistung && waehlen(leistung.id)} className="underline">
                    Freie Zeiten neu laden
                  </button>
                </p>
              ) : null}
            </div>
          )}
        </Schritt>

        <Schritt nummer={3} titel="Ihre Angaben" aktiv={Boolean(uhrzeit)} id="schritt-daten">
          <form
            action={(formData) => {
              formData.set("t", String(Math.round((Date.now() - start.current) / 1000)));
              aktion(formData);
            }}
            key={zustand.versuch}
            className="grid gap-5 sm:grid-cols-2"
            noValidate
          >
            <input type="hidden" name="leistung" value={leistung?.id ?? ""} />
            <input type="hidden" name="datum" value={datum ?? ""} />
            <input type="hidden" name="uhrzeit" value={uhrzeit ?? ""} />
            <div className="absolute -left-[9999px]" aria-hidden>
              <label>
                Bitte leer lassen <input type="text" name={FALLE} tabIndex={-1} autoComplete="off" />
              </label>
            </div>
            {(
              [
                ["name", "Name", "text", "name", ""],
                ["telefon", "Telefon", "tel", "tel", ""],
                ["email", "E-Mail", "email", "email", "Dorthin schicken wir die Bestätigung."],
                ["kennzeichen", "Kennzeichen", "text", "off", "z. B. OF-AB 123"],
              ] as const
            ).map(([name, label, typ, auto, hilfe]) => (
              <div key={name}>
                <label htmlFor={name} className="label">
                  {label}
                </label>
                <input
                  id={name}
                  name={name}
                  type={typ}
                  autoComplete={auto}
                  defaultValue={wert(name)}
                  required
                  aria-invalid={fehler[name] ? true : undefined}
                  aria-describedby={`${name}-hinweis`}
                  className={`feld ${name === "kennzeichen" ? "uppercase" : ""}`}
                  autoCapitalize={name === "kennzeichen" ? "characters" : undefined}
                  inputMode={typ === "tel" ? "tel" : typ === "email" ? "email" : undefined}
                />
                <p id={`${name}-hinweis`} className={`mt-1 text-sm ${fehler[name] ? "text-fehler" : "text-grau"}`}>
                  {fehler[name] ?? hilfe}
                </p>
              </div>
            ))}
            <div className="sm:col-span-2">
              <label htmlFor="fahrzeug" className="label">
                Fahrzeug <span className="font-normal text-grau">(optional)</span>
              </label>
              <input id="fahrzeug" name="fahrzeug" defaultValue={wert("fahrzeug")} placeholder="z. B. VW Golf 7, Diesel" className="feld" />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="notiz" className="label">
                Was sollen wir wissen? <span className="font-normal text-grau">(optional)</span>
              </label>
              <textarea id="notiz" name="notiz" defaultValue={wert("notiz")} rows={3} className="feld" placeholder="z. B. Räder sind bei Ihnen eingelagert, Geräusch beim Bremsen …" />
            </div>
            {zustand.status === "fehler" && zustand.meldung && !fehler.zeit ? <p className="font-semibold text-fehler sm:col-span-2">{zustand.meldung}</p> : null}
            <div className="sm:col-span-2">
              <button type="submit" disabled={!uhrzeit || sendet} className="knopf knopf-rot w-full sm:w-auto sm:min-w-64">
                {sendet ? "Wird gesendet …" : uhrzeit ? "Termin anfragen" : "Bitte zuerst eine Uhrzeit wählen"}
              </button>
              <p className="mt-3 max-w-xl text-sm text-grau">
                Wir verwenden Ihre Angaben nur für diesen Termin und die zugehörige Rechnung. Mehr dazu in der{" "}
                <Link href="/datenschutz" className="underline">
                  Datenschutzerklärung
                </Link>
                .
              </p>
            </div>
          </form>
        </Schritt>
      </div>

      <aside className="hidden lg:col-span-4 lg:block">
        <div className="sticky top-24 rounded-lg bg-flaeche p-6 ring-1 ring-linie">
          <p className="mb-4 text-sm font-semibold uppercase tracking-[0.12em] text-grau">Ihre Anfrage</p>
          <dl className="space-y-4">
            <div>
              <dt className="text-sm text-grau">Leistung</dt>
              <dd className="font-semibold">{leistung?.name ?? "–"}</dd>
            </div>
            <div>
              <dt className="text-sm text-grau">Preis</dt>
              <dd className="zahlen">{leistung ? preisText(leistung.preis_cent, leistung.preis_ab) : "–"}</dd>
            </div>
            <div>
              <dt className="text-sm text-grau">Termin</dt>
              <dd className="zahlen">{datum && uhrzeit ? `${tm.format(alsDatum(datum))} · ${uhrzeit} Uhr` : "–"}</dd>
            </div>
          </dl>
        </div>
      </aside>

      {/* Telefon: Zusammenfassung über der festen Leiste, sobald eine Zeit gewählt ist */}
      {leistung && uhrzeit ? (
        <div className="fixed inset-x-0 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-30 border-t border-linie bg-flaeche px-4 py-2 text-sm md:hidden">
          <span className="font-semibold">{leistung.name}</span>
          <span className="zahlen ml-2 text-grau">
            {tm.format(alsDatum(datum!))} · {uhrzeit}
          </span>
        </div>
      ) : null}
    </div>
  );
}
