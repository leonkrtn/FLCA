import { notFound } from "next/navigation";
import { BelegEditor } from "@/components/admin/beleg-editor";
import { KvAnsicht } from "@/components/admin/kv-ansicht";
import { Abschnitt, Kopf, Marke } from "@/components/admin/ui";
import { kvEntwurfLoeschen } from "@/lib/aktionen/kostenvoranschlaege";
import { benutzerMitRecht } from "@/lib/auth";
import { datumZeit } from "@/lib/format";
import { kundenSuchen } from "@/lib/kunden";
import { kvLaden, kvStatusText, kvTon } from "@/lib/rechnung/kostenvoranschlaege";
import { angebotFuerRechnung } from "@/lib/rechnung/rechnungen";
import { db } from "@/lib/supabase/admin";

export const metadata = { title: "Kostenvoranschlag" };

export default async function KostenvoranschlagSeite({ params }: { params: Promise<{ id: string }> }) {
  await benutzerMitRecht("rechnungen");
  const { id } = await params;
  const k = await kvLaden(id);
  if (!k) notFound();
  const entwurf = k.status === "entwurf";
  const [angebot, zuletzt, { data: verlauf }] = await Promise.all([
    entwurf ? angebotFuerRechnung() : [],
    entwurf ? kundenSuchen("", 6) : [],
    db().from("verlauf").select("text, erstellt_am").eq("bezug_typ", "kostenvoranschlag").eq("bezug_id", id).order("erstellt_am", { ascending: false }),
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
            <button className="knopf knopf-rahmen knopf-klein">Entwurf löschen</button>
          </form>
        ) : null}
      </Kopf>
      <div className="grid gap-x-8 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <Abschnitt className="min-w-0">
          {entwurf ? (
            <BelegEditor
              art="kostenvoranschlag"
              id={k.id}
              angebot={angebot}
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
            <KvAnsicht k={k} ort="admin" />
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
