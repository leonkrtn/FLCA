"use client";

import { useActionState } from "react";
import { auftragOnlineErteilen } from "@/app/(site)/t/[token]/actions";
import { LEER } from "@/lib/forms";

/** Auftrag online erteilen: Name und Häkchen, damit ein versehentlicher Tipp auf dem Handy nichts auslöst. */
export function AuftragErteilen({ token, name }: { token: string; name: string }) {
  const [zustand, aktion, laeuft] = useActionState(auftragOnlineErteilen.bind(null, token), LEER);
  if (zustand.status === "ok") return <p className="text-lg font-semibold" role="status">{zustand.meldung}</p>;
  return (
    <form action={aktion} className="grid max-w-md gap-4">
      <label className="block">
        <span className="label">Ihr Name</span>
        <input name="name" defaultValue={zustand.werte?.name ?? name} required autoComplete="name" className="feld" />
      </label>
      <label className="flex cursor-pointer items-start gap-3">
        <input type="checkbox" name="einverstanden" required className="mt-1 size-5 shrink-0 accent-tinte" />
        <span>Ich erteile den Auftrag zu den genannten Arbeiten und Bedingungen.</span>
      </label>
      <button type="submit" disabled={laeuft} className="knopf knopf-rot justify-self-start">
        {laeuft ? "Wird gesendet …" : "Auftrag verbindlich erteilen"}
      </button>
      {zustand.status === "fehler" ? <p className="text-fehler">{zustand.meldung}</p> : null}
    </form>
  );
}
