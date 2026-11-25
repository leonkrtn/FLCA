"use client";

import { useState } from "react";
import { Formular, Senden } from "@/components/admin/formular";
import { Feld } from "@/components/admin/ui";
import { anhangVorbereiten } from "@/lib/aktionen/mail";
import type { Ergebnis } from "@/lib/forms";
import { groesse } from "@/lib/mail/adressen";

type Anhang = { pfad: string; name: string; typ: string; groesse: number };

export type Vorgabe = { an?: string; cc?: string; betreff?: string; text?: string };

/**
 * Neue Mail oder Antwort. Anhänge gehen beim Auswählen direkt in den Speicher (nicht durch die Server-Funktion,
 * die Vercel auf 4,5 MB begrenzt); mitgeschickt werden nur ihre Pfade. `postfaecher` nur bei einer neuen Mail
 * und nur, wenn jemand aus mehr als einem Postfach senden darf.
 */
export function Verfassen({
  aktion,
  vorgabe = {},
  antwortAuf,
  postfaecher,
  postfach,
}: {
  aktion: (v: Ergebnis, fd: FormData) => Promise<Ergebnis>;
  vorgabe?: Vorgabe;
  antwortAuf?: string;
  postfaecher?: [string, string][];
  postfach?: string;
}) {
  const [anhaenge, setAnhaenge] = useState<Anhang[]>([]);
  const [status, setStatus] = useState("");
  const [laedt, setLaedt] = useState(0);
  const [mitCc, setMitCc] = useState(Boolean(vorgabe.cc));

  async function hochladen(dateien: FileList | null) {
    if (!dateien?.length) return;
    setStatus("");
    for (const f of Array.from(dateien)) {
      setLaedt((n) => n + 1);
      try {
        const a = await anhangVorbereiten(f.name, f.size);
        if (!a.ok) {
          setStatus(`${f.name}: ${a.meldung}`);
          continue;
        }
        const body = new FormData();
        body.append("", f);
        const res = await fetch(a.url, { method: "PUT", body }).catch(() => null);
        if (!res?.ok) {
          setStatus(`${f.name}: Upload fehlgeschlagen.`);
          continue;
        }
        setAnhaenge((alt) => [...alt, { pfad: a.pfad, name: f.name, typ: f.type || "application/octet-stream", groesse: f.size }]);
      } finally {
        setLaedt((n) => n - 1);
      }
    }
  }

  return (
    <Formular aktion={aktion} className="grid gap-4">
      {antwortAuf ? <input type="hidden" name="antwort_auf" value={antwortAuf} /> : null}
      <input type="hidden" name="anhaenge" value={JSON.stringify(anhaenge)} />
      {postfaecher && postfaecher.length > 1 ? (
        <label className="block">
          <span className="label">Von</span>
          <select name="postfach" defaultValue={postfach} className="feld">
            {postfaecher.map(([w, t]) => (
              <option key={w} value={w}>{t}</option>
            ))}
          </select>
        </label>
      ) : postfach ? (
        <input type="hidden" name="postfach" value={postfach} />
      ) : null}
      <div>
        <Feld label="An" name="an" wert={vorgabe.an} typ="text" inputMode="email" autoComplete="off" autoCapitalize="none" placeholder="name@beispiel.de, mehrere mit Komma" />
        {!mitCc ? (
          <button type="button" className="mt-1 text-sm text-grau underline" onClick={() => setMitCc(true)}>
            Kopie (CC) hinzufügen
          </button>
        ) : null}
      </div>
      {mitCc ? <Feld label="Kopie (CC)" name="cc" wert={vorgabe.cc} typ="text" inputMode="email" autoComplete="off" autoCapitalize="none" /> : null}
      <Feld label="Betreff" name="betreff" wert={vorgabe.betreff} maxLength={300} />
      <label className="block">
        <span className="label">Text</span>
        <textarea name="text" rows={12} defaultValue={vorgabe.text ?? ""} className="feld" />
      </label>
      <div className="grid gap-2">
        {anhaenge.length ? (
          <ul className="grid gap-1 text-sm">
            {anhaenge.map((a) => (
              <li key={a.pfad} className="flex items-center justify-between gap-3">
                <span className="min-w-0 truncate">{a.name} <span className="zahlen text-grau">({groesse(a.groesse)})</span></span>
                <button type="button" className="shrink-0 text-grau underline" onClick={() => setAnhaenge((alt) => alt.filter((x) => x.pfad !== a.pfad))}>
                  entfernen
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        <div className="flex flex-wrap items-center gap-3">
          <label className="knopf knopf-rahmen knopf-klein cursor-pointer">
            Datei anhängen
            <input type="file" multiple className="sr-only" onChange={(e) => { hochladen(e.target.files); e.target.value = ""; }} />
          </label>
          {laedt ? <span className="text-sm text-grau">Wird hochgeladen …</span> : null}
          {status ? <span className="text-sm text-fehler">{status}</span> : null}
        </div>
      </div>
      <div>
        {laedt ? (
          <button type="button" disabled className="knopf knopf-dunkel opacity-60">Senden</button>
        ) : (
          <Senden vorab="Wird gesendet">Senden</Senden>
        )}
      </div>
    </Formular>
  );
}
