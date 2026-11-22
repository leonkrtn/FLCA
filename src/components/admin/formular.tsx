"use client";

import { createContext, use, useActionState, useEffect, useOptimistic, useRef, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { Haken } from "@/components/icons";
import { type Ergebnis, LEER } from "@/lib/forms";

type Aktion = (vorher: Ergebnis, formData: FormData) => Promise<Ergebnis>;

/** Von <Ausblenden> gesetzt: blendet den umgebenden Eintrag aus, solange die Aktion läuft. */
const AusblendenKontext = createContext<(() => void) | null>(null);

/** Gesetzt, wenn das Formular sein Ergebnis schon vorab zeigt (`sofort`): Die Knöpfe werden dann nicht blass. */
const SofortKontext = createContext(false);

/**
 * Formular für Server Actions mit Rückmeldung. Fehler lassen das Formular mit allen Eingaben stehen.
 * `zuruecksetzen` leert es nach Erfolg (z. B. „Position hinzufügen“).
 *
 * Optimistisch, damit ein Tipp sofort wirkt und nicht erst, wenn der Server geantwortet hat:
 * - `sofort(fd)` läuft beim Absenden vor der Aktion. Dort setzt die Komponente ihren `useOptimistic`-Zustand
 *   auf das erwartete Ergebnis (Uhr läuft, eingestempelt). React nimmt ihn zurück, sobald die Aktion fertig ist:
 *   bei Erfolg gilt dann der neue Stand vom Server, bei einem Fehler wieder der alte, darunter die Meldung.
 * - `ausblenden` lässt den Eintrag in einem umgebenden <Ausblenden> sofort verschwinden (Anfrage angenommen,
 *   Erinnerung erledigt, Zeile gelöscht). Ohne <Ausblenden> darum hat es keine Wirkung.
 */
export function Formular({
  aktion,
  children,
  className = "",
  zuruecksetzen = false,
  bestaetigen,
  sofort,
  ausblenden = false,
}: {
  aktion: Aktion;
  children: React.ReactNode;
  className?: string;
  zuruecksetzen?: boolean;
  bestaetigen?: string;
  sofort?: (fd: FormData) => void;
  ausblenden?: boolean;
}) {
  const weg = use(AusblendenKontext);
  // Die letzte Eingabe merken: Meldet die Aktion nur eine Warnung (z. B. „Max hat da schon einen Termin“),
  // speichert „Trotzdem speichern“ genau diese Eingabe mit ueberbuchen=on, ohne alles neu auszufüllen.
  const letzte = useRef<FormData | null>(null);
  const [zustand, ausfuehren] = useActionState(async (vorher: Ergebnis, fd: FormData) => {
    letzte.current = fd;
    // Läuft schon im Übergang der Aktion: Nur dann hält React den vorab gezeigten Stand, bis sie fertig ist.
    sofort?.(fd);
    if (ausblenden) weg?.();
    return aktion(vorher, fd);
  }, LEER);
  const [trotzdemLaeuft, starten] = useTransition();
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (zustand.status === "ok" && zuruecksetzen) ref.current?.reset();
  }, [zustand, zuruecksetzen]);
  return (
    <form
      ref={ref}
      action={ausfuehren}
      className={className}
      onSubmit={(e) => {
        if (bestaetigen && !window.confirm(bestaetigen)) e.preventDefault();
      }}
    >
      <SofortKontext value={Boolean(sofort)}>{children}</SofortKontext>
      <Meldung zustand={zustand} />
      {zustand.status === "fehler" && Array.isArray(zustand.daten?.warnungen) ? (
        <button
          type="button"
          disabled={trotzdemLaeuft}
          className={`knopf knopf-rahmen knopf-klein mt-2 ${trotzdemLaeuft ? "cursor-progress opacity-60" : ""}`}
          onClick={() => {
            if (!letzte.current) return;
            const fd = new FormData();
            for (const [k, v] of letzte.current.entries()) fd.append(k, v);
            fd.set("ueberbuchen", "on");
            starten(() => ausfuehren(fd));
          }}
        >
          Trotzdem speichern
        </button>
      ) : null}
    </form>
  );
}

function Meldung({ zustand }: { zustand: Ergebnis }) {
  const { pending } = useFormStatus();
  if (pending || zustand.status === "leer" || !zustand.meldung) return null;
  return (
    <p role="status" className={`mt-3 text-sm font-semibold ${zustand.status === "fehler" ? "text-rot" : "text-ok"}`}>
      {zustand.meldung}
    </p>
  );
}

/**
 * Absendeknopf. Während die Aktion läuft, zeigt `vorab` schon das erwartete Ergebnis („Angenommen“,
 * „Eingestempelt“): Der Tipp wirkt sofort, die Seite zieht nach, sobald der Server fertig ist. Geht
 * etwas schief, steht der Knopf wieder wie vorher da und darunter die Meldung.
 * Ohne `vorab` bleibt der Text stehen (kein Springen der Breite), der Knopf wird nur blasser.
 * Bei mehreren Knöpfen in einem Formular reagiert nur der gedrückte (erkannt an name/value).
 */
export function Senden({
  children,
  art = "dunkel",
  klein = false,
  className = "",
  name,
  value,
  vorab,
}: {
  children: React.ReactNode;
  art?: "dunkel" | "rot" | "rahmen";
  klein?: boolean;
  className?: string;
  name?: string;
  value?: string;
  vorab?: React.ReactNode;
}) {
  const { pending, data } = useFormStatus();
  const vorabGezeigt = use(SofortKontext);
  const gedrueckt = pending && (!name || data?.get(name) === value);
  // Zeigt der Knopf schon das Ergebnis (`vorab`) oder das Formular (`sofort`), ist er nur gesperrt, damit kein
  // zweiter Tipp absendet, sieht aber nicht so aus: `.knopf:disabled` würde ihn sonst auf 45 % abblenden.
  const fertigWirkend = pending && (vorabGezeigt || (gedrueckt && Boolean(vorab)));
  const blass = pending && !fertigWirkend;
  return (
    <button
      type="submit"
      name={name}
      value={value}
      disabled={pending}
      aria-busy={gedrueckt || undefined}
      className={`knopf knopf-${art} ${klein ? "knopf-klein" : ""} ${blass ? "cursor-progress opacity-60" : ""} ${fertigWirkend ? "disabled:cursor-default disabled:opacity-100" : ""} ${className}`}
    >
      {gedrueckt && vorab ? (
        <>
          <Haken className="size-4" /> {vorab}
        </>
      ) : (
        children
      )}
    </button>
  );
}

/**
 * Hülle um einen Eintrag einer Liste (Karte, Zeile), den eine Aktion entfernt oder in eine andere Liste schiebt.
 * Ein <Formular ausblenden> darin blendet ihn beim Tippen sofort aus; kommt ein Fehler zurück, steht er wieder
 * da, mit der Meldung. Ausgeblendet statt entfernt, damit das Formular und seine Rückmeldung erhalten bleiben.
 */
export function Ausblenden({ children, className = "", als: Tag = "div" }: { children: React.ReactNode; className?: string; als?: "div" | "li" | "tr" }) {
  const [weg, setWeg] = useOptimistic(false);
  return (
    <AusblendenKontext value={() => setWeg(true)}>
      <Tag hidden={weg} className={`${className} ${weg ? "hidden" : ""}`}>
        {children}
      </Tag>
    </AusblendenKontext>
  );
}

/**
 * Absendeknopf ohne Knopf-Gestalt (Textlink „lösen“, Menüpunkt „Abmelden“) für jedes Formular, auch ein
 * schlichtes `<form action>`. Während die Aktion läuft, ist er gesperrt und blasser: Der Tipp hat sichtbar
 * gewirkt, und ein zweiter legt nichts doppelt an.
 */
export function Absenden({ children, className = "", title, role }: { children: React.ReactNode; className?: string; title?: string; role?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} aria-busy={pending || undefined} title={title} role={role} className={`${className} ${pending ? "cursor-progress opacity-60" : ""}`}>
      {children}
    </button>
  );
}
