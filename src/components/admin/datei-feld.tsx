"use client";

import { useState } from "react";
import { uploadAdresse } from "@/app/admin/upload-actions";

/** Datei hochladen und den Speicherpfad als verstecktes Feld ins Formular legen. */
export function DateiFeld({
  name,
  label,
  ordner,
  vorhanden,
  vorschau,
  accept = "image/jpeg,image/png,image/webp",
  bucket = "website",
}: {
  name: string;
  label: string;
  ordner: string;
  vorhanden?: string | null;
  vorschau?: string | null;
  accept?: string;
  bucket?: "website" | "auftragsfotos";
}) {
  const [pfad, setPfad] = useState(vorhanden ?? "");
  const [bild, setBild] = useState(vorschau ?? null);
  const [status, setStatus] = useState("");

  async function waehlen(f: File | undefined) {
    if (!f) return;
    setStatus("Wird hochgeladen …");
    const a = await uploadAdresse(bucket, ordner, f.type);
    if (!a.ok) return setStatus(a.meldung);
    const body = new FormData();
    body.append("cacheControl", "31536000");
    body.append("", f);
    const res = await fetch(a.url, { method: "PUT", body }).catch(() => null);
    if (!res?.ok) return setStatus("Upload fehlgeschlagen.");
    setPfad(a.pfad);
    setBild(URL.createObjectURL(f));
    setStatus("Hochgeladen. Speichern nicht vergessen.");
  }

  return (
    <div>
      <span className="label">{label}</span>
      <input type="hidden" name={name} value={pfad} />
      <div className="flex items-center gap-4">
        {bild ? (
          f_istVideo(pfad) ? (
            <video src={bild} className="h-20 w-28 bg-boden object-cover" muted />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={bild} alt="" className="h-20 w-28 bg-boden object-cover" />
          )
        ) : (
          <div className="flex h-20 w-28 items-center justify-center bg-boden text-xs text-grau">keine Datei</div>
        )}
        <div className="flex flex-col items-start gap-1">
          <label className="knopf knopf-rahmen knopf-klein cursor-pointer">
            Datei wählen
            <input type="file" accept={accept} className="sr-only" onChange={(e) => waehlen(e.target.files?.[0])} />
          </label>
          {pfad ? (
            <button
              type="button"
              className="text-sm text-grau underline"
              onClick={() => {
                setPfad("");
                setBild(null);
                setStatus("Entfernt. Speichern nicht vergessen.");
              }}
            >
              entfernen
            </button>
          ) : null}
          {status ? <span className="text-sm text-grau">{status}</span> : null}
        </div>
      </div>
    </div>
  );
}

const f_istVideo = (p: string) => /\.(mp4|webm)$/.test(p);
