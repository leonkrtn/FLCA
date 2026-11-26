"use client";

import Link from "next/link";
import { useActionState } from "react";
import { auftragOnlineErteilen } from "@/app/(site)/t/[token]/actions";
import { LEER } from "@/lib/forms";

/**
 * Auftrag online erteilen. Online beauftragt ein Verbraucher im Fernabsatz, deshalb gilt:
 * - Knopf eindeutig „zahlungspflichtig“ (§ 312j Abs. 3 BGB), sonst kommt kein Vertrag zustande.
 * - AGB mit Link direkt davor, sonst gelten sie nicht (§ 305 Abs. 2 BGB).
 * - Widerrufsbelehrung verlinkt, und der Kunde verlangt ausdrücklich, dass wir vor Ablauf der Widerrufsfrist
 *   anfangen, und weiß, dass sein Widerrufsrecht mit vollständiger Ausführung erlischt (§ 356 Abs. 4 BGB).
 *   Ohne dieses Häkchen dürften wir 14 Tage lang nicht anfangen; deshalb ist es Pflicht.
 * Die Bestätigung mit Belehrung kommt danach per Mail (auftrag.ts, kundeBestaetigen).
 */
export function AuftragErteilen({ token, name }: { token: string; name: string }) {
  const [zustand, aktion, laeuft] = useActionState(auftragOnlineErteilen.bind(null, token), LEER);
  if (zustand.status === "ok") return <p className="text-lg font-semibold" role="status">{zustand.meldung}</p>;
  return (
    <form action={aktion} className="grid max-w-xl gap-4">
      <label className="block">
        <span className="label">Ihr Name</span>
        <input name="name" defaultValue={zustand.werte?.name ?? name} required autoComplete="name" className="feld" />
      </label>
      <label className="flex cursor-pointer items-start gap-3">
        <input type="checkbox" name="einverstanden" required className="mt-1 size-5 shrink-0 accent-tinte" />
        <span>
          Ich erteile den Auftrag zu den genannten Arbeiten und Preisen. Es gelten die{" "}
          <Link href="/agb" target="_blank" className="underline">
            Allgemeinen Geschäftsbedingungen
          </Link>
          .
        </span>
      </label>
      <label className="flex cursor-pointer items-start gap-3">
        <input type="checkbox" name="vorab" required className="mt-1 size-5 shrink-0 accent-tinte" />
        <span>
          Ich verlange ausdrücklich, dass Sie vor Ablauf der Widerrufsfrist mit den Arbeiten beginnen. Mir ist bekannt, dass mein Widerrufsrecht erlischt, sobald der Auftrag vollständig ausgeführt ist, und dass ich bei einem Widerruf die bis dahin erbrachten Arbeiten anteilig bezahle (
          <Link href="/widerruf" target="_blank" className="underline">
            Widerrufsbelehrung
          </Link>
          ).
        </span>
      </label>
      <button type="submit" disabled={laeuft} className="knopf knopf-rot justify-self-start">
        {laeuft ? "Wird gesendet …" : "Zahlungspflichtig beauftragen"}
      </button>
      {zustand.status === "fehler" ? <p className="text-fehler">{zustand.meldung}</p> : null}
    </form>
  );
}
