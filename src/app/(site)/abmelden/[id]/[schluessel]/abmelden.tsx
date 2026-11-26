"use client";

import { useActionState } from "react";
import { LEER } from "@/lib/forms";
import { abmelden } from "./actions";

export function Abmelden({ id, schluessel }: { id: string; schluessel: string }) {
  const [zustand, aktion, laeuft] = useActionState(abmelden.bind(null, id, schluessel), LEER);
  if (zustand.status === "ok") return <p className="text-lg font-semibold" role="status">{zustand.meldung}</p>;
  return (
    <form action={aktion} className="grid gap-3">
      <button type="submit" disabled={laeuft} className="knopf knopf-rot justify-self-start">
        {laeuft ? "Wird gesendet …" : "Jetzt abmelden"}
      </button>
      {zustand.status === "fehler" ? <p className="text-fehler">{zustand.meldung}</p> : null}
    </form>
  );
}
