"use client";

import Link from "next/link";
import { useMemo, useOptimistic, useRef, useState, useTransition } from "react";
import { Download, Kreuz } from "@/components/icons";
import { Marke } from "@/components/admin/ui";
import { sammelAktion } from "@/lib/aktionen/rechnungen";
import { euro } from "@/lib/format";

export type Zeile = {
  id: string;
  nummer: string | null;
  datum: string;
  empfaenger: string;
  kennzeichen: string;
  status: "entwurf" | "gestellt" | "bezahlt" | "storniert";
  statusText: string;
  ton: "ok" | "rot" | "warnung" | "hell";
  betrag: number;
  email: boolean;
};

type Art = Parameters<typeof sammelAktion>[0];

/**
 * Rechnungsliste mit Mehrfachauswahl. Häkchen links, Umschalt+Klick wählt einen Bereich. Sobald etwas
 * ausgewählt ist, erscheint unten eine Leiste mit dem, was für die Auswahl geht: PDFs als ZIP,
 * als bezahlt markieren, per Mail senden, Entwürfe löschen. Der neue Status steht sofort in der
 * Liste (optimistisch), der Server zieht nach; schlägt etwas fehl, steht wieder der alte da.
 */
export function RechnungsAuswahl({ zeilen, summe }: { zeilen: Zeile[]; summe: number }) {
  const [gewaehlt, setGewaehlt] = useState<Set<string>>(new Set());
  const [meldung, setMeldung] = useState<{ ok: boolean; text: string } | null>(null);
  const [laeuft, starten] = useTransition();
  const letzter = useRef<number | null>(null);
  const [liste, vorab] = useOptimistic(zeilen, (alt: Zeile[], { ids, art }: { ids: Set<string>; art: Art }) =>
    art === "entwuerfe_loeschen"
      ? alt.filter((z) => !(ids.has(z.id) && z.status === "entwurf"))
      : art === "senden"
        ? alt
        : alt.map((z) => (ids.has(z.id) && z.status === "gestellt" ? { ...z, status: "bezahlt" as const, statusText: "Bezahlt", ton: "ok" as const } : z)),
  );

  // Ausgewählt zählt nur, was noch in der Liste steht (nach Filterwechsel oder Löschen).
  const auswahl = useMemo(() => liste.filter((z) => gewaehlt.has(z.id)), [liste, gewaehlt]);
  const anzahl = {
    offen: auswahl.filter((z) => z.status === "gestellt").length,
    senden: auswahl.filter((z) => z.status !== "entwurf" && z.email).length,
    entwuerfe: auswahl.filter((z) => z.status === "entwurf").length,
  };
  const alle = liste.length > 0 && auswahl.length === liste.length;
  const teilweise = auswahl.length > 0 && !alle;

  function umschalten(i: number, shift: boolean) {
    const id = liste[i].id;
    // Vorher festhalten: Die Funktion in setGewaehlt läuft erst später, dann steht hier schon der neue Wert.
    const anker = letzter.current;
    setMeldung(null);
    setGewaehlt((alt) => {
      const neu = new Set(alt);
      const an = !alt.has(id);
      if (shift && anker !== null) {
        const [von, bis] = [Math.min(anker, i), Math.max(anker, i)];
        for (const z of liste.slice(von, bis + 1)) {
          if (an) neu.add(z.id);
          else neu.delete(z.id);
        }
      } else if (an) neu.add(id);
      else neu.delete(id);
      return neu;
    });
    letzter.current = i;
  }

  function ausfuehren(art: Art, frage?: string) {
    if (frage && !window.confirm(frage)) return;
    const ids = new Set(auswahl.map((z) => z.id));
    starten(async () => {
      vorab({ ids, art });
      const e = await sammelAktion(art, [...ids]);
      setMeldung({ ok: e.status === "ok", text: e.meldung ?? "" });
      if (e.status === "ok") setGewaehlt(new Set());
    });
  }

  const zipHref = `/admin/rechnungen/auswahl?ids=${auswahl.map((z) => z.id).join(",")}`;

  return (
    <>
      <div className="bg-weiss p-4 md:p-6">
        <div className="-mx-4 overflow-x-auto md:mx-0">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead>
              <tr className="border-b-2 border-tinte text-left">
                <th className="w-10 py-2 pl-4 md:pl-0">
                  <input
                    type="checkbox"
                    aria-label="Alle auswählen"
                    checked={alle}
                    ref={(el) => {
                      if (el) el.indeterminate = teilweise;
                    }}
                    onChange={() => {
                      setMeldung(null);
                      setGewaehlt(alle ? new Set() : new Set(liste.map((z) => z.id)));
                    }}
                    className="block size-[18px] cursor-pointer accent-tinte"
                  />
                </th>
                {["Nummer", "Datum", "Empfänger", "Kennzeichen", "Status"].map((k) => (
                  <th key={k} className="px-3 py-2 font-semibold">
                    {k}
                  </th>
                ))}
                <th className="py-2 pl-3 pr-4 text-right font-semibold md:pr-0">Betrag</th>
              </tr>
            </thead>
            <tbody className="[&_td]:border-b [&_td]:border-linie [&_td]:px-3 [&_td]:py-2.5">
              {liste.map((z, i) => {
                const an = gewaehlt.has(z.id);
                return (
                  <tr key={z.id} className={an ? "bg-papier" : "hover:bg-papier"}>
                    <td className="pl-4! pr-0! md:pl-0!">
                      <input
                        type="checkbox"
                        checked={an}
                        aria-label={`${z.nummer ?? "Entwurf"} auswählen`}
                        onChange={() => {}}
                        onClick={(ev) => umschalten(i, ev.shiftKey)}
                        className="block size-[18px] cursor-pointer accent-tinte"
                      />
                    </td>
                    <td className="font-semibold tabular-nums">
                      <Link href={`/admin/rechnungen/${z.id}`} className="hover:underline">
                        {z.nummer ?? "Entwurf"}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap tabular-nums">{z.datum}</td>
                    <td className="max-w-[16rem] truncate">{z.empfaenger}</td>
                    <td className="tabular-nums">{z.kennzeichen}</td>
                    <td>
                      <Marke ton={z.ton}>{z.statusText}</Marke>
                    </td>
                    <td className="pr-4! text-right tabular-nums md:pr-0!">{euro(z.betrag)}</td>
                  </tr>
                );
              })}
              <tr>
                <td colSpan={6} className="text-right font-semibold">
                  Summe (ohne Entwürfe)
                </td>
                <td className="pr-4! text-right font-semibold tabular-nums md:pr-0!">{euro(summe)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {meldung && !auswahl.length ? (
        <p role="status" className={`mt-4 text-sm font-semibold ${meldung.ok ? "text-ok" : "text-rot"}`}>
          {meldung.text}
        </p>
      ) : null}

      {/* Leiste für die Auswahl: klebt unten im Inhaltsbereich, solange etwas ausgewählt ist. */}
      {auswahl.length ? (
        <div className="sticky bottom-4 z-20 mt-4 flex flex-wrap items-center gap-2 bg-graphit p-3 text-boden shadow-lg md:gap-3 md:px-4" role="region" aria-label="Auswahl bearbeiten">
          <p className="mr-auto flex min-h-9 items-center gap-2 text-sm">
            <span className="font-semibold tabular-nums">{auswahl.length} ausgewählt</span>
            <span className="tabular-nums text-boden/60">{euro(auswahl.filter((z) => z.status !== "entwurf").reduce((s, z) => s + z.betrag, 0))}</span>
          </p>
          <a href={zipHref} className="knopf knopf-klein bg-boden text-tinte hover:opacity-90" download>
            <Download className="size-4" /> PDFs als ZIP
          </a>
          <Knopf aus={!anzahl.offen || laeuft} onClick={() => ausfuehren("bezahlt_ueberweisung")} text={`Überweisung da${anzahl.offen ? ` (${anzahl.offen})` : ""}`} />
          <Knopf aus={!anzahl.offen || laeuft} onClick={() => ausfuehren("bezahlt_bar")} text="Bar bezahlt" />
          <Knopf
            aus={!anzahl.senden || laeuft}
            onClick={() => ausfuehren("senden", `${anzahl.senden} ${anzahl.senden === 1 ? "Rechnung" : "Rechnungen"} per E-Mail an die Kunden senden?`)}
            text={`Per E-Mail senden${anzahl.senden ? ` (${anzahl.senden})` : ""}`}
          />
          {anzahl.entwuerfe ? (
            <Knopf
              aus={laeuft}
              onClick={() => ausfuehren("entwuerfe_loeschen", `${anzahl.entwuerfe} ${anzahl.entwuerfe === 1 ? "Entwurf" : "Entwürfe"} endgültig löschen?`)}
              text={`Entwürfe löschen (${anzahl.entwuerfe})`}
            />
          ) : null}
          <button
            type="button"
            onClick={() => setGewaehlt(new Set())}
            className="flex size-9 items-center justify-center rounded-sm text-boden/70 hover:bg-white/10 hover:text-boden"
            aria-label="Auswahl aufheben"
          >
            <Kreuz className="size-4" />
          </button>
          {laeuft ? (
            <p role="status" className="w-full text-sm text-boden/70">
              Wird erledigt …
            </p>
          ) : meldung ? (
            <p role="status" className={`w-full text-sm font-semibold ${meldung.ok ? "text-boden" : "text-kreide"}`}>
              {meldung.text}
            </p>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

function Knopf({ text, onClick, aus }: { text: string; onClick: () => void; aus: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={aus} className="knopf knopf-klein border border-white/25 text-boden hover:bg-white/10">
      {text}
    </button>
  );
}
