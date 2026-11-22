"use client";

import { useEffect, useOptimistic, useState } from "react";
import { uploadAdresse } from "@/app/admin/upload-actions";
import { Formular, Senden } from "@/components/admin/formular";
import { Kamera } from "@/components/icons";
import type { Ergebnis } from "@/lib/forms";
import { auftragStatus, auftragUebernehmen, auftragZeit, fotoHinzufuegen, meldungAnlegen } from "@/lib/aktionen/team";

const dauer = (min: number) => `${Math.floor(min / 60)}:${String(min % 60).padStart(2, "0")} h`;

/** Laufende Uhr: zählt jede Minute weiter, ohne dass die Seite neu lädt. */
function Uhr({ seit, bisher }: { seit: string | null; bisher: number }) {
  const [jetzt, setJetzt] = useState(() => Date.now());
  useEffect(() => {
    if (!seit) return;
    const t = setInterval(() => setJetzt(Date.now()), 30000);
    return () => clearInterval(t);
  }, [seit]);
  const laufend = seit ? Math.max(0, Math.round((jetzt - new Date(seit).getTime()) / 60000)) : 0;
  return <span className="zahlen">{dauer(bisher + laufend)}</span>;
}

type Stand = { status: string; seit: string | null; bisher: number };

/** Was ein Tipp voraussichtlich bewirkt, genau wie `auftragStatus` und `auftragZeit` auf dem Server. */
function nachTipp(alt: Stand, fd: FormData): Stand {
  const jetzt = new Date().toISOString();
  // Beim Anhalten wandert die laufende Zeit zu den erfassten Minuten, sonst springt die Uhr zurück.
  const angehalten = alt.bisher + (alt.seit ? Math.max(0, Math.round((Date.now() - new Date(alt.seit).getTime()) / 60000)) : 0);
  const aktion = fd.get("aktion");
  if (aktion === "start") return { status: "in_arbeit", seit: jetzt, bisher: alt.bisher };
  if (aktion === "stopp") return { status: alt.status, seit: null, bisher: angehalten };
  const status = String(fd.get("status") ?? alt.status);
  if (status === "in_arbeit") return { status, seit: alt.seit ?? jetzt, bisher: alt.bisher };
  return { status, seit: null, bisher: angehalten };
}

/**
 * Auftrag in der Team-App: Anfangen startet die Uhr am Auftrag, Unterbrechen hält sie an, Fertig stoppt sie und
 * meldet ans Büro. `bisher`: schon erfasste Minuten ohne die laufende Zeit, `seit`: Beginn der laufenden.
 *
 * Ein Tipp wirkt sofort (`useOptimistic`): Uhr und Knöpfe stehen gleich auf dem neuen Stand, der Server zieht
 * nach. Ein einziges Formular für alle Knöpfe, damit es beim Umschalten stehen bleibt und eine Fehlermeldung
 * („Erst die Pause beenden“) sichtbar bleibt, wenn der alte Stand zurückkommt.
 */
export function AuftragKnoepfe({ id, status, seit = null, bisher = 0, foto = true }: { id: string; status: string; seit?: string | null; bisher?: number; foto?: boolean }) {
  const [stand, vorab] = useOptimistic<Stand, FormData>({ status, seit, bisher }, nachTipp);
  const laeuft = Boolean(stand.seit);
  // Uhr-Knöpfe (aktion) gehen an auftragZeit, Status-Knöpfe (status) an auftragStatus.
  const aktion = (v: Ergebnis, fd: FormData) => (fd.get("aktion") ? auftragZeit(id, v, fd) : auftragStatus(id, v, fd));
  return (
    <div className="mt-3 grid gap-2">
      {stand.status !== "offen" || stand.bisher ? (
        <p className="flex items-center justify-between text-sm">
          <span className="text-grau">{laeuft ? "Uhr läuft" : "Arbeitszeit"}</span>
          <span className={laeuft ? "font-semibold" : ""}>
            <Uhr seit={stand.seit} bisher={stand.bisher} />
          </span>
        </p>
      ) : null}
      <Formular aktion={aktion} sofort={vorab} className="grid grid-cols-2 gap-2">
        {stand.status === "offen" ? (
          <Senden name="status" value="in_arbeit" className="col-span-2 min-h-12">Anfangen</Senden>
        ) : null}
        {stand.status === "in_arbeit" ? (
          <>
            <Senden art="rahmen" name="aktion" value={laeuft ? "stopp" : "start"} className="min-h-12">
              {laeuft ? "Unterbrechen" : "Weiter"}
            </Senden>
            <Senden name="status" value="fertig" className="min-h-12">Fertig</Senden>
          </>
        ) : null}
        {stand.status === "fertig" ? (
          <Senden art="rahmen" name="status" value="in_arbeit" className="col-span-2">Doch noch nicht fertig</Senden>
        ) : null}
      </Formular>
      {foto ? <FotoKnopf id={id} /> : null}
    </div>
  );
}

/** Freien Auftrag übernehmen. In der Liste freier Aufträge (in <Ausblenden>) verschwindet die Karte sofort. */
export function Uebernehmen({ id }: { id: string }) {
  return (
    <Formular aktion={auftragUebernehmen.bind(null, id)} ausblenden className="mt-3 grid">
      <Senden art="rahmen" vorab="Übernommen">Übernehmen</Senden>
    </Formular>
  );
}

/** Befund melden oder Teil anfordern: geht als Push ans Büro. */
export function MeldungFormular({ id }: { id: string }) {
  const [art, setArt] = useState<"befund" | "teil">("befund");
  return (
    <Formular aktion={meldungAnlegen.bind(null, id)} zuruecksetzen className="grid gap-3">
      <input type="hidden" name="art" value={art} />
      <div className="grid grid-cols-2 gap-1 rounded-sm bg-boden p-1" role="radiogroup" aria-label="Art der Meldung">
        {(
          [
            ["befund", "Befund melden"],
            ["teil", "Teil anfordern"],
          ] as const
        ).map(([w, t]) => (
          <button
            key={w}
            type="button"
            role="radio"
            aria-checked={art === w}
            onClick={() => setArt(w)}
            className={`min-h-10 rounded-sm text-sm font-semibold ${art === w ? "bg-flaeche text-tinte shadow-sm" : "text-grau"}`}
          >
            {t}
          </button>
        ))}
      </div>
      <label className="block">
        <span className="label">{art === "teil" ? "Welches Teil?" : "Was ist aufgefallen?"}</span>
        <textarea name="text" rows={3} required className="feld" placeholder={art === "teil" ? "z. B. Bremsbeläge vorne, Bosch 0 986 …" : "z. B. Bremsscheiben hinten unter Mindestmaß"} />
      </label>
      <div className="flex items-end gap-3">
        {art === "teil" ? (
          <label className="block w-24">
            <span className="label">Menge</span>
            <input name="menge" inputMode="decimal" defaultValue="1" className="feld" />
          </label>
        ) : null}
        <label className="flex min-h-12 cursor-pointer items-center gap-3">
          <input type="checkbox" name="dringend" className="size-5 accent-tinte" />
          <span className="font-semibold">Dringend</span>
        </label>
      </div>
      <Senden vorab="Gesendet">{art === "teil" ? "Teil anfordern" : "Befund senden"}</Senden>
    </Formular>
  );
}

/** Foto vom Fahrzeug aus der Kamera, direkt in den privaten Speicher. `art`: Arbeit oder Vorschaden bei der Annahme. */
export function FotoKnopf({ id, art = "arbeit", text = "Foto aufnehmen" }: { id: string; art?: "arbeit" | "vorschaden"; text?: string }) {
  const [foto, setFoto] = useState("");
  async function hochladen(f: File | undefined) {
    if (!f) return;
    setFoto("Wird hochgeladen …");
    const a = await uploadAdresse("auftragsfotos", "auftraege", f.type || "image/jpeg");
    if (!a.ok) return setFoto(a.meldung);
    const body = new FormData();
    body.append("cacheControl", "3600");
    body.append("", f);
    const res = await fetch(a.url, { method: "PUT", body }).catch(() => null);
    if (!res?.ok) return setFoto("Upload fehlgeschlagen.");
    const e = await fotoHinzufuegen(id, a.pfad, art);
    setFoto(e.meldung ?? "");
  }
  return (
    <div className="grid gap-1">
      <label className="knopf knopf-rahmen cursor-pointer">
        <Kamera /> {text}
        <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => hochladen(e.target.files?.[0])} />
      </label>
      {foto ? <p className="text-sm text-grau">{foto}</p> : null}
    </div>
  );
}
