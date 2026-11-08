import Link from "next/link";
import { Nachricht, Telefon } from "@/components/icons";
import { telHref, whatsappHref } from "@/lib/format";

/** Feste Leiste unten auf dem Telefon: die drei Wege zum Termin, immer mit dem Daumen erreichbar. */
export function MobilLeiste({ telefon, whatsapp }: { telefon: string; whatsapp: string }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-linie bg-papier/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-sm md:hidden">
      <div className="grid grid-cols-[1fr_auto_auto] gap-2 p-2">
        <Link href="/termin" className="knopf knopf-rot">
          Termin anfragen
        </Link>
        <a href={telHref(telefon)} className="knopf knopf-rahmen w-14 px-0" aria-label="Anrufen">
          <Telefon />
        </a>
        <a href={whatsappHref(whatsapp, "Hallo, ich hätte eine Frage zu meinem Auto:")} className="knopf knopf-rahmen w-14 px-0" aria-label="Nachricht per WhatsApp" rel="noopener noreferrer">
          <Nachricht />
        </a>
      </div>
    </div>
  );
}
