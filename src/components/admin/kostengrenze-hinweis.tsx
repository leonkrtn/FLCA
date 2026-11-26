import Link from "next/link";
import { ueberKostengrenze } from "@/lib/auftrag-regeln";
import { euro } from "@/lib/format";
import { db } from "@/lib/supabase/admin";

/**
 * Am Rechnungsentwurf zum Termin: Liegt die Rechnung über dem, was der Kunde freigegeben hat (Kostengrenze des
 * Auftrags oder später zugestimmte Mehrkosten), schuldet er den Mehrbetrag ohne nachweisbare Zustimmung nicht.
 * Kein Sperren: Die Zustimmung kann am Auftrag nachgetragen werden.
 */
export async function KostengrenzeHinweis({ terminId, summe, basis }: { terminId: string; summe: number; basis: "/admin" | "/app" }) {
  const { data: t } = await db().from("termine").select("auftrag_kostengrenze_cent, auftrag_freigabe_bis_cent").eq("id", terminId).maybeSingle();
  if (!t) return null;
  const mehr = ueberKostengrenze({ ...t, auftrag_summe_brutto_cent: summe });
  if (!mehr) return null;
  return (
    <p className="mb-4 rounded-lg bg-flaeche p-3 text-sm font-semibold text-rot">
      Die Rechnung liegt {euro(mehr)} über dem, was der Kunde freigegeben hat (Kostengrenze des Auftrags). Den Mehrbetrag schuldet er nur mit Zustimmung:{" "}
      <Link href={`${basis}/termine/${terminId}`} className="underline">
        am Auftrag eintragen
      </Link>
      , wie er zugestimmt hat.
    </p>
  );
}
