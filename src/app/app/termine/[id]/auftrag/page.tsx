import { notFound, redirect } from "next/navigation";
import { BelegEditor } from "@/components/admin/beleg-editor";
import { MobilKopf } from "@/components/mobil/teile";
import { auftragLaden } from "@/lib/auftrag";
import { AUFTRAG_STAND_TEXT, auftragStand } from "@/lib/auftrag-regeln";
import { benutzerMitRecht } from "@/lib/auth";
import { markeUndModell } from "@/lib/kunden";
import { editorDaten } from "@/lib/rechnung/editor-daten";

export const metadata = { title: "Werkstattauftrag" };

export default async function AppAuftragBearbeiten({ params }: { params: Promise<{ id: string }> }) {
  await benutzerMitRecht("termine");
  const { id } = await params;
  const t = await auftragLaden(id);
  if (!t) notFound();
  if (!t.auftrag_nummer) redirect(`/app/termine/${id}`);
  const fahrzeug = { kennzeichen: t.fahrzeug?.kennzeichen, ...(t.fahrzeugVoll ? markeUndModell(t.fahrzeugVoll) : {}), km: t.km_stand };
  return (
    <>
      <MobilKopf titel={`Auftrag ${t.auftrag_nummer}`} unter={`${AUFTRAG_STAND_TEXT[auftragStand(t)]} · ${[t.kunde?.name, t.fahrzeug?.kennzeichen].filter(Boolean).join(" · ")}`} zurueck={`/app/termine/${id}`} />
      <div className="bg-weiss p-4">
        <BelegEditor
          art="auftrag"
          kompakt
          id={id}
          daten={await editorDaten(fahrzeug)}
          zuletzt={[]}
          start={{ kunde_id: t.kunde?.id ?? null, empfaenger: {}, fahrzeug, positionen: t.auftrag_positionen ?? [], kostengrenze_cent: t.auftrag_kostengrenze_cent ?? null, hinweis: "" }}
        />
      </div>
    </>
  );
}
