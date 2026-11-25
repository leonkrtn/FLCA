"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { IconFeld, IconKnopf as Knopf, IconLink, unsichtbaresFeld as auswahlFeld } from "@/components/icon-knopf";
import { Antworten, Archiv, Drucker, Etikett, Fahne, Glocke, Nadel, Papierkorb, Person, Posteingang, Ungelesen, Weiterleiten, Wiederherstellen } from "@/components/icons";
import { mailOrdnen } from "@/lib/aktionen/mail";
import type { Aktion, Ansicht } from "@/lib/mail/postfach";
import type { Kategorie, PersonKurz } from "./liste";
import { useSchreiben } from "./schreiben";

/**
 * Leiste über einer geöffneten Mail: Antworten, Weiterleiten, Drucken, Kennzeichnen, Anheften, Kategorie,
 * Zuweisen, Erinnern, Archivieren, Löschen, Ungelesen. Was die Mail aus dem Ordner nimmt (Archivieren, Löschen),
 * führt zurück zur Liste. Nur Icons, damit die Leiste in einer Zeile bleibt; was ein Icon tut, sagt der Hinweis
 * beim Darüberfahren (und für Screenreader das aria-label).
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
      <Knopf text="Antworten" lage={{ ausrichtung: "links" }} className="bg-tinte text-flaeche hover:bg-tinte/90" onClick={() => oeffnen("antwort", antwortAuf)}>
        <Antworten />
      </Knopf>
      <Knopf text="Weiterleiten" onClick={() => oeffnen("weiter", weiterleiten)}>
        <Weiterleiten />
      </Knopf>
      {stand.imPapierkorb ? (
        <>
          <Knopf text="Wiederherstellen" onClick={() => tun({ art: "wiederherstellen" }, true)}>
            <Wiederherstellen />
          </Knopf>
          <Knopf text="Endgültig löschen" onClick={() => window.confirm("Endgültig löschen?") && tun({ art: "loeschen" }, true)}>
            <Papierkorb />
          </Knopf>
        </>
      ) : (
        <>
          {stand.eingang ? (
            stand.archiviert ? (
              <Knopf text="In Posteingang" onClick={() => tun({ art: "verschieben", ordner: "eingang" }, true)}>
                <Posteingang />
              </Knopf>
            ) : (
              <Knopf text="Archivieren" onClick={() => tun({ art: "verschieben", ordner: "archiv" }, true)}>
                <Archiv />
              </Knopf>
            )
          ) : null}
          <Knopf text="Löschen" onClick={() => tun({ art: "loeschen" }, true)}>
            <Papierkorb />
          </Knopf>
        </>
      )}
      <Knopf
        text={stand.gekennzeichnet ? "Kennzeichnung entfernen" : "Kennzeichnen"}
        className={stand.gekennzeichnet ? "text-rot" : ""}
        onClick={() => tun({ art: stand.gekennzeichnet ? "entkennzeichnen" : "kennzeichnen" })}
      >
        <Fahne an={stand.gekennzeichnet} />
      </Knopf>
      <Knopf text={stand.angeheftet ? "Lösen" : "Anheften"} onClick={() => tun({ art: stand.angeheftet ? "loesen" : "anheften" })}>
        <Nadel an={stand.angeheftet} />
      </Knopf>
      {kategorien.length ? (
        <IconFeld text={stand.kategorien.length ? `Kategorie: ${kategorien.filter((x) => stand.kategorien.includes(x.id)).map((x) => x.name).join(", ")}` : "Kategorie"} aktiv={stand.kategorien.length > 0} icon={<Etikett />}>
          <select
            aria-label="Kategorie"
            className={auswahlFeld}
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
        </IconFeld>
      ) : null}
      {zuweisbar ? (
        <IconFeld
          text={stand.zugewiesen_an ? `Zugewiesen an ${personen.find((p) => p.id === stand.zugewiesen_an)?.name ?? "jemanden"}` : "Zuweisen"}
          aktiv={Boolean(stand.zugewiesen_an)}
          icon={<Person />}
        >
          <select aria-label="Zuweisen" className={auswahlFeld} value={stand.zugewiesen_an ?? ""} onChange={(e) => tun({ art: "zuweisen", an: e.target.value || null })}>
            <option value="">Niemandem zugewiesen</option>
            {personen.map((p) => (
              <option key={p.id} value={p.id}>An {p.name}</option>
            ))}
          </select>
        </IconFeld>
      ) : null}
      <Knopf text="Später erinnern" onClick={() => setErinnernOffen(!erinnernOffen)} aria-expanded={erinnernOffen}>
        <Glocke />
      </Knopf>
      <Knopf text="Als ungelesen markieren" onClick={() => tun({ art: "ungelesen" }, true)}>
        <Ungelesen />
      </Knopf>
      <IconLink text="Drucken" href={druckHref} target="_blank" rel="noopener">
        <Drucker />
      </IconLink>
      {erinnernOffen ? (
        <div className="absolute left-0 top-full z-20 mt-1 grid w-64 gap-1 rounded-md bg-flaeche p-2 text-sm shadow-xl ring-1 ring-black/10">
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

