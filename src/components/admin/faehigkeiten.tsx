"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Formular, Senden } from "@/components/admin/formular";
import { faehigkeitenSpeichern } from "@/lib/aktionen/team";

type L = { id: string; name: string; kategorie: string };
type P = { id: string; name: string };

/**
 * Wer darf was: je Kategorie ein Häkchen pro Person (an = alles, halb = einiges), aufklappen für einzelne
 * Leistungen, Suche über alle. Zugeklappte und weggefilterte Zeilen bleiben im Formular, damit beim Speichern
 * nichts als „darf nicht“ verloren geht. `profil`: nur diese eine Person (Personenseite).
 */
export function FaehigkeitenMatrix({
  leistungen,
  personen,
  gesperrt,
  kategorien,
  profil = null,
}: {
  leistungen: L[];
  personen: P[];
  gesperrt: string[];
  kategorien: Record<string, string>;
  profil?: string | null;
}) {
  const [darf, setDarf] = useState(() => {
    const g = new Set(gesperrt);
    return new Set(personen.flatMap((p) => leistungen.filter((l) => !g.has(`${p.id}_${l.id}`)).map((l) => `${p.id}_${l.id}`)));
  });
  const [offen, setOffen] = useState<Set<string>>(new Set());
  const [suche, setSuche] = useState("");
  const gruppen = useMemo(() => {
    const m = new Map<string, L[]>();
    for (const l of leistungen) m.set(l.kategorie, [...(m.get(l.kategorie) ?? []), l]);
    return [...m.entries()];
  }, [leistungen]);
  const s = suche.trim().toLowerCase();
  const passt = (l: L) => !s || l.name.toLowerCase().includes(s);

  const setzen = (keys: string[], an: boolean) =>
    setDarf((alt) => {
      const neu = new Set(alt);
      for (const k of keys) {
        if (an) neu.add(k);
        else neu.delete(k);
      }
      return neu;
    });
  const umklappen = (k: string) =>
    setOffen((alt) => {
      const neu = new Set(alt);
      if (neu.has(k)) neu.delete(k);
      else neu.add(k);
      return neu;
    });

  return (
    <Formular aktion={faehigkeitenSpeichern.bind(null, profil)}>
      {personen.map((p) => <input key={p.id} type="hidden" name="personen" value={p.id} />)}
      {leistungen.map((l) => <input key={l.id} type="hidden" name="leistungen" value={l.id} />)}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input type="search" value={suche} onChange={(e) => setSuche(e.target.value)} placeholder="Leistung suchen" className="feld max-w-xs" aria-label="Leistung suchen" />
        <button type="button" className="knopf knopf-rahmen knopf-klein" onClick={() => setOffen(new Set(gruppen.map(([k]) => k)))}>
          Alle aufklappen
        </button>
        <button type="button" className="knopf knopf-rahmen knopf-klein" onClick={() => setOffen(new Set())}>
          Alle zuklappen
        </button>
      </div>
      <div className="-mx-4 quer-scrollen md:mx-0">
        <table className="w-full border-collapse text-sm" style={{ minWidth: `${280 + personen.length * 112}px` }}>
          <thead className="sticky top-0 z-10 bg-flaeche">
            <tr className="border-b-2 border-tinte text-left">
              <th className="px-3 py-2 pl-4 font-semibold md:pl-0">Leistung</th>
              {personen.map((p) => (
                <th key={p.id} className="w-28 px-2 py-2 text-center font-semibold">
                  {profil ? "darf" : <Link href={`/admin/mitarbeiter/${p.id}`} className="hover:underline">{p.name}</Link>}
                </th>
              ))}
            </tr>
          </thead>
          {gruppen.map(([kat, liste]) => {
            const sichtbar = liste.filter(passt);
            if (s && !sichtbar.length) return null;
            const auf = offen.has(kat) || Boolean(s);
            return (
              <tbody key={kat} className="border-b border-linie">
                <tr className="bg-papier">
                  <th scope="row" className="py-2 pl-4 pr-3 text-left md:pl-2">
                    <button type="button" onClick={() => umklappen(kat)} aria-expanded={auf} className="flex items-center gap-2 font-semibold">
                      <span aria-hidden className={`inline-block transition-transform ${auf ? "rotate-90" : ""}`}>›</span>
                      {kategorien[kat] ?? kat}
                      <span className="font-normal text-grau">{liste.length}</span>
                    </button>
                  </th>
                  {personen.map((p) => {
                    const keys = liste.map((l) => `${p.id}_${l.id}`);
                    const n = keys.filter((k) => darf.has(k)).length;
                    return (
                      <td key={p.id} className="px-2 py-2 text-center">
                        <label className="inline-flex cursor-pointer items-center gap-1.5">
                          <input
                            type="checkbox"
                            className="size-5 accent-tinte"
                            checked={n === keys.length}
                            ref={(el) => {
                              if (el) el.indeterminate = n > 0 && n < keys.length;
                            }}
                            onChange={(e) => setzen(keys, e.target.checked)}
                            aria-label={`${p.name}: ganze Kategorie ${kategorien[kat] ?? kat}`}
                          />
                          <span className="zahlen w-9 text-left text-xs text-grau">{n}/{keys.length}</span>
                        </label>
                      </td>
                    );
                  })}
                </tr>
                {liste.map((l) => (
                  <tr key={l.id} className={auf && passt(l) ? "border-t border-linie" : "hidden"}>
                    <td className="py-1.5 pl-8 pr-3 md:pl-7">{l.name}</td>
                    {personen.map((p) => {
                      const k = `${p.id}_${l.id}`;
                      return (
                        <td key={p.id} className="px-2 py-1.5 text-center">
                          <input type="checkbox" name={`darf_${k}`} checked={darf.has(k)} onChange={(e) => setzen([k], e.target.checked)} className="size-5 accent-tinte" aria-label={`${p.name}: ${l.name}`} />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            );
          })}
        </table>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Senden vorab="Gespeichert">Fähigkeiten speichern</Senden>
        <span className="text-sm text-grau">Neue Leistungen gelten wie ihre Kategorie: Wer die meisten darf, darf auch die neue.</span>
      </div>
    </Formular>
  );
}
