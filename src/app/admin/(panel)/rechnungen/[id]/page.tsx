import { notFound } from "next/navigation";
import { RechnungAnsicht } from "@/components/admin/rechnung-ansicht";
import { RechnungEditor } from "@/components/admin/rechnung-editor";
import { Abschnitt, Kopf, Marke } from "@/components/admin/ui";
import { entwurfLoeschen } from "@/lib/aktionen/rechnungen";
import { benutzerMitRecht } from "@/lib/auth";
import { datumZeit } from "@/lib/format";
import { RECHNUNG_STATUS, rechnungLaden } from "@/lib/rechnung/rechnungen";
import { db } from "@/lib/supabase/admin";

export default async function RechnungSeite({ params }: { params: Promise<{ id: string }> }) {
  await benutzerMitRecht("rechnungen");
  const { id } = await params;
  const r = await rechnungLaden(id);
  if (!r) notFound();
  const [{ data: artikel }, { data: verlauf }] = await Promise.all([
    db().from("artikel").select("id, name, einheit, preis_brutto_cent, mwst_satz").eq("aktiv", true).order("sortierung"),
    db().from("verlauf").select("text, erstellt_am").eq("bezug_typ", "rechnung").eq("bezug_id", id).order("erstellt_am", { ascending: false }),
  ]);
  return (
    <>
      <Kopf
        titel={r.storno_zu ? `Stornorechnung ${r.nummer}` : r.nummer ? `Rechnung ${r.nummer}` : "Rechnungsentwurf"}
        unter={<Marke ton={r.status === "bezahlt" ? "ok" : r.status === "gestellt" ? "warnung" : "hell"}>{RECHNUNG_STATUS[r.status]}</Marke>}
        zurueck={{ href: "/admin/rechnungen", text: "Rechnungen" }}
      >
        {r.status === "entwurf" ? (
          <form action={entwurfLoeschen.bind(null, r.id, "/admin/rechnungen")}>
            <button className="knopf knopf-rahmen knopf-klein">Entwurf löschen</button>
          </form>
        ) : null}
      </Kopf>
      <div className="grid gap-x-8 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <Abschnitt>
          {r.status === "entwurf" ? (
            <RechnungEditor
              id={r.id}
              artikel={(artikel ?? []).map((a) => ({ ...a, mwst_satz: Number(a.mwst_satz) }))}
              start={{
                empfaenger: r.empfaenger as Record<string, string>,
                fahrzeug: r.fahrzeug ?? {},
                positionen: r.positionen,
                leistungsdatum: r.leistungsdatum,
                hinweis: r.hinweis,
              }}
            />
          ) : (
            <RechnungAnsicht r={r} basis="/admin/rechnungen" pdfHref={`/admin/rechnungen/${r.id}/pdf`} />
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
