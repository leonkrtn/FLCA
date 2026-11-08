"use client";

import { useState } from "react";
import { uploadAdresse } from "@/app/admin/upload-actions";
import { Formular, Senden } from "@/components/admin/formular";
import { Kamera } from "@/components/icons";
import { auftragStatus, fotoHinzufuegen } from "@/lib/aktionen/team";

/** Auftrag in der Team-App: Status in einem Tipp, Fotos direkt aus der Kamera. */
export function AuftragKnoepfe({ id, status }: { id: string; status: string }) {
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
    const e = await fotoHinzufuegen(id, a.pfad);
    setFoto(e.meldung ?? "");
  }
  return (
    <div className="mt-3 grid gap-2">
      <Formular aktion={auftragStatus.bind(null, id)} className="grid grid-cols-2 gap-2">
        {status === "offen" ? <Senden name="status" value="in_arbeit" className="col-span-2">Anfangen</Senden> : null}
        {status === "in_arbeit" ? <Senden name="status" value="fertig" className="col-span-2">Fertig</Senden> : null}
        {status === "fertig" ? <Senden art="rahmen" name="status" value="in_arbeit" className="col-span-2">Doch noch nicht fertig</Senden> : null}
      </Formular>
      <label className="knopf knopf-rahmen cursor-pointer">
        <Kamera /> Foto aufnehmen
        <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => hochladen(e.target.files?.[0])} />
      </label>
      {foto ? <p className="text-sm text-grau">{foto}</p> : null}
    </div>
  );
}
