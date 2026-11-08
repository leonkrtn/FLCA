"use client";

import Link from "next/link";
import { useActionState } from "react";
import { LEER } from "@/lib/forms";
import { anmelden, passwortSetzen, passwortVergessen } from "./actions";

export function LoginFormular({ weiter, hinweis }: { weiter: string; hinweis?: string }) {
  const [z, aktion, laeuft] = useActionState(anmelden, LEER);
  return (
    <form action={aktion} className="grid gap-4">
      <input type="hidden" name="weiter" value={weiter} />
      <div>
        <label htmlFor="email" className="label">E-Mail</label>
        <input id="email" name="email" type="email" autoComplete="username" defaultValue={z.werte?.email} required className="feld" />
      </div>
      <div>
        <label htmlFor="passwort" className="label">Passwort</label>
        <input id="passwort" name="passwort" type="password" autoComplete="current-password" required className="feld" />
      </div>
      {z.meldung || hinweis ? <p className="text-sm font-semibold text-rot">{z.meldung ?? hinweis}</p> : null}
      <button className="knopf knopf-dunkel" disabled={laeuft}>{laeuft ? "Anmelden …" : "Anmelden"}</button>
      <Link href="/login/passwort-vergessen" className="text-sm text-grau underline">Passwort vergessen</Link>
    </form>
  );
}

export function VergessenFormular() {
  const [z, aktion, laeuft] = useActionState(passwortVergessen, LEER);
  if (z.status === "ok") return <p>{z.meldung}</p>;
  return (
    <form action={aktion} className="grid gap-4">
      <div>
        <label htmlFor="email" className="label">E-Mail</label>
        <input id="email" name="email" type="email" autoComplete="username" required className="feld" />
      </div>
      {z.meldung ? <p className="text-sm font-semibold text-rot">{z.meldung}</p> : null}
      <button className="knopf knopf-dunkel" disabled={laeuft}>Link senden</button>
    </form>
  );
}

export function SetzenFormular() {
  const [z, aktion, laeuft] = useActionState(passwortSetzen, LEER);
  return (
    <form action={aktion} className="grid gap-4">
      <div>
        <label htmlFor="passwort" className="label">Neues Passwort</label>
        <input id="passwort" name="passwort" type="password" autoComplete="new-password" minLength={10} required className="feld" />
      </div>
      <div>
        <label htmlFor="wiederholung" className="label">Wiederholen</label>
        <input id="wiederholung" name="wiederholung" type="password" autoComplete="new-password" required className="feld" />
      </div>
      {z.meldung ? <p className="text-sm font-semibold text-rot">{z.meldung}</p> : null}
      <button className="knopf knopf-dunkel" disabled={laeuft}>Speichern</button>
    </form>
  );
}
