"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Nachricht, Telefon } from "@/components/icons";
import { telHref, whatsappHref } from "@/lib/format";

/** Feste Leiste unten auf dem Telefon: die drei Wege zum Termin, immer mit dem Daumen erreichbar. */
export function MobilLeiste({ telefon, whatsapp }: { telefon: string; whatsapp: string }) {
  // Auf der Terminseite selbst wäre „Termin anfragen“ ein Knopf, der nirgendwohin führt.
  const aufTermin = usePathname() === "/termin";
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-linie bg-papier/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-sm md:hidden">
      <div className={`grid gap-2 p-2 ${aufTermin ? "grid-cols-2" : "grid-cols-[1fr_auto_auto]"}`}>
        {aufTermin ? null : (
          <Link href="/termin" className="knopf knopf-rot">
            Termin anfragen
          </Link>
        )}
        <a href={telHref(telefon)} className={`knopf knopf-rahmen ${aufTermin ? "" : "w-14 px-0"}`} aria-label="Anrufen">
          <Telefon /> {aufTermin ? "Anrufen" : null}
        </a>
        <a href={whatsappHref(whatsapp, "Hallo, ich hätte eine Frage zu meinem Auto:")} className={`knopf knopf-rahmen ${aufTermin ? "" : "w-14 px-0"}`} aria-label="Nachricht per WhatsApp" rel="noopener noreferrer">
          <Nachricht /> {aufTermin ? "WhatsApp" : null}
        </a>
      </div>
    </div>
  );
}
