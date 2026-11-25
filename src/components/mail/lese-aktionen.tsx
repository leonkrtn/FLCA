"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { mailOrdnen } from "@/lib/aktionen/mail";
import type { Aktion, Ansicht } from "@/lib/mail/postfach";
import type { Kategorie, PersonKurz } from "./liste";
import { useSchreiben } from "./schreiben";

/**
 * Leiste über einer geöffneten Mail: Antworten, Weiterleiten, Drucken, Kennzeichnen, Anheften, Kategorie,
 * Zuweisen, Erinnern, Archivieren, Löschen, Ungelesen. Was die Mail aus dem Ordner nimmt (Archivieren, Löschen),
 * führt zurück zur Liste.
 */
export function LeseAktionen({
  ziel,
  ordner,
  antwortAuf,
  weiterleiten,
  druckHref,
  zurueck,
  stand,
  kategorien,
  personen,
  zuweisbar,
}: {
  ziel: { gespraeche?: string[]; mails?: string[] };
  ordner: Ansicht;
  antwortAuf: string;
  weiterleiten: string;
  druckHref: string;
  zurueck: string;
  stand: { gekennzeichnet: boolean; angeheftet: boolean; kategorien: string[]; zugewiesen_an: string | null; imPapierkorb: boolean; archiviert: boolean; eingang: boolean };
  kategorien: Kategorie[];
  personen: PersonKurz[];
  zuweisbar: boolean;
}) {
  const router = useRouter();
  const oeffnen = useSchreiben();
  const [laeuft, starten] = useTransition();
  const [meldung, setMeldung] = useState("");
  const [erinnernOffen, setErinnernOffen] = useState(false);

  function tun(a: Aktion, danachZurueck = false) {
    setMeldung("");
    starten(async () => {
      const r = await mailOrdnen(ziel, a, ordner);
      if (!r.ok) return setMeldung(r.meldung);
      if (danachZurueck) router.push(zurueck, { scroll: false });
      else router.refresh();
    });
  }

  function erinnern(am: Date) {
    setErinnernOffen(false);
    tun({ art: "erinnern", am: am.toISOString() }, true);
  }

  const k = "min-h-9 rounded-sm px-2.5 text-sm font-semibold hover:bg-boden";
  const morgen8 = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(8, 0, 0, 0);
    return d;
  };
  const montag8 = () => {
    const d = new Date();
    d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7));
    d.setHours(8, 0, 0, 0);
    return d;
  };

  return (
    <div className={`relative flex flex-wrap items-center gap-0.5 ${laeuft ? "opacity-70" : ""}`}>
      <button type="button" className={`${k} bg-tinte text-weiss hover:bg-tinte/90`} onClick={() => oeffnen("antwort", antwortAuf)}>Antworten</button>
      <button type="button" className={k} onClick={() => oeffnen("weiter", weiterleiten)}>Weiterleiten</button>
      {stand.imPapierkorb ? (
        <>
          <button type="button" className={k} onClick={() => tun({ art: "wiederherstellen" }, true)}>Wiederherstellen</button>
          <button type="button" className={k} onClick={() => window.confirm("Endgültig löschen?") && tun({ art: "loeschen" }, true)}>Endgültig löschen</button>
        </>
      ) : (
        <>
          {stand.eingang ? (
            stand.archiviert ? (
              <button type="button" className={k} onClick={() => tun({ art: "verschieben", ordner: "eingang" }, true)}>In Posteingang</button>
            ) : (
              <button type="button" className={k} onClick={() => tun({ art: "verschieben", ordner: "archiv" }, true)}>Archivieren</button>
            )
          ) : null}
          <button type="button" className={k} onClick={() => tun({ art: "loeschen" }, true)}>Löschen</button>
        </>
      )}
      <button type="button" className={`${k} ${stand.gekennzeichnet ? "text-rot" : ""}`} onClick={() => tun({ art: stand.gekennzeichnet ? "entkennzeichnen" : "kennzeichnen" })}>
        {stand.gekennzeichnet ? "Gekennzeichnet" : "Kennzeichnen"}
      </button>
      <button type="button" className={k} onClick={() => tun({ art: stand.angeheftet ? "loesen" : "anheften" })}>{stand.angeheftet ? "Lösen" : "Anheften"}</button>
      {kategorien.length ? (
        <select
          aria-label="Kategorie"
          className="min-h-9 rounded-sm bg-transparent px-1 text-sm font-semibold"
          value=""
          onChange={(e) => {
            const id = e.target.value;
            if (id) tun({ art: "kategorie", id, an: !stand.kategorien.includes(id) });
          }}
        >
          <option value="" disabled>Kategorie</option>
          {kategorien.map((x) => (
            <option key={x.id} value={x.id}>{stand.kategorien.includes(x.id) ? `✓ ${x.name}` : x.name}</option>
          ))}
        </select>
      ) : null}
      {zuweisbar ? (
        <select
          aria-label="Zuweisen"
          className="min-h-9 rounded-sm bg-transparent px-1 text-sm font-semibold"
          value={stand.zugewiesen_an ?? ""}
          onChange={(e) => tun({ art: "zuweisen", an: e.target.value || null })}
        >
          <option value="">Niemandem zugewiesen</option>
          {personen.map((p) => (
            <option key={p.id} value={p.id}>An {p.name}</option>
          ))}
        </select>
      ) : null}
      <button type="button" className={k} onClick={() => setErinnernOffen(!erinnernOffen)} aria-expanded={erinnernOffen}>Später erinnern</button>
      <button type="button" className={k} onClick={() => tun({ art: "ungelesen" }, true)}>Ungelesen</button>
      <a href={druckHref} target="_blank" rel="noopener" className={k + " flex items-center"}>Drucken</a>
      {erinnernOffen ? (
        <div className="absolute left-0 top-full z-20 mt-1 grid w-64 gap-1 rounded-md bg-weiss p-2 text-sm shadow-xl ring-1 ring-black/10">
          <button type="button" className="rounded-sm px-2 py-2 text-left hover:bg-boden" onClick={() => erinnern(new Date(Date.now() + 3 * 3600_000))}>In 3 Stunden</button>
          <button type="button" className="rounded-sm px-2 py-2 text-left hover:bg-boden" onClick={() => erinnern(morgen8())}>Morgen, 8 Uhr</button>
          <button type="button" className="rounded-sm px-2 py-2 text-left hover:bg-boden" onClick={() => erinnern(montag8())}>Nächste Woche, Montag 8 Uhr</button>
          <label className="grid gap-1 px-2 py-1">
            <span className="text-grau">Selbst wählen</span>
            <input type="datetime-local" className="feld" onChange={(e) => e.target.value && erinnern(new Date(e.target.value))} />
          </label>
        </div>
      ) : null}
      {meldung ? <p role="alert" className="w-full text-sm font-semibold text-rot">{meldung}</p> : null}
    </div>
  );
}
