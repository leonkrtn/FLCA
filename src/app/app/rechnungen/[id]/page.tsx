import { notFound } from "next/navigation";
import { RechnungAnsicht } from "@/components/admin/rechnung-ansicht";
import { BelegEditor } from "@/components/admin/beleg-editor";
import { MobilKopf } from "@/components/mobil/teile";
import { benutzerMitRecht } from "@/lib/auth";
import { kundenSuchen } from "@/lib/kunden";
import { editorDaten } from "@/lib/rechnung/editor-daten";
import { RECHNUNG_STATUS, rechnungLaden } from "@/lib/rechnung/rechnungen";

export default async function AppRechnung({ params }: { params: Promise<{ id: string }> }) {
  await benutzerMitRecht("rechnungen");
  const { id } = await params;
  const r = await rechnungLaden(id);
  if (!r) notFound();
  const [daten, zuletzt] = await Promise.all([r.status === "entwurf" ? editorDaten(r.fahrzeug) : null, r.status === "entwurf" ? kundenSuchen("", 6) : []]);
  return (
    <>
      <MobilKopf titel={r.storno_zu ? `Stornorechnung ${r.nummer}` : r.nummer ? `Rechnung ${r.nummer}` : "Rechnungsentwurf"} unter={RECHNUNG_STATUS[r.status]} zurueck={r.termin_id ? `/app/termine/${r.termin_id}` : "/app/rechnungen"} />
      <div className="bg-weiss p-4">
        {r.status === "entwurf" ? (
          <BelegEditor
            art="rechnung"
            kompakt
            id={r.id}
            daten={daten!}
            zuletzt={zuletzt}
            start={{ kunde_id: r.kunde_id, empfaenger: r.empfaenger as Record<string, string>, fahrzeug: r.fahrzeug ?? {}, positionen: r.positionen, leistungsdatum: r.leistungsdatum, hinweis: r.hinweis }}
          />
        ) : (
          <RechnungAnsicht r={r} basis="/app/rechnungen" pdfHref={`/admin/rechnungen/${r.id}/pdf`} />
        )}
      </div>
    </>
  );
}
