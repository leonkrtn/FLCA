import { notFound, redirect } from "next/navigation";
import { BelegEditor } from "@/components/admin/beleg-editor";
import { Abschnitt, Kopf, Marke } from "@/components/admin/ui";
import { auftragLaden } from "@/lib/auftrag";
import { AUFTRAG_STAND_TEXT, AUFTRAG_STAND_TON, auftragStand } from "@/lib/auftrag-regeln";
import { benutzerMitRecht } from "@/lib/auth";
import { kalLesen, mitKal } from "@/lib/kalender-ansicht";
import { markeUndModell } from "@/lib/kunden";
import { editorDaten } from "@/lib/rechnung/editor-daten";

export const metadata = { title: "Werkstattauftrag" };

/** Positionen und Kostengrenze des Werkstattauftrags, mit Preisliste und gemerkten Preisen wie im Beleg. */
export default async function AuftragBearbeiten({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ kal?: string }> }) {
  await benutzerMitRecht("termine");
  const { id } = await params;
  const kal = kalLesen((await searchParams).kal);
  const t = await auftragLaden(id);
  if (!t) notFound();
  if (!t.auftrag_nummer) redirect(mitKal(`/admin/termine/${id}`, kal));
  const fahrzeug = { kennzeichen: t.fahrzeug?.kennzeichen, ...(t.fahrzeugVoll ? markeUndModell(t.fahrzeugVoll) : {}), km: t.km_stand };
  const stand = auftragStand(t);
  return (
    <>
      <Kopf
        titel={`Werkstattauftrag ${t.auftrag_nummer}`}
        unter={
          <span className="flex flex-wrap items-center gap-2">
            <Marke ton={AUFTRAG_STAND_TON[stand]}>{AUFTRAG_STAND_TEXT[stand]}</Marke>
            <span>{[t.kunde?.name, t.fahrzeug?.kennzeichen, t.leistung_name].filter(Boolean).join(" · ")}</span>
          </span>
        }
        zurueck={{ href: mitKal(`/admin/termine/${id}`, kal), text: "Termin" }}
      />
      <Abschnitt className="min-w-0">
        {stand === "erteilt" ? <p className="mb-6 text-sm text-grau">Der Auftrag ist erteilt. Ergänzungen sind möglich; liegt die Summe über der Kostengrenze, bitte vorher mit dem Kunden sprechen.</p> : null}
        <BelegEditor
          art="auftrag"
          id={id}
          daten={await editorDaten(fahrzeug)}
          zuletzt={[]}
          start={{ kunde_id: t.kunde?.id ?? null, empfaenger: {}, fahrzeug, positionen: t.auftrag_positionen ?? [], kostengrenze_cent: t.auftrag_kostengrenze_cent ?? null, hinweis: "" }}
        />
      </Abschnitt>
    </>
  );
}
