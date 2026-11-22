import { notFound } from "next/navigation";
import { KorrekturHinweis, RechnungAnsicht } from "@/components/admin/rechnung-ansicht";
import { BelegEditor } from "@/components/admin/beleg-editor";
import { MobilKopf } from "@/components/mobil/teile";
import { benutzerMitRecht } from "@/lib/auth";
import { kundenSuchen } from "@/lib/kunden";
import { editorDaten } from "@/lib/rechnung/editor-daten";
import { bezuegeLaden, korrekturStand, RECHNUNG_STATUS, rechnungLaden } from "@/lib/rechnung/rechnungen";

export default async function AppRechnung({ params }: { params: Promise<{ id: string }> }) {
  await benutzerMitRecht("rechnungen");
  const { id } = await params;
  const r = await rechnungLaden(id);
  if (!r) notFound();
  const [daten, zuletzt, bezuege, korrektur] = await Promise.all([
    r.status === "entwurf" ? editorDaten(r.fahrzeug) : null,
    r.status === "entwurf" ? kundenSuchen("", 6) : [],
    bezuegeLaden(r),
    r.status === "entwurf" ? korrekturStand(r) : null,
  ]);
  return (
    <>
      <MobilKopf titel={r.storno_zu ? `Stornorechnung ${r.nummer}` : r.nummer ? `Rechnung ${r.nummer}` : korrektur ? `Korrektur zu ${korrektur.original}` : "Rechnungsentwurf"} unter={RECHNUNG_STATUS[r.status]} zurueck={r.termin_id ? `/app/termine/${r.termin_id}` : "/app/rechnungen"} />
      <div className="bg-weiss p-4">
        {korrektur ? <KorrekturHinweis k={korrektur} basis="/app/rechnungen" /> : null}
        {r.status === "entwurf" ? (
          <BelegEditor
            art="rechnung"
            kompakt
            korrektur={korrektur ?? undefined}
            id={r.id}
            daten={daten!}
            zuletzt={zuletzt}
            start={{ kunde_id: r.kunde_id, empfaenger: r.empfaenger as Record<string, string>, fahrzeug: r.fahrzeug ?? {}, positionen: r.positionen, leistungsdatum: r.leistungsdatum, hinweis: r.hinweis }}
          />
        ) : (
          <RechnungAnsicht r={r} basis="/app/rechnungen" pdfHref={`/admin/rechnungen/${r.id}/pdf`} bezuege={bezuege} />
        )}
      </div>
    </>
  );
}
