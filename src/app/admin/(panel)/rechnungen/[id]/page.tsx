import { notFound } from "next/navigation";
import { Senden } from "@/components/admin/formular";
import { KorrekturHinweis, RechnungAnsicht } from "@/components/admin/rechnung-ansicht";
import { BelegEditor } from "@/components/admin/beleg-editor";
import { KostengrenzeHinweis } from "@/components/admin/kostengrenze-hinweis";
import { Abschnitt, Kopf, Marke } from "@/components/admin/ui";
import { entwurfLoeschen } from "@/lib/aktionen/rechnungen";
import { benutzerMitRecht } from "@/lib/auth";
import { datumZeit } from "@/lib/format";
import { editorDaten } from "@/lib/rechnung/editor-daten";
import { stornoStand } from "@/lib/rechnung/korrektur";
import { bezuegeLaden, korrekturStand, RECHNUNG_STATUS, rechnungLaden } from "@/lib/rechnung/rechnungen";
import { kundenSuchen } from "@/lib/kunden";
import { db } from "@/lib/supabase/admin";

export default async function RechnungSeite({ params }: { params: Promise<{ id: string }> }) {
  await benutzerMitRecht("rechnungen");
  const { id } = await params;
  const r = await rechnungLaden(id);
  if (!r) notFound();
  const [daten, zuletzt, { data: verlauf }, bezuege, korrektur] = await Promise.all([
    r.status === "entwurf" ? editorDaten(r.fahrzeug) : null,
    r.status === "entwurf" ? kundenSuchen("", 6) : [],
    db().from("verlauf").select("text, erstellt_am").eq("bezug_typ", "rechnung").eq("bezug_id", id).order("erstellt_am", { ascending: false }),
    bezuegeLaden(r),
    r.status === "entwurf" ? korrekturStand(r) : null,
  ]);
  return (
    <>
      <Kopf
        titel={r.storno_zu ? `Stornorechnung ${r.nummer}` : r.nummer ? `Rechnung ${r.nummer}` : korrektur ? `Korrektur zu ${korrektur.original}` : "Rechnungsentwurf"}
        unter={<Marke ton={r.status === "bezahlt" ? "ok" : r.status === "gestellt" ? "warnung" : "hell"}>{r.storno_zu ? stornoStand(r) : RECHNUNG_STATUS[r.status]}</Marke>}
        zurueck={{ href: "/admin/rechnungen", text: "Rechnungen" }}
      >
        {r.status === "entwurf" ? (
          <form action={entwurfLoeschen.bind(null, r.id, "/admin/rechnungen")}>
            <Senden art="rahmen" klein>Entwurf löschen</Senden>
          </form>
        ) : null}
      </Kopf>
      <div className="grid gap-x-8 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <Abschnitt className="min-w-0">
          {korrektur ? <KorrekturHinweis k={korrektur} basis="/admin/rechnungen" /> : null}
          {r.status === "entwurf" && r.termin_id ? <KostengrenzeHinweis terminId={r.termin_id} summe={r.summe_brutto_cent} basis="/admin" /> : null}
          {r.status === "entwurf" ? (
            <BelegEditor
              art="rechnung"
              korrektur={korrektur ?? undefined}
              id={r.id}
              daten={daten!}
              zuletzt={zuletzt}
              start={{
                kunde_id: r.kunde_id,
                empfaenger: r.empfaenger as Record<string, string>,
                fahrzeug: r.fahrzeug ?? {},
                positionen: r.positionen,
                leistungsdatum: r.leistungsdatum,
                hinweis: r.hinweis,
              }}
            />
          ) : (
            <RechnungAnsicht r={r} basis="/admin/rechnungen" pdfHref={`/admin/rechnungen/${r.id}/pdf`} bezuege={bezuege} />
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
