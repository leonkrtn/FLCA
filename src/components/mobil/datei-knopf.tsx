"use client";

import { useRef, useState, type MouseEvent, type ReactNode } from "react";
import { istInstalliert } from "@/lib/push-browser";

type Eigenschaften = {
  className?: string;
  children: ReactNode;
} & (
  | { art: "datei"; href: string; formular?: undefined }
  /** Vorschau aus dem Editor: schickt das Formular mit dieser id per POST, statt `href` zu laden. */
  | { art: "datei"; href?: undefined; formular: string }
  | { art: "link"; href: string; formular?: undefined }
);

/**
 * PDF, XML oder Kundenlink öffnen. Im Browser wie gewohnt in einem neuen Tab. In der Web-App auf dem
 * Home-Bildschirm gibt es keine Tabs: iOS legt dann ein Safari-Fenster mit Adressleiste und „Fertig“ über
 * die App, und eine Datei im selben Fenster ließe sich ohne Zurück-Knopf nicht mehr schließen. Dort kommt
 * deshalb die Datei (oder der Link) in das Teilen-Menü von iOS, mit Vorschau, Drucken, Sichern, Mail und
 * WhatsApp, und man bleibt in der App.
 */
export function DateiKnopf(e: Eigenschaften) {
  // Safari erlaubt das Teilen nur kurz nach dem Tippen. Dauert das Laden zu lang, liegt die Datei bereit
  // und der nächste Tipp teilt sie sofort.
  const bereit = useRef<File | null>(null);
  const [zustand, setZustand] = useState<"ruhe" | "laedt" | "bereit">("ruhe");

  const klick = async (ev: MouseEvent) => {
    if (!istInstalliert() || typeof navigator.share !== "function") return;
    ev.preventDefault();

    if (e.art === "link") {
      await teilen({ url: new URL(e.href, location.href).href });
      return;
    }
    if (bereit.current) {
      const datei = bereit.current;
      bereit.current = null;
      setZustand("ruhe");
      await teilen({ files: [datei] });
      return;
    }
    if (zustand === "laedt") return;

    setZustand("laedt");
    let datei: File;
    try {
      datei = await laden(e.href, e.formular);
    } catch (fehler) {
      setZustand("ruhe");
      alert(fehler instanceof Error ? fehler.message : String(fehler));
      return;
    }
    if (!navigator.canShare?.({ files: [datei] })) {
      // Ohne Teilen von Dateien (sehr altes iOS): wenigstens im selben Fenster anzeigen
      setZustand("ruhe");
      location.href = URL.createObjectURL(datei);
      return;
    }
    const ergebnis = await teilen({ files: [datei] });
    if (ergebnis === "nicht-erlaubt") {
      bereit.current = datei;
      setZustand("bereit");
    } else setZustand("ruhe");
  };

  const inhalt = zustand === "laedt" ? "Wird geladen …" : zustand === "bereit" ? "Jetzt öffnen" : e.children;

  if (e.formular) {
    return (
      <button type="submit" form={e.formular} onClick={klick} className={e.className}>
        {inhalt}
      </button>
    );
  }
  return (
    <a href={e.href} target="_blank" rel="noopener" onClick={klick} className={e.className}>
      {inhalt}
    </a>
  );
}

async function laden(href: string | undefined, formularId: string | undefined): Promise<File> {
  const formular = formularId ? (document.getElementById(formularId) as HTMLFormElement | null) : null;
  const antwort = formular
    ? await fetch(formular.action, { method: "POST", body: new FormData(formular) })
    : await fetch(href ?? "");
  if (!antwort.ok) throw new Error((await antwort.text()) || "Die Datei konnte nicht geladen werden.");
  const name = /filename="([^"]+)"/.exec(antwort.headers.get("content-disposition") ?? "")?.[1] ?? "Dokument.pdf";
  const blob = await antwort.blob();
  return new File([blob], name, { type: blob.type || "application/pdf" });
}

async function teilen(daten: ShareData): Promise<"ok" | "nicht-erlaubt"> {
  try {
    await navigator.share(daten);
  } catch (fehler) {
    // Abbrechen im Teilen-Menü ist kein Fehler
    if (fehler instanceof DOMException && fehler.name === "NotAllowedError") return "nicht-erlaubt";
  }
  return "ok";
}
