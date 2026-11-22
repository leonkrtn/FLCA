"use client";

import { useState } from "react";

type Auftrag = { tag: string; text: string };
// Ohne Grund (Urlaub, krank): Kollegen sehen nur, dass jemand fehlt.
type Kollege = { name: string; von: string; bis: string; beantragt: boolean };

const tagText = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit", timeZone: "UTC" });

/**
 * Von/Bis für den Antrag mit Hinweisen, solange man noch wählt: eigene Aufträge in dem Zeitraum (gehen bei
 * Genehmigung an Kollegen) und wer aus dem Team dann schon fehlt. Die Daten kommen fertig vom Server, damit
 * nichts nachgeladen werden muss.
 */
export function AntragZeitraum({ auftraege, kollegen, rest, vorgabe }: { auftraege: Auftrag[]; kollegen: Kollege[]; rest: number | null; vorgabe: string }) {
  // Heute vorbelegt: Wer sich krank meldet, muss nichts wählen
  const [von, setVon] = useState(vorgabe);
  const [bis, setBis] = useState("");
  const ende = bis && bis >= von ? bis : von;
  const meine = von ? auftraege.filter((a) => a.tag >= von && a.tag <= ende) : [];
  const fehlen = von ? kollegen.filter((k) => k.von <= ende && k.bis >= von) : [];
  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="label">Von</span>
          <input name="von" type="date" required className="feld" value={von} onChange={(e) => setVon(e.target.value)} />
        </label>
        <label className="block">
          <span className="label">Bis</span>
          <input name="bis" type="date" className="feld" value={bis} min={von || undefined} onChange={(e) => setBis(e.target.value)} />
        </label>
      </div>
      {von ? (
        <div className="grid gap-1 text-sm" role="status">
          {rest !== null ? <p className="text-grau">Resturlaub vor diesem Antrag: {String(rest).replace(".", ",")} Tage</p> : null}
          {meine.length ? (
            <p className="font-semibold text-warnung">
              Du hast in der Zeit {meine.length === 1 ? "einen Auftrag" : `${meine.length} Aufträge`}: {meine.slice(0, 3).map((a) => `${tagText(a.tag)} ${a.text}`).join(", ")}
              {meine.length > 3 ? " …" : ""}. Wird der Urlaub genehmigt, gehen sie an Kollegen.
            </p>
          ) : (
            <p className="text-grau">Keine eigenen Aufträge in der Zeit.</p>
          )}
          {fehlen.length ? (
            <p className="text-warnung">
              Schon nicht da: {fehlen.map((k) => `${k.name} (${tagText(k.von)}${k.bis !== k.von ? `–${tagText(k.bis)}` : ""}${k.beantragt ? ", beantragt" : ""})`).join(", ")}
            </p>
          ) : (
            <p className="text-grau">Aus dem Team ist dann niemand weg.</p>
          )}
        </div>
      ) : null}
    </>
  );
}
