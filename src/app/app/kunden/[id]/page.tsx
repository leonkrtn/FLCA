import Link from "next/link";
import { Senden } from "@/components/admin/formular";
import { notFound } from "next/navigation";
import { Karte, MobilKopf } from "@/components/mobil/teile";
import { belegAnlegen } from "@/lib/aktionen/belege";
import { benutzerMitRecht } from "@/lib/auth";
import { telHref } from "@/lib/format";
import { kundeLaden } from "@/lib/kunden";

export const metadata = { title: "Kunde" };

/** Kundenkarte in der App: Kontakt auf einen Tipp und von hier direkt Kostenvoranschlag oder Rechnung. */
export default async function AppKunde({ params }: { params: Promise<{ id: string }> }) {
  await benutzerMitRecht("kunden");
  const k = await kundeLaden((await params).id);
  if (!k) notFound();
  // Ein Beleg je Fahrzeug, damit Kennzeichen und km-Stand gleich drinstehen; ohne Fahrzeug einer ohne.
  const ziele = k.fahrzeuge.length ? k.fahrzeuge.map((f) => ({ id: f.id, text: `${f.kennzeichen}${f.marke_modell ? ` · ${f.marke_modell}` : ""}` })) : [{ id: null, text: "" }];
  return (
    <>
      <MobilKopf titel={k.name} unter={`Kunde Nr. ${k.nummer}${k.firma ? ` · ${k.firma}` : ""}`} zurueck="/app" />
      <div className="grid gap-6 p-4">
        <div className="knopfreihe">
          {k.telefon ? <a href={telHref(k.telefon)} className="knopf knopf-dunkel">Anrufen</a> : null}
          {k.email ? <a href={`mailto:${k.email}`} className="knopf knopf-rahmen">E-Mail</a> : null}
          <Link href={`/app/neu?kunde=${k.id}`} className="knopf knopf-rahmen">Termin eintragen</Link>
          <Link href={`/app/notizen/neu?kunde=${k.id}`} className="knopf knopf-rahmen">Notiz zum Kunden</Link>
        </div>
        <dl className="grid gap-y-1 text-sm">
          {[
            ["Telefon", k.telefon],
            ["E-Mail", k.email],
            ["Adresse", [k.strasse, [k.plz, k.ort].filter(Boolean).join(" ")].filter(Boolean).join(", ")],
          ]
            .filter(([, v]) => v)
            .map(([t, v]) => (
              <div key={t} className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-2">
                <dt className="text-grau">{t}</dt>
                <dd className="break-words">{v}</dd>
              </div>
            ))}
        </dl>
        {ziele.map((z) => (
          <section key={z.id ?? "ohne"} className="grid gap-2">
            {z.text ? <h2 className="zahlen font-semibold">{z.text}</h2> : null}
            <div className="grid grid-cols-2 gap-2">
              <form action={belegAnlegen.bind(null, "kostenvoranschlag", "app", k.id, z.id)}>
                <Senden art="rahmen" className="w-full">Kostenvoranschlag</Senden>
              </form>
              <form action={belegAnlegen.bind(null, "rechnung", "app", k.id, z.id)}>
                <Senden art="rahmen" className="w-full">Rechnung</Senden>
              </form>
            </div>
          </section>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-px bg-linie">
        <Karte href={`/admin/kunden/${k.id}`} className="font-semibold">Alles zum Kunden (Verwaltung)</Karte>
      </div>
    </>
  );
}
