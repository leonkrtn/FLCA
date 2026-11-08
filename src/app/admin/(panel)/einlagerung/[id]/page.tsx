import Link from "next/link";
import { notFound } from "next/navigation";
import { EinlagerungFelder } from "@/components/admin/einlagerung-felder";
import { Formular, Senden } from "@/components/admin/formular";
import { Abschnitt, Feld, Kopf } from "@/components/admin/ui";
import { auslagern, einlagerungSpeichern } from "@/lib/aktionen/einlagerung";
import { benutzerMitRecht } from "@/lib/auth";
import { datum } from "@/lib/format";
import { db } from "@/lib/supabase/admin";
import { berlinDatum } from "@/lib/zeit";

export default async function EinlagerungDetail({ params }: { params: Promise<{ id: string }> }) {
  await benutzerMitRecht("einlagerung");
  const { id } = await params;
  const { data: e } = await db().from("einlagerungen").select("*, kunde:kunden(id, name, telefon), fahrzeug:fahrzeuge(kennzeichen, marke_modell)").eq("id", id).maybeSingle();
  if (!e) notFound();
  return (
    <>
      <Kopf titel={`Einlagerung ${e.fahrzeug?.kennzeichen ?? ""}`} unter={`Nr. ${e.nummer} · ${e.ausgelagert_am ? `ausgelagert am ${datum(e.ausgelagert_am)}` : `im Lager seit ${datum(e.eingelagert_am)}`}`} zurueck={{ href: "/admin/einlagerung", text: "Einlagerung" }} />
      <div className="grid gap-x-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Abschnitt titel="Räder">
          <Formular aktion={einlagerungSpeichern.bind(null, e.id)} className="grid gap-4 sm:grid-cols-2">
            <EinlagerungFelder e={e} />
            <div><Senden vorab="Gespeichert">Speichern</Senden></div>
          </Formular>
        </Abschnitt>
        <div>
          <Abschnitt titel="Kunde">
            {e.kunde ? <Link href={`/admin/kunden/${e.kunde.id}`} className="font-semibold hover:underline">{e.kunde.name}</Link> : "–"}
            <p className="text-grau">{e.kunde?.telefon}</p>
          </Abschnitt>
          {!e.ausgelagert_am ? (
            <Abschnitt titel="Auslagern">
              <Formular aktion={auslagern.bind(null, e.id)} className="grid gap-3">
                <Feld label="Datum" name="am" typ="date" wert={berlinDatum()} />
                <Senden art="rahmen" vorab="Ausgelagert">Als ausgelagert markieren</Senden>
              </Formular>
            </Abschnitt>
          ) : null}
        </div>
      </div>
    </>
  );
}
