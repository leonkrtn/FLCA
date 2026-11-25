"use client";

import { useEffect, useRef, useState } from "react";

/**
 * HTML einer empfangenen Mail in einem abgeschotteten Rahmen: ohne Skripte und Formulare (sandbox ohne
 * allow-scripts), Links öffnen außerhalb. Der Rahmen erbt die Content-Security-Policy der Seite, deshalb
 * laden Bilder von fremden Servern nicht (auch keine Zählpixel); eingebettete Bilder (data:) schon.
 * allow-same-origin nur, damit die Seite die Höhe des Inhalts messen kann; ohne Skripte im Rahmen ist das unbedenklich.
 */
export function HtmlInhalt({ html }: { html: string }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [hoehe, setHoehe] = useState(160);

  useEffect(() => {
    const rahmen = ref.current;
    if (!rahmen) return;
    let beobachter: ResizeObserver | null = null;
    const messen = () => {
      const body = rahmen.contentDocument?.body;
      if (!body) return;
      setHoehe(Math.min(Math.max(body.scrollHeight + 8, 60), 6000));
      if (!beobachter) {
        beobachter = new ResizeObserver(messen);
        beobachter.observe(body);
      }
    };
    rahmen.addEventListener("load", messen);
    messen();
    return () => {
      rahmen.removeEventListener("load", messen);
      beobachter?.disconnect();
    };
  }, [html]);

  const dokument = `<!doctype html><html><head><meta charset="utf-8"><base target="_blank"><meta name="color-scheme" content="light"><style>html,body{margin:0;padding:0;background:#fff;color:#222;font:14px/1.5 Arial,Helvetica,sans-serif;overflow-wrap:anywhere}img{max-width:100%;height:auto}table{max-width:100%}pre{white-space:pre-wrap}</style></head><body>${html}</body></html>`;

  return (
    <iframe
      ref={ref}
      title="Inhalt der Mail"
      srcDoc={dokument}
      sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
      className="block w-full border-0 bg-white"
      style={{ height: hoehe }}
    />
  );
}
