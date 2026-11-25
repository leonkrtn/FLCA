"use client";

import { useRouter } from "next/navigation";
import { ansichtHref, type AnsichtName, type MailAnsicht, ORDNER_TEXT } from "./ansicht";
import type { Kategorie } from "./liste";
import type { OrdnerZahlen } from "./ordner";

/** Ordnerwahl am Handy: eine Auswahl oben statt der Leiste (Firma, eigenes Postfach, Filter, Kategorien). */
export function OrdnerMenue({ ansicht, basis, firma, zahlenFirma, zahlenIch, kategorien }: { ansicht: MailAnsicht; basis: string; firma: boolean; zahlenFirma: OrdnerZahlen; zahlenIch: OrdnerZahlen; kategorien: Kategorie[] }) {
  const router = useRouter();
  const ordner = (p: "firma" | "ich"): AnsichtName[] => [
    "eingang",
    ...(p === "firma" ? (["sonstige"] as AnsichtName[]) : []),
    "entwuerfe",
    "ausgang",
    "gesendet",
    "archiv",
    "papierkorb",
    "gekennzeichnet",
    "spaeter",
    ...(p === "ich" ? (["zugewiesen"] as AnsichtName[]) : []),
  ];
  const text = (o: AnsichtName, z: OrdnerZahlen) => `${ORDNER_TEXT[o]}${z[o] ? ` (${z[o]})` : ""}`;
  const wert = ansicht.k ? `k:${ansicht.k}` : `${ansicht.p}:${ansicht.o}`;
  return (
    <select
      aria-label="Ordner"
      value={wert}
      onChange={(e) => {
        const [a, b] = e.target.value.split(":");
        router.push(a === "k" ? ansichtHref(basis, ansicht, { k: b, g: "" }) : ansichtHref(basis, ansicht, { p: a as "firma" | "ich", o: b as AnsichtName, k: "", g: "", q: "" }));
      }}
      className="feld min-h-10 font-semibold"
    >
      {firma ? (
        <optgroup label="Firma">
          {ordner("firma").map((o) => (
            <option key={`firma:${o}`} value={`firma:${o}`}>{text(o, zahlenFirma)}</option>
          ))}
        </optgroup>
      ) : null}
      <optgroup label={firma ? "Meine" : "Postfach"}>
        {ordner("ich").map((o) => (
          <option key={`ich:${o}`} value={`ich:${o}`}>{text(o, zahlenIch)}</option>
        ))}
      </optgroup>
      {kategorien.length ? (
        <optgroup label="Kategorien">
          {kategorien.map((k) => (
            <option key={k.id} value={`k:${k.id}`}>{k.name}</option>
          ))}
        </optgroup>
      ) : null}
    </select>
  );
}
