import Link from "next/link";
import { KATEGORIE_FARBEN } from "@/lib/mail/inhalt";
import { ansichtHref, type AnsichtName, type MailAnsicht, ORDNER_TEXT } from "./ansicht";
import type { Kategorie } from "./liste";

export type OrdnerZahlen = Partial<Record<AnsichtName, number>>;

const FIRMA: AnsichtName[] = ["eingang", "sonstige", "entwuerfe", "ausgang", "gesendet", "archiv", "papierkorb"];
const ICH: AnsichtName[] = ["eingang", "entwuerfe", "ausgang", "gesendet", "archiv", "papierkorb"];

/** Ordnerleiste links (am Rechner): Firmenpostfach, eigenes Postfach, Filter und Kategorien. */
export function OrdnerLeiste({
  ansicht,
  basis,
  firma,
  zahlenFirma,
  zahlenIch,
  zugewiesen,
  kategorien,
  eigeneAdresse,
  firmenAdresse,
}: {
  ansicht: MailAnsicht;
  basis: string;
  firma: boolean;
  zahlenFirma: OrdnerZahlen;
  zahlenIch: OrdnerZahlen;
  zugewiesen: number;
  kategorien: Kategorie[];
  eigeneAdresse: string;
  firmenAdresse: string;
}) {
  const eintrag = (p: "firma" | "ich", o: AnsichtName, zahl?: number, k = "") => {
    const aktiv = ansicht.p === p && ansicht.o === o && ansicht.k === k;
    // Ungelesen fett mit Zahl (Posteingang, Sonstige); Entwürfe und Postausgang zählen alle
    const fett = Boolean(zahl) && (o === "eingang" || o === "sonstige");
    return (
      <Link
        key={`${p}-${o}-${k}`}
        href={ansichtHref(basis, ansicht, { p, o, k, g: "", q: "" })}
        aria-current={aktiv ? "page" : undefined}
        className={`flex items-center justify-between gap-2 rounded-sm px-3 py-1.5 text-sm ${aktiv ? "bg-weiss font-semibold shadow-sm" : "hover:bg-weiss/60"} ${fett ? "font-semibold" : ""}`}
      >
        <span className="truncate">{ORDNER_TEXT[o]}</span>
        {zahl ? <span className={`zahlen text-xs ${fett ? "text-rot" : "text-grau"}`}>{zahl}</span> : null}
      </Link>
    );
  };
  const titel = (text: string, adresse: string) => (
    <div className="px-3 pb-1 pt-4">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-grau">{text}</p>
      {adresse ? <p className="truncate text-xs text-grau" title={adresse}>{adresse}</p> : null}
    </div>
  );
  return (
    <nav aria-label="Ordner" className="grid content-start gap-0.5 pb-6">
      {firma ? (
        <>
          {titel("Firma", firmenAdresse)}
          {FIRMA.map((o) => eintrag("firma", o, zahlenFirma[o]))}
          {zahlenFirma.gekennzeichnet ? eintrag("firma", "gekennzeichnet", zahlenFirma.gekennzeichnet) : null}
          {zahlenFirma.spaeter ? eintrag("firma", "spaeter", zahlenFirma.spaeter) : null}
        </>
      ) : null}
      {titel(firma ? "Meine" : "Postfach", eigeneAdresse)}
      {ICH.map((o) => eintrag("ich", o, zahlenIch[o]))}
      {zahlenIch.gekennzeichnet ? eintrag("ich", "gekennzeichnet", zahlenIch.gekennzeichnet) : null}
      {zahlenIch.spaeter ? eintrag("ich", "spaeter", zahlenIch.spaeter) : null}
      {zugewiesen || firma ? eintrag("ich", "zugewiesen", zugewiesen) : null}
      {kategorien.length ? (
        <>
          {titel("Kategorien", "")}
          {kategorien.map((k) => {
            const p = ansicht.p;
            const aktiv = ansicht.k === k.id;
            return (
              <Link
                key={k.id}
                href={ansichtHref(basis, ansicht, { p, o: ansicht.o, k: aktiv ? "" : k.id, g: "" })}
                aria-current={aktiv ? "page" : undefined}
                className={`flex items-center gap-2 rounded-sm px-3 py-1.5 text-sm ${aktiv ? "bg-weiss font-semibold shadow-sm" : "hover:bg-weiss/60"}`}
              >
                <span className="size-2.5 shrink-0 rounded-full" style={{ background: KATEGORIE_FARBEN[k.farbe]?.hex ?? "#8a8a8a" }} />
                <span className="truncate">{k.name}</span>
              </Link>
            );
          })}
        </>
      ) : null}
    </nav>
  );
}
