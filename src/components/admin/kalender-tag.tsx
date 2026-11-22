"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { umplanenAktion } from "@/lib/aktionen/termine";
import type { Fenster } from "@/lib/einstellungen";
import { minuten, uhrzeit } from "@/lib/zeit";

export type TagSpalte = {
  /** null = „Ohne Mitarbeiter“ */
  id: string | null;
  name: string;
  farbe: string;
  /** Arbeitszeit der Person an dem Tag; null = keine Person (dann gelten die Öffnungszeiten) */
  fenster: Fenster[] | null;
  hinweis: string;
};

export type TagTermin = {
  id: string;
  beginnMin: number;
  endeMin: number;
  titel: string;
  unter: string;
  art: "angefragt" | "bestaetigt" | "erledigt";
  profil: string | null;
  beweglich: boolean;
  /** Passt nicht (mehr) zur Person, z. B. nach geänderter Arbeitszeit */
  warnung?: string;
};

type Ziel = { spalte: number; min: number };

/**
 * Tagesansicht mit einer Spalte je Mitarbeiter. Termine lassen sich mit der Maus in eine andere Spalte (Person)
 * und an eine andere Uhrzeit ziehen; ein Klick öffnet eine kleine Auswahl (auch für Tastatur und Touch).
 * Gespeichert wird über umplanenAktion: Passt die Person nicht, kommt eine Warnung zum Bestätigen.
 */
export function KalenderTag({
  datum,
  startStunde,
  endStunde,
  stundePx,
  schritt,
  oeffnung,
  spalten,
  termine,
}: {
  datum: string;
  startStunde: number;
  endStunde: number;
  stundePx: number;
  schritt: number;
  oeffnung: Fenster[];
  spalten: TagSpalte[];
  termine: TagTermin[];
}) {
  const router = useRouter();
  const raster = useRef<HTMLDivElement>(null);
  const [ziehen, setZiehen] = useState<{ id: string; dy: number; ziel: Ziel; bewegt: boolean; x0: number; y0: number } | null>(null);
  const [wartend, setWartend] = useState<{ id: string; ziel: Ziel } | null>(null);
  const [auswahl, setAuswahl] = useState<string | null>(null);
  const [meldung, setMeldung] = useState("");
  const [laeuft, starten] = useTransition();
  const hoehe = (endStunde - startStunde) * stundePx;
  const zuPx = (min: number) => ((min - startStunde * 60) / 60) * stundePx;
  const spalteIndex = (profil: string | null) => Math.max(0, spalten.findIndex((s) => s.id === profil));

  /** Spalte und gerundete Uhrzeit unter dem Mauszeiger (obere Kante des Termins). */
  function zielAus(clientX: number, clientY: number, dy: number): Ziel | null {
    const r = raster.current?.getBoundingClientRect();
    if (!r) return null;
    const spalte = Math.min(spalten.length - 1, Math.max(0, Math.floor(((clientX - r.left) / r.width) * spalten.length)));
    const roh = startStunde * 60 + ((clientY - r.top - dy) / stundePx) * 60;
    const min = Math.min(Math.max(Math.round(roh / schritt) * schritt, startStunde * 60), endStunde * 60 - schritt);
    return { spalte, min };
  }

  function speichern(t: TagTermin, ziel: Ziel) {
    const spalte = spalten[ziel.spalte];
    const zeitNeu = ziel.min !== t.beginnMin;
    const personNeu = spalte.id !== t.profil;
    if (!zeitNeu && !personNeu) return;
    if (zeitNeu && t.art === "bestaetigt" && !window.confirm(`Termin auf ${uhrzeit(ziel.min)} Uhr verschieben? Der Kunde bekommt eine Mail mit der neuen Uhrzeit.`)) return;
    setWartend({ id: t.id, ziel });
    setMeldung("");
    starten(async () => {
      const ziel2 = { ...(zeitNeu && { datum, uhrzeit: uhrzeit(ziel.min) }), ...(personNeu && { mitarbeiter: spalte.id }) };
      let e = await umplanenAktion(t.id, ziel2);
      const warnungen = e.daten?.warnungen;
      if (e.status === "fehler" && Array.isArray(warnungen)) {
        if (window.confirm(`${warnungen.join("\n")}\n\nTrotzdem so speichern?`)) e = await umplanenAktion(t.id, ziel2, true);
        else e = { status: "leer" };
      }
      if (e.status === "fehler") setMeldung(e.meldung ?? "Das hat nicht geklappt.");
      setWartend(null);
      router.refresh();
    });
  }

  const gewaehlt = termine.find((t) => t.id === auswahl);

  // Überlappende Termine in derselben Spalte (vor allem „ohne Mitarbeiter“) nebeneinander statt übereinander
  const bahnen = new Map<string, { bahn: number; von: number }>();
  for (let i = 0; i < spalten.length; i++) {
    const enden: number[] = [];
    const inSpalte = termine.filter((t) => spalteIndex(t.profil) === i).sort((a, b) => a.beginnMin - b.beginnMin);
    for (const t of inSpalte) {
      let bahn = enden.findIndex((e) => e <= t.beginnMin);
      if (bahn === -1) bahn = enden.push(0) - 1;
      enden[bahn] = t.endeMin;
      bahnen.set(t.id, { bahn, von: 0 });
    }
    for (const t of inSpalte) bahnen.get(t.id)!.von = enden.length;
  }

  return (
    <div className="relative">
      {meldung ? (
        <p role="alert" className="mb-3 border-l-4 border-rot bg-weiss px-4 py-2 text-sm font-semibold text-rot">
          {meldung}
        </p>
      ) : null}
      <div className="-mx-4 quer-scrollen bg-weiss md:mx-0">
        <div className="grid" style={{ gridTemplateColumns: `3.5rem repeat(${spalten.length}, minmax(9rem, 1fr))`, minWidth: `${3.5 * 16 + spalten.length * 144}px` }}>
          <div />
          {spalten.map((s) => (
            <div key={s.id ?? "ohne"} className="min-w-0 border-b-2 border-tinte px-2 py-2">
              <p className="flex items-center gap-2 truncate text-sm font-semibold">
                <span className="inline-block size-3 shrink-0 rounded-sm" style={{ background: s.farbe }} />
                {s.id ? (
                  <Link href={`/admin/mitarbeiter/${s.id}?datum=${datum}#ausnahmen`} className="truncate hover:underline" title="Arbeitszeit an diesem Tag ändern">
                    {s.name}
                  </Link>
                ) : (
                  <span className="truncate">{s.name}</span>
                )}
              </p>
              <p className="zahlen truncate text-xs text-grau">{s.hinweis || " "}</p>
            </div>
          ))}
          <div className="relative" style={{ height: hoehe }}>
            {Array.from({ length: endStunde - startStunde }, (_, i) => (
              <span key={i} className="zahlen absolute right-2 -translate-y-1/2 text-xs text-grau" style={{ top: i * stundePx }}>
                {String(startStunde + i).padStart(2, "0")}:00
              </span>
            ))}
          </div>
          <div
            ref={raster}
            className="relative grid"
            style={{ gridColumn: `span ${spalten.length}`, gridTemplateColumns: `repeat(${spalten.length}, minmax(0, 1fr))`, height: hoehe }}
            onPointerMove={(e) => {
              if (!ziehen) return;
              const bewegt = ziehen.bewegt || Math.abs(e.clientX - ziehen.x0) + Math.abs(e.clientY - ziehen.y0) > 5;
              const ziel = zielAus(e.clientX, e.clientY, ziehen.dy) ?? ziehen.ziel;
              setZiehen({ ...ziehen, bewegt, ziel });
            }}
            onPointerUp={() => {
              if (!ziehen) return;
              const t = termine.find((x) => x.id === ziehen.id);
              setZiehen(null);
              if (!t) return;
              if (ziehen.bewegt) speichern(t, ziehen.ziel);
              else setAuswahl(t.id);
            }}
            onPointerCancel={() => setZiehen(null)}
          >
            {spalten.map((s, i) => (
              <Spalte key={s.id ?? "ohne"} spalte={s} index={i} datum={datum} oeffnung={oeffnung} startStunde={startStunde} endStunde={endStunde} stundePx={stundePx} schritt={schritt} />
            ))}
            {termine.map((t) => {
              const ziel = ziehen?.id === t.id && ziehen.bewegt ? ziehen.ziel : wartend?.id === t.id ? wartend.ziel : null;
              const spalte = ziel ? ziel.spalte : spalteIndex(t.profil);
              const beginn = ziel ? ziel.min : t.beginnMin;
              const spaltenBreite = 100 / spalten.length;
              const b = ziel ? { bahn: 0, von: 1 } : (bahnen.get(t.id) ?? { bahn: 0, von: 1 });
              const breite = spaltenBreite / b.von;
              const links = spalte * spaltenBreite + b.bahn * breite;
              return (
                <button
                  key={t.id}
                  type="button"
                  className={`absolute z-10 touch-none overflow-hidden rounded-sm border border-l-[6px] border-linie px-1.5 py-1 text-left text-xs leading-tight shadow-sm focus-visible:ring-2 focus-visible:ring-tinte ${
                    t.art === "angefragt" ? "bg-kreide/60" : t.art === "erledigt" ? "bg-boden text-grau" : "text-tinte"
                  } ${t.beweglich ? "cursor-grab" : "cursor-pointer"} ${ziel ? "z-20 opacity-80 shadow-lg ring-2 ring-tinte" : t.warnung ? "ring-2 ring-rot" : ""} ${wartend?.id === t.id && laeuft ? "cursor-progress" : ""}`}
                  style={{
                    top: zuPx(beginn),
                    height: Math.max(((t.endeMin - t.beginnMin) / 60) * stundePx - 2, 22),
                    left: `calc(${links}% + 2px)`,
                    width: `calc(${breite}% - 4px)`,
                    borderLeftColor: spalten[spalte]?.id ? spalten[spalte].farbe : "var(--color-rot)",
                    ...(t.art === "bestaetigt" && { background: spalten[spalte]?.id ? spalten[spalte].farbe : "var(--color-weiss)" }),
                  }}
                  onPointerDown={(e) => {
                    if (!t.beweglich || e.button !== 0) return;
                    const r = e.currentTarget.getBoundingClientRect();
                    raster.current?.setPointerCapture(e.pointerId);
                    setZiehen({ id: t.id, dy: e.clientY - r.top, ziel: { spalte: spalteIndex(t.profil), min: t.beginnMin }, bewegt: false, x0: e.clientX, y0: e.clientY });
                  }}
                  onClick={(e) => {
                    // Maus: das erledigt onPointerUp. Tastatur (Enter/Leertaste) löst nur click aus.
                    if (e.detail === 0 || !t.beweglich) setAuswahl(t.id);
                  }}
                  aria-label={`${uhrzeit(t.beginnMin)} ${t.titel}, ${t.unter}`}
                >
                  <span className="block truncate font-semibold">
                    <span className="zahlen">{uhrzeit(beginn)}</span> {t.titel}
                  </span>
                  {/* Warnung vor allem anderen: Bei kurzen Terminen ist nur Platz für zwei Zeilen */}
                  {t.warnung && !ziel ? (
                    <span className="block truncate font-semibold text-rot" title={t.warnung}>
                      passt nicht: {t.warnung}
                    </span>
                  ) : null}
                  <span className="block truncate opacity-80">{t.unter}</span>
                  {t.art === "angefragt" ? <span className="block text-[0.7rem] font-semibold uppercase tracking-wide">angefragt</span> : null}
                </button>
              );
            })}
          </div>
        </div>
      </div>
      {gewaehlt ? (
        <Auswahl
          termin={gewaehlt}
          datum={datum}
          spalten={spalten}
          laeuft={laeuft}
          schliessen={() => setAuswahl(null)}
          speichern={(spalte, uhr) => {
            setAuswahl(null);
            speichern(gewaehlt, { spalte, min: minuten(uhr) });
          }}
        />
      ) : null}
    </div>
  );
}

/** Eine Personenspalte: Raster, Zeit außerhalb der Arbeitszeit schraffiert, freie Stellen klickbar (neuer Termin). */
function Spalte({ spalte, index, datum, oeffnung, startStunde, endStunde, stundePx, schritt }: { spalte: TagSpalte; index: number; datum: string; oeffnung: Fenster[]; startStunde: number; endStunde: number; stundePx: number; schritt: number }) {
  const fenster = spalte.fenster ?? oeffnung;
  const grenzen = [startStunde * 60, ...[...fenster].sort((a, b) => minuten(a[0]) - minuten(b[0])).flatMap(([a, b]) => [minuten(a), minuten(b)]), endStunde * 60];
  const zu: [number, number][] = [];
  for (let i = 0; i < grenzen.length; i += 2) if (grenzen[i + 1] > grenzen[i]) zu.push([grenzen[i], grenzen[i + 1]]);
  const zuPx = (min: number) => ((min - startStunde * 60) / 60) * stundePx;
  return (
    <div className={`relative ${index ? "border-l border-linie" : ""}`}>
      {Array.from({ length: endStunde - startStunde }, (_, i) => (
        <div key={i} className="absolute inset-x-0 border-t border-linie/60" style={{ top: i * stundePx }} />
      ))}
      {zu.map(([a, b]) => (
        <div key={a} className="absolute inset-x-0 bg-[repeating-linear-gradient(135deg,transparent_0_6px,rgb(0_0_0/0.07)_6px_12px)]" style={{ top: zuPx(a), height: zuPx(b) - zuPx(a) }} />
      ))}
      {Array.from({ length: ((endStunde - startStunde) * 60) / schritt }, (_, i) => {
        const uhr = uhrzeit(startStunde * 60 + i * schritt);
        return (
          <Link
            key={uhr}
            href={`/admin/termine/neu?datum=${datum}&uhrzeit=${uhr}&kal=tag:${datum}${spalte.id ? `&an=${spalte.id}` : ""}`}
            prefetch={false}
            tabIndex={-1}
            aria-label={`Neuer Termin ${uhr} Uhr${spalte.id ? ` für ${spalte.name}` : ""}`}
            className="group absolute inset-x-0 overflow-hidden px-1.5 pt-0.5 hover:bg-boden/70"
            style={{ top: ((i * schritt) / 60) * stundePx, height: (schritt / 60) * stundePx }}
          >
            <span className="zahlen hidden text-xs leading-none text-grau group-hover:block">+ {uhr}</span>
          </Link>
        );
      })}
    </div>
  );
}

/** Kleine Auswahl zu einem Termin: Mitarbeiter und Uhrzeit ändern oder den Termin öffnen. */
function Auswahl({ termin, datum, spalten, laeuft, schliessen, speichern }: { termin: TagTermin; datum: string; spalten: TagSpalte[]; laeuft: boolean; schliessen: () => void; speichern: (spalte: number, uhr: string) => void }) {
  const [spalte, setSpalte] = useState(Math.max(0, spalten.findIndex((s) => s.id === termin.profil)));
  const [uhr, setUhr] = useState(uhrzeit(termin.beginnMin));
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-tinte/30 p-4" onClick={schliessen} onKeyDown={(e) => e.key === "Escape" && schliessen()} role="presentation">
      <div role="dialog" aria-modal="true" aria-labelledby="termin-auswahl" className="w-full max-w-sm rounded-lg bg-weiss p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <p id="termin-auswahl" className="font-semibold">{termin.titel}</p>
        <p className="mb-4 text-sm text-grau">{termin.unter}</p>
        {termin.beweglich ? (
          <div className="grid gap-3">
            <label className="block">
              <span className="label">Mitarbeiter</span>
              <select value={spalte} onChange={(e) => setSpalte(Number(e.target.value))} className="feld">
                {spalten.map((s, i) => (
                  <option key={s.id ?? "ohne"} value={i}>
                    {s.id ? `${s.name} (${s.hinweis})` : "niemand"}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="label">Uhrzeit</span>
              <input type="time" value={uhr} onChange={(e) => setUhr(e.target.value)} className="feld tabular-nums" />
            </label>
          </div>
        ) : (
          <p className="text-sm">Erledigte Termine bleiben, wie sie sind.</p>
        )}
        <div className="mt-5 flex flex-wrap gap-2">
          {termin.beweglich ? (
            <button type="button" disabled={laeuft || !/^\d{2}:\d{2}$/.test(uhr)} className="knopf knopf-dunkel knopf-klein" onClick={() => speichern(spalte, uhr)}>
              Speichern
            </button>
          ) : null}
          <Link href={`/admin/termine/${termin.id}?kal=tag:${datum}`} className="knopf knopf-rahmen knopf-klein">Termin öffnen</Link>
          <button type="button" className="knopf knopf-rahmen knopf-klein" onClick={schliessen}>Abbrechen</button>
        </div>
      </div>
    </div>
  );
}
