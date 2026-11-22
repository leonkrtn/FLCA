"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { kvTerminAnfragen } from "@/app/(site)/k/[token]/actions";
import { LEER } from "@/lib/forms";

/** slots: frei; anfragbar: belegt, aber anfragbar (Zusage oder Gegenvorschlag vom Betrieb) */
type Tag = { datum: string; slots: string[]; anfragbar?: string[] };

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

/**
 * Nach dem Annehmen des Kostenvoranschlags gleich einen Termin wählen. Gleiche Bedienung wie die Terminwahl
 * der Website (Tag, dann Uhrzeit; gestrichelt = belegt, aber anfragbar), Kunde und Fahrzeug stehen schon fest.
 */
export function KvTerminWahl({ token }: { token: string }) {
  const [tage, setTage] = useState<Tag[]>([]);
  const [laedt, setLaedt] = useState(true);
  const [ladeFehler, setLadeFehler] = useState("");
  const [datum, setDatum] = useState<string | null>(null);
  const [uhrzeit, setUhrzeit] = useState<string | null>(null);
  const [zustand, aktion, sendet] = useActionState(kvTerminAnfragen.bind(null, token), LEER);
  const anfrage = useRef(0);

  async function laden(von: string, anhaengen: boolean) {
    const nummer = ++anfrage.current;
    setLaedt(true);
    setLadeFehler("");
    try {
      const res = await fetch(`/api/termine/frei?kv=${token}&von=${von}&tage=14`, { cache: "no-store" });
      if (!res.ok) throw new Error();
      const json = (await res.json()) as { tage: Tag[] };
      if (nummer !== anfrage.current) return;
      setTage((alt) => (anhaengen ? [...alt, ...json.tage] : json.tage));
      if (!anhaengen) setDatum((json.tage.find((t) => t.slots.length) ?? json.tage.find((t) => t.anfragbar?.length))?.datum ?? null);
    } catch {
      if (nummer === anfrage.current) setLadeFehler("Die freien Termine konnten nicht geladen werden. Bitte die Seite neu laden oder anrufen.");
    } finally {
      if (nummer === anfrage.current) setLaedt(false);
    }
  }

  useEffect(() => {
    void Promise.resolve().then(() => laden(heute(), false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (zustand.status === "ok") {
    return (
      <div className="grid gap-4" role="status">
        <p className="text-lg font-semibold">{zustand.meldung}</p>
        {typeof zustand.daten?.token === "string" ? (
          <Link href={`/t/${zustand.daten.token}`} className="knopf knopf-dunkel justify-self-start">Anfrage ansehen</Link>
        ) : null}
      </div>
    );
  }

  const tag = tage.find((t) => t.datum === datum);
  const zeiten = tag ? [...tag.slots.map((z) => ({ z, frei: true })), ...(tag.anfragbar ?? []).map((z) => ({ z, frei: false }))].sort((a, b) => a.z.localeCompare(b.z)) : [];

  return (
    <form action={aktion} aria-busy={laedt}>
      <input type="hidden" name="datum" value={datum ?? ""} />
      <input type="hidden" name="uhrzeit" value={uhrzeit ?? ""} />
      {ladeFehler ? <p className="mb-4 text-fehler">{ladeFehler}</p> : null}
      <div className="-mx-4 flex snap-x gap-2 quer-scrollen px-4 pb-3 [scrollbar-width:thin] md:mx-0 md:px-0" role="listbox" aria-label="Tag wählen">
        {tage.map((t) => {
          const frei = t.slots.length;
          const moeglich = frei + (t.anfragbar?.length ?? 0);
          const gewaehlt = t.datum === datum;
          return (
            <button
              key={t.datum}
              type="button"
              role="option"
              aria-selected={gewaehlt}
              disabled={!moeglich}
              onClick={() => {
                setDatum(t.datum);
                setUhrzeit(null);
              }}
              className={`flex w-[4.5rem] shrink-0 snap-start flex-col items-center gap-0.5 rounded-md border py-2.5 transition-colors ${
                gewaehlt ? "border-grau bg-white/[0.08]" : frei ? "border-linie bg-flaeche hover:border-tinte" : moeglich ? "border-dashed border-linie hover:border-tinte" : "border-transparent text-grau-hell"
              }`}
            >
              <span className="text-xs uppercase">{wt.format(alsDatum(t.datum)).replace(".", "")}</span>
              <span className="zahlen font-medium">{tm.format(alsDatum(t.datum))}</span>
              <span className="text-[11px] text-grau">{frei ? `${frei} frei` : moeglich ? "auf Anfrage" : "zu"}</span>
            </button>
          );
        })}
        {laedt ? Array.from({ length: tage.length ? 3 : 7 }, (_, i) => <div key={i} className="skelett h-[4.75rem] w-[4.5rem] shrink-0 rounded-md" aria-hidden />) : null}
        {tage.length && !laedt ? (
          <button
            type="button"
            onClick={() => laden(plusTage(tage.at(-1)!.datum, 1), true)}
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
            {zeiten.map(({ z, frei }) => (
              <button
                key={z}
                type="button"
                role="option"
                aria-selected={z === uhrzeit}
                aria-label={frei ? `${z} Uhr, frei` : `${z} Uhr, belegt, Anfrage möglich`}
                onClick={() => setUhrzeit(z)}
                className={`zahlen min-h-12 rounded-md border transition-colors ${
                  z === uhrzeit ? "border-grau bg-white/[0.08]" : frei ? "border-linie bg-flaeche hover:border-tinte" : "border-dashed border-linie text-grau hover:border-tinte hover:text-tinte"
                }`}
              >
                {z}
              </button>
            ))}
          </div>
          {tag.anfragbar?.length ? (
            <p className="mt-3 text-sm text-grau">Gestrichelte Zeiten sind eigentlich schon belegt. Sie können sie trotzdem anfragen: Wir sagen zu oder schlagen Ihnen eine andere Zeit vor.</p>
          ) : null}
        </div>
      ) : null}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button type="submit" disabled={!uhrzeit || sendet} className={`knopf knopf-rot ${!uhrzeit || sendet ? "opacity-60" : ""}`}>
          {sendet ? "Wird gesendet …" : uhrzeit && datum ? `Termin am ${tm.format(alsDatum(datum))} um ${uhrzeit} Uhr anfragen` : "Termin anfragen"}
        </button>
      </div>
      {zustand.status === "fehler" ? <p className="mt-3 text-fehler">{zustand.meldung}</p> : null}
    </form>
  );
}
