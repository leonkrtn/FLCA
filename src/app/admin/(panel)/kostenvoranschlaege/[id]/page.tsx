import { notFound } from "next/navigation";
import { Senden } from "@/components/admin/formular";
import { BelegEditor } from "@/components/admin/beleg-editor";
import { KvAnsicht } from "@/components/admin/kv-ansicht";
import { Abschnitt, Kopf, Marke } from "@/components/admin/ui";
import { kvEntwurfLoeschen } from "@/lib/aktionen/kostenvoranschlaege";
import { benutzerMitRecht } from "@/lib/auth";
import { datumZeit } from "@/lib/format";
import { kundenSuchen } from "@/lib/kunden";
import { kvLaden, kvStatusText, kvTon } from "@/lib/rechnung/kostenvoranschlaege";
import { editorDaten } from "@/lib/rechnung/editor-daten";
import { termineFuerKv } from "@/lib/termin-daten";
import { db } from "@/lib/supabase/admin";

export const metadata = { title: "Kostenvoranschlag" };

export default async function KostenvoranschlagSeite({ params }: { params: Promise<{ id: string }> }) {
  await benutzerMitRecht("rechnungen");
  const { id } = await params;
  const k = await kvLaden(id);
  if (!k) notFound();
  const entwurf = k.status === "entwurf";
  const [daten, zuletzt, { data: verlauf }, termine, { data: termin }] = await Promise.all([
    entwurf ? editorDaten(k.fahrzeug) : null,
    entwurf ? kundenSuchen("", 6) : [],
    db().from("verlauf").select("text, erstellt_am").eq("bezug_typ", "kostenvoranschlag").eq("bezug_id", id).order("erstellt_am", { ascending: false }),
    entwurf || k.termin_id ? [] : termineFuerKv(k.kunde_id),
    k.termin_id ? db().from("termine").select("id, nummer, beginn, leistung_name, status").eq("id", k.termin_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  return (
    <>
      <Kopf
        titel={k.nummer ? `Kostenvoranschlag ${k.nummer}` : "Kostenvoranschlag (Entwurf)"}
        unter={<Marke ton={kvTon(k)}>{kvStatusText(k)}</Marke>}
        zurueck={{ href: "/admin/kostenvoranschlaege", text: "Kostenvoranschläge" }}
      >
        {entwurf ? (
          <form action={kvEntwurfLoeschen.bind(null, k.id, "admin")}>
            <Senden art="rahmen" klein>Entwurf löschen</Senden>
          </form>
        ) : null}
      </Kopf>
      <div className="grid gap-x-8 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <Abschnitt className="min-w-0">
          {entwurf ? (
            <BelegEditor
              art="kostenvoranschlag"
              id={k.id}
              daten={daten!}
              zuletzt={zuletzt}
              start={{
                kunde_id: k.kunde_id,
                empfaenger: k.empfaenger as Record<string, string>,
                fahrzeug: k.fahrzeug ?? {},
                positionen: k.positionen,
                gueltig_bis: k.gueltig_bis,
                hinweis: k.hinweis,
              }}
            />
          ) : (
            <KvAnsicht k={k} ort="admin" termin={termin} termine={termine} />
          )}
        </Abschnitt>
        <Abschnitt titel="Verlauf">
          <ul className="space-y-2 text-sm">
            {(verlauf ?? []).map((v, i) => (
              <li key={i}>
                <span className="zahlen block text-grau">{datumZeit(v.erstellt_am)}</span>
                {v.text}
              </li>
            ))}
          </ul>
        </Abschnitt>
      </div>
    </>
  );
}
