import { RechnungsAuswahl } from "@/components/admin/rechnungs-auswahl";
import { Kopf, Leer, Reiter } from "@/components/admin/ui";
import { neueRechnung } from "@/lib/aktionen/rechnungen";
import { benutzerMitRecht } from "@/lib/auth";
import { datum } from "@/lib/format";
import { RECHNUNG_STATUS, type Rechnung } from "@/lib/rechnung/rechnungen";
import { db } from "@/lib/supabase/admin";
import { berlinDatum } from "@/lib/zeit";

export const metadata = { title: "Rechnungen" };

export default async function RechnungsListe({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await benutzerMitRecht("rechnungen");
  const { status = "alle" } = await searchParams;
  let q = db().from("rechnungen").select("*").order("erstellt_am", { ascending: false }).limit(300);
  if (status !== "alle") q = q.eq("status", status);
  const { data } = await q;
  const liste = (data ?? []) as Rechnung[];
  const heute = berlinDatum();
  const monat = heute.slice(0, 7);
  const vormonat = new Date(Date.UTC(Number(monat.slice(0, 4)), Number(monat.slice(5, 7)) - 2, 1)).toISOString().slice(0, 7);
  const summe = liste.filter((r) => r.status !== "entwurf").reduce((s, r) => s + Number(r.summe_brutto_cent), 0);
  return (
    <>
      <Kopf titel="Rechnungen" unter="Häkchen setzen, um mehrere Rechnungen auf einmal herunterzuladen, zu senden oder als bezahlt zu markieren.">
        <a href={`/admin/rechnungen/export?monat=${vormonat}`} className="knopf knopf-rahmen">DATEV-Export {vormonat.slice(5)}/{vormonat.slice(0, 4)}</a>
        <form action={neueRechnung.bind(null, null)}>
          <button className="knopf knopf-dunkel">Neue Rechnung</button>
        </form>
      </Kopf>
      <Reiter
        aktiv={`/admin/rechnungen?status=${status}`}
        eintraege={[["alle", "Alle"], ["entwurf", "Entwürfe"], ["gestellt", "Offen"], ["bezahlt", "Bezahlt"], ["storniert", "Storniert"]].map(([k, t]) => ({ href: `/admin/rechnungen?status=${k}`, text: t }))}
      />
      {liste.length ? (
        <RechnungsAuswahl
          summe={summe}
          zeilen={liste.map((r) => {
            const ueberfaellig = r.status === "gestellt" && Boolean(r.faellig_am && r.faellig_am < heute);
            return {
              id: r.id,
              nummer: r.nummer,
              datum: datum(r.rechnungsdatum ?? r.erstellt_am),
              empfaenger: r.empfaenger?.firma || r.empfaenger?.name || "",
              kennzeichen: r.fahrzeug?.kennzeichen ?? "",
              status: r.status,
              statusText: ueberfaellig ? "Überfällig" : r.storno_zu ? "Storno" : RECHNUNG_STATUS[r.status],
              ton: r.status === "bezahlt" ? "ok" : r.status === "gestellt" ? (ueberfaellig ? "rot" : "warnung") : "hell",
              betrag: Number(r.summe_brutto_cent),
              email: Boolean(r.empfaenger?.email),
            };
          })}
        />
      ) : (
        <div className="bg-weiss">
          <Leer>Keine Rechnungen.</Leer>
        </div>
      )}
    </>
  );
}
