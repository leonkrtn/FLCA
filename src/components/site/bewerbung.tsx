"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { bewerben, uploadVorbereiten } from "@/app/(site)/karriere/actions";
import { Haken } from "@/components/icons";
import { FALLE, LEER } from "@/lib/forms";

export function BewerbungsFormular({ stelle }: { stelle: string }) {
  const [zustand, aktion, sendet] = useActionState(bewerben, LEER);
  const [datei, setDatei] = useState<{ pfad: string; name: string } | null>(null);
  const [upload, setUpload] = useState<"" | "laeuft" | string>("");
  const start = useRef(0);
  useEffect(() => {
    start.current = Date.now();
  }, []);

  async function hochladen(f: File | undefined) {
    setDatei(null);
    if (!f) return;
    setUpload("laeuft");
    const vorbereitet = await uploadVorbereiten(f.type, f.size);
    if (!vorbereitet.ok) return setUpload(vorbereitet.meldung);
    const body = new FormData();
    body.append("cacheControl", "3600");
    body.append("", f);
    const res = await fetch(vorbereitet.url, { method: "PUT", body, headers: { "x-upsert": "false" } }).catch(() => null);
    if (!res?.ok) return setUpload("Upload fehlgeschlagen. Sie können sich auch ohne Datei bewerben.");
    setDatei({ pfad: vorbereitet.pfad, name: f.name });
    setUpload("");
  }

  if (zustand.status === "ok") {
    return (
      <div role="status" className="flex gap-4">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-tinte text-weiss">
          <Haken />
        </span>
        <p className="text-lg">Danke! Ihre Bewerbung ist angekommen. Wir melden uns in den nächsten Tagen bei Ihnen.</p>
      </div>
    );
  }
  const f = zustand.fehler ?? {};
  const w = (n: string) => zustand.werte?.[n] ?? "";
  return (
    <form
      key={zustand.versuch}
      action={(fd) => {
        fd.set("t", String(Math.round((Date.now() - start.current) / 1000)));
        aktion(fd);
      }}
      className="grid gap-5"
      noValidate
    >
      <input type="hidden" name="stelle" value={stelle} />
      <input type="hidden" name="lebenslauf" value={datei?.pfad ?? ""} />
      <input type="hidden" name="lebenslauf_name" value={datei?.name ?? ""} />
      <div className="absolute -left-[9999px]" aria-hidden>
        <input type="text" name={FALLE} tabIndex={-1} autoComplete="off" />
      </div>
      {(
        [
          ["name", "Name", "text", "name"],
          ["telefon", "Telefon", "tel", "tel"],
          ["email", "E-Mail (optional)", "email", "email"],
        ] as const
      ).map(([n, l, t, a]) => (
        <div key={n}>
          <label htmlFor={`b-${n}`} className="label">
            {l}
          </label>
          <input id={`b-${n}`} name={n} type={t} autoComplete={a} defaultValue={w(n)} aria-invalid={f[n] ? true : undefined} className="feld" />
          {f[n] ? <p className="mt-1 text-sm text-rot">{f[n]}</p> : null}
        </div>
      ))}
      <div>
        <label htmlFor="b-nachricht" className="label">
          Ein paar Sätze zu Ihnen (optional)
        </label>
        <textarea id="b-nachricht" name="nachricht" rows={3} defaultValue={w("nachricht")} className="feld" />
      </div>
      <div>
        <label htmlFor="b-datei" className="label">
          Lebenslauf (optional, PDF/JPG/PNG, max. 10 MB)
        </label>
        <input id="b-datei" type="file" accept="application/pdf,image/jpeg,image/png" onChange={(e) => hochladen(e.target.files?.[0])} className="block w-full text-sm file:mr-3 file:rounded-sm file:border file:border-tinte file:bg-transparent file:px-3 file:py-2 file:font-semibold" />
        <p className="mt-1 text-sm text-grau">{upload === "laeuft" ? "Wird hochgeladen …" : upload || (datei ? `${datei.name} ist hochgeladen.` : "")}</p>
      </div>
      {zustand.status === "fehler" && zustand.meldung ? <p className="font-semibold text-rot">{zustand.meldung}</p> : null}
      <button type="submit" disabled={sendet || upload === "laeuft"} className="knopf knopf-rot">
        {sendet ? "Wird gesendet …" : "Bewerbung absenden"}
      </button>
    </form>
  );
}
