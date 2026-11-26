import { notFound } from "next/navigation";
import { KorrekturHinweis, RechnungAnsicht } from "@/components/admin/rechnung-ansicht";
import { BelegEditor } from "@/components/admin/beleg-editor";
import { KostengrenzeHinweis } from "@/components/admin/kostengrenze-hinweis";
import { MobilKopf } from "@/components/mobil/teile";
import { benutzerMitRecht } from "@/lib/auth";
import { kundenSuchen } from "@/lib/kunden";
import { editorDaten } from "@/lib/rechnung/editor-daten";
import { stornoStand } from "@/lib/rechnung/korrektur";
import { WhatsappKnopf } from "@/components/mobil/whatsapp-knopf";
import { whatsappVermerken } from "@/lib/aktionen/whatsapp";
import { rechnungWhatsapp } from "@/lib/whatsapp-daten";
import { bezuegeLaden, korrekturStand, RECHNUNG_STATUS, rechnungLaden } from "@/lib/rechnung/rechnungen";

export default async function AppRechnung({ params }: { params: Promise<{ id: string }> }) {
  await benutzerMitRecht("rechnungen");
  const { id } = await params;
  const r = await rechnungLaden(id);
  if (!r) notFound();
  const [daten, zuletzt, bezuege, korrektur, wa] = await Promise.all([
    r.status === "entwurf" ? editorDaten(r.fahrzeug) : null,
    r.status === "entwurf" ? kundenSuchen("", 6) : [],
    bezuegeLaden(r),
    r.status === "entwurf" ? korrekturStand(r) : null,
    rechnungWhatsapp(r),
  ]);
  return (
    <>
      <MobilKopf titel={r.storno_zu ? `Stornorechnung ${r.nummer}` : r.nummer ? `Rechnung ${r.nummer}` : korrektur ? `Korrektur zu ${korrektur.original}` : "Rechnungsentwurf"} unter={r.storno_zu ? stornoStand(r) : RECHNUNG_STATUS[r.status]} zurueck={r.termin_id ? `/app/termine/${r.termin_id}` : "/app/rechnungen"} />
      <div className="bg-weiss p-4">
        {korrektur ? <KorrekturHinweis k={korrektur} basis="/app/rechnungen" /> : null}
        {r.status === "entwurf" && r.termin_id ? <KostengrenzeHinweis terminId={r.termin_id} summe={r.summe_brutto_cent} basis="/app" /> : null}
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
        {wa ? <WhatsappKnopf href={wa.href} ohneEinwilligung={wa.ohneEinwilligung} vermerken={whatsappVermerken.bind(null, "rechnung", r.id, wa.vorlage)} className="knopf knopf-rahmen mt-4 w-full">Per WhatsApp schicken</WhatsappKnopf> : null}
      </div>
    </>
  );
}
