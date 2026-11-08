import { notFound } from "next/navigation";
import { RechnungAnsicht } from "@/components/admin/rechnung-ansicht";
import { RechnungEditor } from "@/components/admin/rechnung-editor";
import { MobilKopf } from "@/components/mobil/teile";
import { benutzerMitRecht } from "@/lib/auth";
import { angebotFuerRechnung, RECHNUNG_STATUS, rechnungLaden } from "@/lib/rechnung/rechnungen";

export default async function AppRechnung({ params }: { params: Promise<{ id: string }> }) {
  await benutzerMitRecht("rechnungen");
  const { id } = await params;
  const r = await rechnungLaden(id);
  if (!r) notFound();
  const angebot = await angebotFuerRechnung();
  return (
    <>
      <MobilKopf titel={r.nummer ? `Rechnung ${r.nummer}` : "Rechnung"} unter={RECHNUNG_STATUS[r.status]} zurueck={r.termin_id ? `/app/termine/${r.termin_id}` : "/app/rechnungen"} />
      <div className="bg-weiss p-4">
        {r.status === "entwurf" ? (
          <RechnungEditor
            kompakt
            id={r.id}
            angebot={angebot}
            start={{ empfaenger: r.empfaenger as Record<string, string>, fahrzeug: r.fahrzeug ?? {}, positionen: r.positionen, leistungsdatum: r.leistungsdatum, hinweis: r.hinweis }}
          />
        ) : (
          <RechnungAnsicht r={r} basis="/app/rechnungen" pdfHref={`/admin/rechnungen/${r.id}/pdf`} />
        )}
      </div>
    </>
  );
}
