"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";

export type EditorApi = {
  /** Fügt HTML an der Schreibmarke ein (Textbaustein), sonst am Anfang */
  einfuegen: (html: string) => void;
  html: () => string;
  fokus: () => void;
};

const GROESSEN: [string, string][] = [
  ["2", "Klein"],
  ["3", "Normal"],
  ["5", "Groß"],
];

/**
 * Einfacher Editor mit Formatierung (fett, kursiv, unterstrichen, Listen, Link, Schriftgröße) für Mails und
 * Textbausteine. Arbeitet mit `contentEditable` und `execCommand`, das alle Browser (auch Safari auf dem
 * iPhone) noch können. Eingefügter Text kommt ohne fremde Formatierung herein; was gespeichert und gesendet
 * wird, bereinigt der Server ohnehin (`htmlBereinigen`). `name` legt das HTML als verstecktes Feld ins Formular.
 */
export const Editor = forwardRef<EditorApi, {
  wert?: string;
  name?: string;
  onAenderung?: (html: string) => void;
  vorlagen?: { id: string; name: string; html: string }[];
  minHoehe?: string;
  beschriftung?: string;
}>(function Editor({ wert = "", name, onAenderung, vorlagen, minHoehe = "12rem", beschriftung = "Text" }, ref) {
  const feld = useRef<HTMLDivElement>(null);
  const [html, setHtml] = useState(wert);
  // Markierung merken: Ein Klick auf die Leiste oder die Auswahl nimmt dem Textfeld sonst die Schreibmarke
  const markierung = useRef<Range | null>(null);

  useEffect(() => {
    if (feld.current) feld.current.innerHTML = wert;
    // Nur beim ersten Anzeigen: danach gehört der Inhalt dem Feld
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const melden = () => {
    const h = feld.current?.innerHTML ?? "";
    setHtml(h);
    onAenderung?.(h);
  };

  const merken = () => {
    const s = window.getSelection();
    if (s?.rangeCount && feld.current?.contains(s.anchorNode)) markierung.current = s.getRangeAt(0).cloneRange();
  };

  const zurueck = () => {
    feld.current?.focus();
    const s = window.getSelection();
    if (markierung.current && s) {
      s.removeAllRanges();
      s.addRange(markierung.current);
    }
  };

  const befehl = (cmd: string, wert?: string) => {
    zurueck();
    document.execCommand(cmd, false, wert);
    merken();
    melden();
  };

  useImperativeHandle(ref, () => ({
    einfuegen(neu: string) {
      if (!markierung.current) {
        // Ohne Schreibmarke an den Anfang (vor Signatur und Zitat)
        feld.current?.focus();
        const r = document.createRange();
        r.setStart(feld.current!, 0);
        r.collapse(true);
        markierung.current = r;
      }
      befehl("insertHTML", neu);
    },
    html: () => feld.current?.innerHTML ?? "",
    fokus: () => {
      feld.current?.focus();
      const r = document.createRange();
      r.setStart(feld.current!, 0);
      r.collapse(true);
      const s = window.getSelection();
      s?.removeAllRanges();
      s?.addRange(r);
      merken();
    },
  }));

  const knopf = "min-h-9 min-w-9 rounded-sm px-2 text-sm hover:bg-boden active:bg-boden";
  // mousedown statt click: Sonst verliert das Textfeld die Markierung, bevor der Befehl läuft
  const tipp = (fn: () => void) => ({ onMouseDown: (e: React.MouseEvent) => { e.preventDefault(); fn(); } });

  return (
    <div className="rounded-sm border border-linie bg-weiss focus-within:border-tinte">
      {name ? <input type="hidden" name={name} value={html} /> : null}
      <div role="toolbar" aria-label="Formatierung" className="flex flex-wrap items-center gap-0.5 border-b border-linie px-1 py-1">
        <button type="button" className={`${knopf} font-bold`} title="Fett (Strg+B)" aria-label="Fett" {...tipp(() => befehl("bold"))}>B</button>
        <button type="button" className={`${knopf} italic`} title="Kursiv (Strg+I)" aria-label="Kursiv" {...tipp(() => befehl("italic"))}>I</button>
        <button type="button" className={`${knopf} underline`} title="Unterstrichen (Strg+U)" aria-label="Unterstrichen" {...tipp(() => befehl("underline"))}>U</button>
        <span className="mx-1 h-5 w-px bg-linie" />
        <button type="button" className={knopf} aria-label="Aufzählung" title="Aufzählung" {...tipp(() => befehl("insertUnorderedList"))}>• Liste</button>
        <button type="button" className={knopf} aria-label="Nummerierung" title="Nummerierung" {...tipp(() => befehl("insertOrderedList"))}>1. Liste</button>
        <button
          type="button"
          className={knopf}
          title="Link einfügen"
          {...tipp(() => {
            const url = window.prompt("Adresse des Links (https://…)");
            if (url && /^(https?:\/\/|mailto:|tel:)/i.test(url.trim())) befehl("createLink", url.trim());
          })}
        >
          Link
        </button>
        <select
          aria-label="Schriftgröße"
          className="min-h-9 rounded-sm bg-transparent px-1 text-sm"
          defaultValue=""
          onMouseDown={merken}
          onChange={(e) => {
            if (e.target.value) befehl("fontSize", e.target.value);
            e.target.value = "";
          }}
        >
          <option value="" disabled>Größe</option>
          {GROESSEN.map(([w, t]) => (
            <option key={w} value={w}>{t}</option>
          ))}
        </select>
        <button type="button" className={`${knopf} text-grau`} title="Formatierung entfernen" {...tipp(() => befehl("removeFormat"))}>Ohne Format</button>
        {vorlagen?.length ? (
          <select
            aria-label="Textbaustein einfügen"
            className="ml-auto min-h-9 max-w-44 rounded-sm bg-transparent px-1 text-sm"
            defaultValue=""
            onMouseDown={merken}
            onChange={(e) => {
              const v = vorlagen.find((x) => x.id === e.target.value);
              if (v) befehl("insertHTML", v.html);
              e.target.value = "";
            }}
          >
            <option value="" disabled>Textbaustein</option>
            {vorlagen.map((v) => (
              <option key={v.id} value={v.id}>{v.name}</option>
            ))}
          </select>
        ) : null}
      </div>
      <div
        ref={feld}
        role="textbox"
        aria-multiline="true"
        aria-label={beschriftung}
        contentEditable
        suppressContentEditableWarning
        className="mail-editor max-w-none overflow-y-auto px-3 py-2 outline-none"
        style={{ minHeight: minHoehe }}
        onInput={melden}
        onKeyUp={merken}
        onMouseUp={merken}
        onBlur={merken}
        onPaste={(e) => {
          // Fremde Formatierung (Word, Webseiten) bleibt draußen, nur der Text kommt herein
          e.preventDefault();
          const text = e.clipboardData.getData("text/plain");
          document.execCommand("insertText", false, text);
          melden();
        }}
      />
    </div>
  );
});
