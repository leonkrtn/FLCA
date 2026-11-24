"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { unterschriftAktion } from "@/lib/aktionen/auftrag";
import { LEER } from "@/lib/forms";

/**
 * Der Kunde unterschreibt den Auftrag mit dem Finger oder Stift auf dem Gerät (Tablet am Tresen, Handy in der
 * Werkstatt). Das Zeichenfeld steckt in UnterschriftFeld und wird auch vom Kundenbildschirm genutzt.
 */
export function Unterschrift({ terminId, name: vorgabe }: { terminId: string; name: string }) {
  const [bild, setBild] = useState("");
  const [zustand, aktion, laeuft] = useActionState(unterschriftAktion.bind(null, terminId), LEER);
  const leer = !bild;

  if (zustand.status === "ok") return <p className="font-semibold text-ok" role="status">{zustand.meldung}</p>;

  return (
    <form action={aktion} className="grid gap-3">
      <input type="hidden" name="bild" value={bild} />
      <label className="block">
        <span className="label">Name des Unterzeichners</span>
        <input name="name" defaultValue={vorgabe} required autoComplete="off" className="feld" />
      </label>
      <UnterschriftFeld onBild={setBild} />
      <p className="text-sm text-grau">Mit der Unterschrift erteilt der Kunde den Auftrag zu den Positionen und Bedingungen im PDF.</p>
      <button type="submit" disabled={leer || laeuft} className={`knopf knopf-dunkel ${leer || laeuft ? "opacity-60" : ""}`}>
        {laeuft ? "Wird gespeichert …" : "Auftrag erteilen"}
      </button>
      {zustand.status === "fehler" ? <p className="text-sm font-semibold text-rot">{zustand.meldung}</p> : null}
    </form>
  );
}

/**
 * Zeichenfeld für die Unterschrift (Finger, Stift oder Maus). Gezeichnet wird in ein Canvas, gespeichert als PNG
 * mit durchsichtigem Grund und dunkler Tinte, damit die Unterschrift auf dem weißen PDF steht wie auf Papier.
 * `onBild` bekommt nach jedem Strich das Bild als data:-URL, nach „Neu“ einen leeren Text.
 */
export function UnterschriftFeld({
  onBild,
  label = "Unterschrift",
  hilfe = "Mit Finger oder Stift unterschreiben",
  neuText = "Neu",
  hoch = false,
}: {
  onBild: (bild: string) => void;
  label?: string;
  hilfe?: string;
  neuText?: string;
  hoch?: boolean;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const zeichnet = useRef(false);
  const letzter = useRef<{ x: number; y: number } | null>(null);
  const leer = useRef(true);
  // Aktuelle Rückgabe merken, ohne das Einrichten bei jedem Neuzeichnen des Elternteils zu wiederholen
  const melden = useRef(onBild);
  useEffect(() => {
    melden.current = onBild;
  });

  // Auflösung an das Gerät anpassen, sonst wird die Linie auf dem iPhone unscharf. Das Feld steckt oft in einem
  // zugeklappten Abschnitt und hat erst beim Aufklappen eine Größe; dreht sich das Gerät, beginnt es neu.
  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const einrichten = () => {
      const faktor = Math.min(window.devicePixelRatio || 1, 3);
      const breite = Math.round(c.clientWidth * faktor);
      const hoehe = Math.round(c.clientHeight * faktor);
      if (!breite || (breite === c.width && hoehe === c.height)) return;
      c.width = breite;
      c.height = hoehe;
      const ctx = c.getContext("2d")!;
      ctx.scale(faktor, faktor);
      ctx.lineWidth = 2.2;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      // Tinte bleibt dunkel, auch im PDF: Das Bild ist ein Beleg, kein Teil der Oberfläche.
      ctx.strokeStyle = "#141414";
      leer.current = true;
      melden.current("");
    };
    einrichten();
    const beobachter = new ResizeObserver(einrichten);
    beobachter.observe(c);
    return () => beobachter.disconnect();
  }, []);

  const punkt = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  function start(e: React.PointerEvent<HTMLCanvasElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    zeichnet.current = true;
    letzter.current = punkt(e);
  }

  function ziehen(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!zeichnet.current || !letzter.current) return;
    const ctx = canvas.current!.getContext("2d")!;
    const p = punkt(e);
    ctx.beginPath();
    ctx.moveTo(letzter.current.x, letzter.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    letzter.current = p;
    leer.current = false;
  }

  function ende() {
    if (!zeichnet.current) return;
    zeichnet.current = false;
    letzter.current = null;
    if (!leer.current) melden.current(canvas.current!.toDataURL("image/png"));
  }

  function loeschen() {
    const c = canvas.current!;
    c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
    leer.current = true;
    melden.current("");
  }

  return (
    <div>
      <span className="label">{label}</span>
      <canvas
        ref={canvas}
        onPointerDown={start}
        onPointerMove={ziehen}
        onPointerUp={ende}
        onPointerCancel={ende}
        onPointerLeave={ende}
        // touch-none: Beim Unterschreiben darf die Seite nicht mitscrollen.
        className={`block w-full touch-none rounded-md border border-linie bg-flaeche ${hoch ? "h-56 cursor-crosshair" : "h-44"}`}
        aria-label={label}
      />
      <div className="mt-1 flex items-center justify-between text-sm text-grau">
        <span>{hilfe}</span>
        <button type="button" onClick={loeschen} className="underline">{neuText}</button>
      </div>
    </div>
  );
}
