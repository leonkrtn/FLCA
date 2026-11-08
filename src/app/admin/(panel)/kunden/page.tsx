import Link from "next/link";
import { Formular, Senden } from "@/components/admin/formular";
import { Abschnitt, Feld, Kopf, Leer, Tabelle } from "@/components/admin/ui";
import { kundeSpeichern } from "@/lib/aktionen/kunden";
import { benutzerMitRecht } from "@/lib/auth";
import { datum } from "@/lib/format";
import { db } from "@/lib/supabase/admin";

export const metadata = { title: "Kunden" };

export default async function KundenListe({ searchParams }: { searchParams: Promise<{ q?: string; neu?: string }> }) {
  await benutzerMitRecht("kunden");
  const { q = "", neu } = await searchParams;
  let abfrage = db().from("kunden").select("id, nummer, name, firma, telefon, email, ort, erstellt_am, fahrzeuge(kennzeichen)").order("erstellt_am", { ascending: false }).limit(100);
  const such = q.replace(/[,()%]/g, " ").trim();
  if (such) {
    const { data: fz } = await db().from("fahrzeuge").select("kunde_id").ilike("kennzeichen_norm", `%${such.toUpperCase().replace(/[^A-ZÄÖÜ0-9]/g, "")}%`).limit(50);
    const ids = (fz ?? []).map((f) => f.kunde_id).filter(Boolean);
    abfrage = abfrage.or(
      [`name.ilike.%${such}%`, `firma.ilike.%${such}%`, `telefon.ilike.%${such}%`, `email.ilike.%${such}%`, ...(ids.length ? [`id.in.(${ids.join(",")})`] : [])].join(","),
    );
  }
  const { data } = await abfrage;
  const kunden = (data ?? []) as { id: string; nummer: number; name: string; firma: string; telefon: string; email: string; ort: string; erstellt_am: string; fahrzeuge: { kennzeichen: string }[] }[];
  return (
    <>
      <Kopf titel="Kunden">
        <Link href="/admin/kunden?neu=1" className="knopf knopf-dunkel">Kunde anlegen</Link>
      </Kopf>
      {neu ? (
        <Abschnitt titel="Neuer Kunde">
          <Formular aktion={kundeSpeichern.bind(null, null)} className="grid gap-4 sm:grid-cols-3">
            <Feld label="Name" name="name" required />
            <Feld label="Telefon" name="telefon" typ="tel" />
            <Feld label="E-Mail" name="email" typ="email" />
            <div className="sm:col-span-3"><Senden>Anlegen</Senden></div>
          </Formular>
        </Abschnitt>
      ) : null}
      <form className="mb-4 max-w-sm">
        <input name="q" defaultValue={q} placeholder="Name, Telefon, E-Mail oder Kennzeichen" className="feld" aria-label="Suche" />
      </form>
      {kunden.length ? (
        <div className="bg-weiss p-4 md:p-6">
          <Tabelle kopf={["Name", "Fahrzeuge", "Telefon", "Ort", "Seit", { text: "Nr.", zahl: true }]}>
            {kunden.map((k) => (
              <tr key={k.id} className="hover:bg-papier">
                <td>
                  <Link href={`/admin/kunden/${k.id}`} className="font-semibold hover:underline">{k.name}</Link>
                  {k.firma ? <span className="block text-grau">{k.firma}</span> : null}
                </td>
                <td className="zahlen">{k.fahrzeuge.map((f) => f.kennzeichen).join(", ")}</td>
                <td>{k.telefon}</td>
                <td>{k.ort}</td>
                <td className="zahlen whitespace-nowrap">{datum(k.erstellt_am)}</td>
                <td className="zahl">{k.nummer}</td>
              </tr>
            ))}
          </Tabelle>
        </div>
      ) : (
        <Leer>{q ? "Nichts gefunden." : "Noch keine Kunden. Sie entstehen automatisch mit der ersten Anfrage."}</Leer>
      )}
    </>
  );
}
