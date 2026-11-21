"use client";

import { useActionState } from "react";
import { vorschlagBeantworten } from "@/app/(site)/t/[token]/actions";
import { LEER } from "@/lib/forms";

/** Zwei Knöpfe für den Gegenvorschlag: passt / passt nicht. */
export function VorschlagAntwort({ token }: { token: string }) {
  const [ja, jaSenden, jaLaeuft] = useActionState(vorschlagBeantworten.bind(null, token, true), LEER);
  const [nein, neinSenden, neinLaeuft] = useActionState(vorschlagBeantworten.bind(null, token, false), LEER);
  const fertig = [ja, nein].find((z) => z.status === "ok");
  if (fertig) return <p className="w-full font-semibold">{fertig.meldung}</p>;
  const fehler = [ja, nein].find((z) => z.status === "fehler");
  const laeuft = jaLaeuft || neinLaeuft;
  return (
    <div className="flex w-full flex-wrap items-center gap-3">
      <form action={jaSenden}>
        <button type="submit" disabled={laeuft} className="knopf knopf-rot">
          {jaLaeuft ? "Wird bestätigt …" : "Passt, Termin annehmen"}
        </button>
      </form>
      <form action={neinSenden}>
        <button type="submit" disabled={laeuft} className="knopf knopf-rahmen">
          {neinLaeuft ? "Wird gesendet …" : "Passt nicht"}
        </button>
      </form>
      {fehler ? <p className="w-full text-fehler">{fehler.meldung}</p> : null}
    </div>
  );
}
