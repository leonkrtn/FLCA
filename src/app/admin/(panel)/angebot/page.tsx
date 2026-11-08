import Link from "next/link";
import { Kopf, Leer, Marke, Reiter } from "@/components/admin/ui";
import { benutzerMitRecht } from "@/lib/auth";
import { euro } from "@/lib/format";
import { KATEGORIEN } from "@/lib/inhalte";
import { db } from "@/lib/supabase/admin";
import type { Leistung } from "@/lib/termine";

export const metadata = { title: "Angebot" };

const ANSICHTEN = { aktiv: "Aktiv", inaktiv: "Ausgeblendet", alle: "Alle" } as const;

/** Spalten der Liste, einmal festgelegt für Kopf und Zeilen, damit alles untereinander steht. */
const SPALTEN = "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 md:grid-cols-[6.5rem_minmax(0,1fr)_5.5rem_4.5rem_7.5rem]";

const netto = (l: Leistung) => Math.round((l.preis_cent ?? 0) / (1 + Number(l.mwst_satz ?? 19) / 100));

/**
 * Das Angebot: eine einzige Liste für Website, Terminbuchung und Rechnungen. Ein Preis steht nur an
 * einer Stelle, die Website und die Rechnung zum Termin nehmen denselben. Gruppiert nach dem, wo eine
 * Position auftaucht: online buchbar, nur auf der Website, nur intern, Teile und Material.
 */
export default async function AngebotSeite({ searchParams }: { searchParams: Promise<{ ansicht?: string; q?: string }> }) {
  await benutzerMitRecht("rechnungen");
  const sp = await searchParams;
  const ansicht = (sp.ansicht && sp.ansicht in ANSICHTEN ? sp.ansicht : "aktiv") as keyof typeof ANSICHTEN;
  const q = (sp.q ?? "").trim().toLowerCase();
  const { data, error } = await db().from("leistungen").select("*").order("sortierung");
  const alle = (data ?? []) as Leistung[];
  // Vor der Migration „angebot“ fehlen die neuen Spalten. Dann lieber klar sagen, was zu tun ist.
  const unmigriert = !error && alle.length > 0 && alle[0].art === undefined;

  const liste = alle
    .filter((l) => (ansicht === "aktiv" ? l.aktiv !== false : ansicht === "inaktiv" ? l.aktiv === false : true))
    .filter((l) => !q || [l.name, l.nummer, KATEGORIEN[l.kategorie]].some((x) => x?.toLowerCase().includes(q)));
  const leistung = (l: Leistung) => (l.art ?? "leistung") === "leistung";
  const gruppen = [
    { titel: "Online buchbar", hinweis: "auf der Website, Kunden wählen direkt eine Zeit", eintraege: liste.filter((l) => leistung(l) && l.sichtbar && l.online_anfragbar) },
    { titel: "Auf der Website, Termin nach Absprache", hinweis: "mit Preis sichtbar, Termin per Telefon", eintraege: liste.filter((l) => leistung(l) && l.sichtbar && !l.online_anfragbar) },
    { titel: "Nur intern", hinweis: "für Termine und Rechnungen, nicht auf der Website", eintraege: liste.filter((l) => leistung(l) && !l.sichtbar) },
    { titel: "Teile, Material, Zuschläge", hinweis: "nur für Rechnungen", eintraege: liste.filter((l) => !leistung(l)) },
  ].filter((g) => g.eintraege.length);

  const link = (extra: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ ansicht: ansicht === "aktiv" ? undefined : ansicht, q: sp.q || undefined, ...extra })) if (v) p.set(k, v);
    const s = p.toString();
    return `/admin/angebot${s ? `?${s}` : ""}`;
  };

  return (
    <>
      <Kopf titel="Angebot" unter="Leistungen und Preise für Website, Terminbuchung und Rechnungen. Jeder Preis steht nur hier.">
        <Link href="/admin/angebot/neu" className="knopf knopf-dunkel">
          Neue Position
        </Link>
      </Kopf>

      {unmigriert || error ? (
        <p className="mb-6 border-l-2 border-rot bg-weiss px-4 py-3">
          Die Datenbank ist noch nicht auf dem neuen Stand. Bitte im Supabase SQL-Editor <span className="font-semibold">supabase/migrations/20261109100000_angebot.sql</span> ausführen.
        </p>
      ) : null}

      <Reiter aktiv={link({})} eintraege={Object.entries(ANSICHTEN).map(([k, t]) => ({ href: link({ ansicht: k === "aktiv" ? undefined : k }), text: t }))} />

      <form className="mb-6 max-w-sm" action="/admin/angebot">
        {ansicht !== "aktiv" ? <input type="hidden" name="ansicht" value={ansicht} /> : null}
        <input name="q" defaultValue={sp.q} placeholder="Suche: Bezeichnung, Nummer, Kategorie" className="feld" aria-label="Suche" />
      </form>

      {gruppen.length ? (
        gruppen.map((g) => (
          <section key={g.titel} className="mb-8 bg-weiss">
            <div className="flex h-12 items-center justify-between gap-4 border-b border-linie px-4 md:px-6">
              <h2 className="truncate font-semibold">
                {g.titel} <span className="font-normal tabular-nums text-grau">{g.eintraege.length}</span>
              </h2>
              <span className="hidden truncate text-sm text-grau sm:block">{g.hinweis}</span>
            </div>
            <div className={`${SPALTEN} hidden border-b-2 border-tinte px-4 py-2 text-sm font-semibold md:grid md:px-6`}>
              <span>Nr.</span>
              <span>Bezeichnung</span>
              <span>Einheit</span>
              <span className="text-right">MwSt.</span>
              <span className="text-right">Preis</span>
            </div>
            <ul className="divide-y divide-linie">
              {g.eintraege.map((l) => (
                <li key={l.id}>
                  <Link href={`/admin/angebot/${l.id}`} className={`${SPALTEN} min-h-16 px-4 py-3 transition-colors hover:bg-papier md:px-6 ${l.aktiv === false ? "text-grau" : ""}`}>
                    <span className="hidden truncate text-sm tabular-nums text-grau md:block">{l.nummer || "–"}</span>
                    <span className="min-w-0">
                      <span className="flex items-center gap-2">
                        <span className="truncate font-semibold">{l.name}</span>
                        {l.aktiv === false ? <Marke ton="hell">ausgeblendet</Marke> : null}
                      </span>
                      <span className="block truncate text-sm text-grau">
                        {leistung(l) ? [KATEGORIEN[l.kategorie], `${l.dauer_min} min`].filter(Boolean).join(" · ") : "Teil oder Zuschlag"}
                        {/* Nummer und Einheit haben am Rechner eigene Spalten, auf dem Telefon stehen sie hier. */}
                        <span className="md:hidden">
                          {l.nummer ? ` · Nr. ${l.nummer}` : ""} · {l.einheit ?? "Pauschal"}
                        </span>
                      </span>
                    </span>
                    <span className="hidden text-grau md:block">{l.einheit ?? "Pauschal"}</span>
                    <span className="hidden text-right tabular-nums text-grau md:block">{Number(l.mwst_satz ?? 19)} %</span>
                    <span className="text-right">
                      {l.preis_cent === null ? (
                        <span className="block text-grau">auf Anfrage</span>
                      ) : (
                        <>
                          <span className="block font-semibold tabular-nums">
                            {l.preis_ab ? <span className="font-normal text-grau">ab </span> : null}
                            {euro(l.preis_cent)}
                          </span>
                          <span className="block text-xs tabular-nums text-grau">netto {euro(netto(l))}</span>
                        </>
                      )}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))
      ) : (
        <div className="bg-weiss">
          <Leer>{q ? "Keine Position passt zur Suche." : "Noch keine Positionen. Legen Sie die erste an."}</Leer>
        </div>
      )}
    </>
  );
}
