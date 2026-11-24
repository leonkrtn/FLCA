import { notFound } from "next/navigation";
import { BelegEditor } from "@/components/admin/beleg-editor";
import { KvAnsicht } from "@/components/admin/kv-ansicht";
import { MobilKopf } from "@/components/mobil/teile";
import { benutzerMitRecht } from "@/lib/auth";
import { kundenSuchen } from "@/lib/kunden";
import { db } from "@/lib/supabase/admin";
import { kvLaden, kvStatusText } from "@/lib/rechnung/kostenvoranschlaege";
import { editorDaten } from "@/lib/rechnung/editor-daten";
import { termineFuerKv } from "@/lib/termin-daten";
import { WhatsappKnopf } from "@/components/mobil/whatsapp-knopf";
import { whatsappVermerken } from "@/lib/aktionen/whatsapp";
import { kvWhatsapp } from "@/lib/whatsapp-daten";

export const metadata = { title: "Kostenvoranschlag" };

export default async function AppKostenvoranschlag({ params }: { params: Promise<{ id: string }> }) {
  await benutzerMitRecht("rechnungen");
  const { id } = await params;
  const k = await kvLaden(id);
  if (!k) notFound();
  const entwurf = k.status === "entwurf";
  const [daten, zuletzt, termine, { data: termin }, wa] = await Promise.all([
    entwurf ? editorDaten(k.fahrzeug) : null,
    entwurf ? kundenSuchen("", 6) : [],
    entwurf || k.termin_id ? [] : termineFuerKv(k.kunde_id),
    k.termin_id ? db().from("termine").select("id, nummer, beginn, leistung_name, status").eq("id", k.termin_id).maybeSingle() : Promise.resolve({ data: null }),    kvWhatsapp(k),
  ]);
  return (
    <>
      <MobilKopf titel={k.nummer ? `KV ${k.nummer}` : "Kostenvoranschlag"} unter={kvStatusText(k)} zurueck="/app/kostenvoranschlaege" />
      <div className="bg-weiss p-4">
        {entwurf ? (
          <BelegEditor
            art="kostenvoranschlag"
            kompakt
            id={k.id}
            daten={daten!}
            zuletzt={zuletzt}
            start={{ kunde_id: k.kunde_id, empfaenger: k.empfaenger as Record<string, string>, fahrzeug: k.fahrzeug ?? {}, positionen: k.positionen, gueltig_bis: k.gueltig_bis, hinweis: k.hinweis }}
          />
        ) : (
          <KvAnsicht k={k} ort="app" termin={termin} termine={termine} />
        )}
        {wa ? <WhatsappKnopf href={wa.href} vermerken={whatsappVermerken.bind(null, "kostenvoranschlag", k.id, wa.vorlage)} className="knopf knopf-rahmen mt-4 w-full">Per WhatsApp schicken</WhatsappKnopf> : null}
      </div>
    </>
  );
}
