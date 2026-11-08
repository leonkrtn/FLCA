"use client";

import { useActionState, useState } from "react";
import { kundeStorniert } from "@/app/(site)/t/[token]/actions";
import { LEER } from "@/lib/forms";

export function AbsageKnopf({ token }: { token: string }) {
  const [sicher, setSicher] = useState(false);
  const [zustand, aktion, laeuft] = useActionState(kundeStorniert.bind(null, token), LEER);
  if (zustand.status === "ok") return <p className="w-full font-semibold">{zustand.meldung}</p>;
  return (
    <div className="flex flex-wrap items-center gap-3">
      {sicher ? (
        <form action={aktion} className="flex flex-wrap items-center gap-3">
          <span className="font-semibold">Termin wirklich absagen?</span>
          <button type="submit" disabled={laeuft} className="knopf knopf-dunkel">
            {laeuft ? "Wird abgesagt …" : "Ja, absagen"}
          </button>
          <button type="button" onClick={() => setSicher(false)} className="knopf knopf-rahmen">
            Nein
          </button>
        </form>
      ) : (
        <button type="button" onClick={() => setSicher(true)} className="knopf knopf-rahmen">
          Termin absagen
        </button>
      )}
      {zustand.status === "fehler" ? <p className="w-full text-rot">{zustand.meldung}</p> : null}
    </div>
  );
}
