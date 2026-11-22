import Link from "next/link";
import { Kopf, Leer, Marke, Reiter, Tabelle } from "@/components/admin/ui";
import { AUFTRAG_STAND_TEXT, AUFTRAG_STAND_TON, auftragStand } from "@/lib/auftrag-regeln";
import { benutzerMitRecht } from "@/lib/auth";
import { datumKurzText, zeit } from "@/lib/format";
import { TERMIN_TON } from "@/lib/status";
import { db } from "@/lib/supabase/admin";
import { STATUS_TEXT, TERMIN_FELDER, type Termin } from "@/lib/termine";

export const metadata = { title: "Termine" };

const ANSICHTEN = {
  anfragen: "Anfragen",
  kommend: "Kommend",
  auftraege: "Aufträge",
  vergangen: "Vergangen",
  alle: "Alle",
} as const;

export default async function TerminListe({ searchParams }: { searchParams: Promise<{ ansicht?: string; q?: string }> }) {
  await benutzerMitRecht("termine");
  const { ansicht: a = "anfragen", q = "" } = await searchParams;
  const ansicht = (a in ANSICHTEN ? a : "anfragen") as keyof typeof ANSICHTEN;
  const jetzt = new Date().toISOString();

  let abfrage = db().from("termine").select(TERMIN_FELDER).limit(200);
  if (ansicht === "anfragen") abfrage = abfrage.eq("status", "angefragt").order("beginn");
  if (ansicht === "kommend") abfrage = abfrage.eq("status", "bestaetigt").gte("ende", jetzt).order("beginn");
  // Offene Werkstattaufträge: angelegt, Termin noch nicht abgeschlossen
  if (ansicht === "auftraege") abfrage = abfrage.not("auftrag_nummer", "is", null).in("status", ["angefragt", "bestaetigt"]).order("beginn");
  if (ansicht === "vergangen") abfrage = abfrage.lt("beginn", jetzt).order("beginn", { ascending: false });
  if (ansicht === "alle") abfrage = abfrage.order("beginn", { ascending: false });
  const { data } = await abfrage;
  let termine = (data ?? []) as Termin[];
  if (q) {
    const s = q.toLowerCase();
    termine = termine.filter((t) => [t.kunde?.name, t.kunde?.telefon, t.fahrzeug?.kennzeichen, t.leistung_name, String(t.nummer)].some((x) => x?.toLowerCase().includes(s)));
  }
  const { count: anfragen } = await db().from("termine").select("id", { count: "exact", head: true }).eq("status", "angefragt");

  return (
    <>
      <Kopf titel="Termine">
        <Link href="/admin/auftraege/neu" className="knopf knopf-rahmen">Neuer Auftrag</Link>
        <Link href="/admin/termine/neu" className="knopf knopf-dunkel">Termin eintragen</Link>
      </Kopf>
      <Reiter
        aktiv={`/admin/termine?ansicht=${ansicht}`}
        eintraege={Object.entries(ANSICHTEN).map(([k, t]) => ({ href: `/admin/termine?ansicht=${k}`, text: t, anzahl: k === "anfragen" ? (anfragen ?? 0) : undefined }))}
      />
      <form className="mb-4 max-w-sm">
        <input type="hidden" name="ansicht" value={ansicht} />
        <input name="q" defaultValue={q} placeholder="Suche: Name, Kennzeichen, Telefon, Nr." className="feld" aria-label="Suche" />
      </form>
      {termine.length ? (
        <div className="bg-weiss p-4 md:p-6">
          <Tabelle kopf={["Wann", "Leistung", "Kunde", "Kennzeichen", "Status", "Auftrag", "Mitarbeiter", { text: "Nr.", zahl: true }]}>
            {termine.map((t) => (
              <tr key={t.id} className="hover:bg-papier">
                <td className="zahlen whitespace-nowrap">
                  <Link href={`/admin/termine/${t.id}`} className="font-semibold hover:underline">
                    {datumKurzText(t.beginn)} {zeit(t.beginn)}
                  </Link>
                </td>
                <td>{t.leistung_name}</td>
                <td>{t.kunde?.name}</td>
                <td className="zahlen whitespace-nowrap">{t.fahrzeug?.kennzeichen}</td>
                <td>
                  <Marke ton={TERMIN_TON[t.status]}>{STATUS_TEXT[t.status]}</Marke>
                  {t.status === "angefragt" && t.vorschlag_am ? <span className="block text-xs text-grau">Vorschlag beim Kunden</span> : t.status === "angefragt" && t.wunschzeit_frei === false ? <span className="block text-xs text-grau">Wunschzeit belegt</span> : null}
                </td>
                <td>
                  {auftragStand(t) === "kein" ? (
                    <span className="text-grau">–</span>
                  ) : (
                    <>
                      <Marke ton={AUFTRAG_STAND_TON[auftragStand(t)]}>{AUFTRAG_STAND_TEXT[auftragStand(t)]}</Marke>
                      <span className="zahlen block text-xs text-grau">{t.auftrag_nummer}</span>
                    </>
                  )}
                </td>
                <td>{t.mitarbeiter?.name ?? <span className="text-grau">–</span>}</td>
                <td className="zahl">{t.nummer}</td>
              </tr>
            ))}
          </Tabelle>
        </div>
      ) : (
        <Leer>{ansicht === "anfragen" ? "Keine offenen Anfragen." : ansicht === "auftraege" ? "Keine offenen Werkstattaufträge." : "Keine Termine."}</Leer>
      )}
    </>
  );
}
