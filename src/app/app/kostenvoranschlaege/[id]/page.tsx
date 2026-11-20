import { notFound } from "next/navigation";
import { BelegEditor } from "@/components/admin/beleg-editor";
import { KvAnsicht } from "@/components/admin/kv-ansicht";
import { MobilKopf } from "@/components/mobil/teile";
import { benutzerMitRecht } from "@/lib/auth";
import { kundenSuchen } from "@/lib/kunden";
import { kvLaden, kvStatusText } from "@/lib/rechnung/kostenvoranschlaege";
import { angebotFuerRechnung } from "@/lib/rechnung/rechnungen";

export const metadata = { title: "Kostenvoranschlag" };

export default async function AppKostenvoranschlag({ params }: { params: Promise<{ id: string }> }) {
  await benutzerMitRecht("rechnungen");
  const { id } = await params;
  const k = await kvLaden(id);
  if (!k) notFound();
  const entwurf = k.status === "entwurf";
  const [angebot, zuletzt] = await Promise.all([entwurf ? angebotFuerRechnung() : [], entwurf ? kundenSuchen("", 6) : []]);
  return (
    <>
      <MobilKopf titel={k.nummer ? `KV ${k.nummer}` : "Kostenvoranschlag"} unter={kvStatusText(k)} zurueck="/app/kostenvoranschlaege" />
      <div className="bg-weiss p-4">
        {entwurf ? (
          <BelegEditor
            art="kostenvoranschlag"
            kompakt
            id={k.id}
            angebot={angebot}
            zuletzt={zuletzt}
            start={{ kunde_id: k.kunde_id, empfaenger: k.empfaenger as Record<string, string>, fahrzeug: k.fahrzeug ?? {}, positionen: k.positionen, gueltig_bis: k.gueltig_bis, hinweis: k.hinweis }}
          />
        ) : (
          <KvAnsicht k={k} ort="app" />
        )}
      </div>
    </>
  );
}
