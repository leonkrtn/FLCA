import Link from "next/link";
import { Abschnitt, Kopf, Leer, Marke, Tabelle } from "@/components/admin/ui";
import { benutzerMitRecht } from "@/lib/auth";
import { datum } from "@/lib/format";
import { db } from "@/lib/supabase/admin";

export const metadata = { title: "Karriere" };
const BEWERBUNG_STATUS: Record<string, string> = { neu: "Neu", in_pruefung: "In Prüfung", gespraech: "Gespräch", zusage: "Zusage", absage: "Absage" };

export default async function Karriere() {
  await benutzerMitRecht("karriere");
  const [{ data: bew }, { data: st }] = await Promise.all([
    db().from("bewerbungen").select("id, nummer, name, stelle, status, erstellt_am, lebenslauf_pfad").order("erstellt_am", { ascending: false }).limit(200),
    db().from("stellen").select("id, titel, umfang, aktiv").order("sortierung"),
  ]);
  return (
    <>
      <Kopf titel="Karriere">
        <Link href="/admin/karriere/stelle/neu" className="knopf knopf-dunkel knopf-klein">Stelle ausschreiben</Link>
      </Kopf>
      <Abschnitt titel="Bewerbungen">
        {bew?.length ? (
          <Tabelle kopf={["Name", "Stelle", "Eingang", "Lebenslauf", "Status"]}>
            {bew.map((b) => (
              <tr key={b.id} className="hover:bg-papier">
                <td><Link href={`/admin/karriere/${b.id}`} className="font-semibold hover:underline">{b.name}</Link></td>
                <td>{b.stelle}</td>
                <td className="zahlen">{datum(b.erstellt_am)}</td>
                <td>{b.lebenslauf_pfad ? "ja" : "–"}</td>
                <td><Marke ton={b.status === "neu" ? "warnung" : b.status === "zusage" ? "ok" : "neutral"}>{BEWERBUNG_STATUS[b.status]}</Marke></td>
              </tr>
            ))}
          </Tabelle>
        ) : (
          <Leer>Noch keine Bewerbungen.</Leer>
        )}
        <p className="mt-3 text-sm text-grau">Abgeschlossene Bewerbungen (Zusage/Absage) werden nach 6 Monaten automatisch gelöscht.</p>
      </Abschnitt>
      <Abschnitt titel="Stellenanzeigen">
        <ul className="divide-y divide-linie">
          {(st ?? []).map((s) => (
            <li key={s.id}>
              <Link href={`/admin/karriere/stelle/${s.id}`} className="flex justify-between gap-3 py-3 hover:bg-papier">
                <span className="font-semibold">{s.titel} <span className="font-normal text-grau">· {s.umfang}</span></span>
                {s.aktiv ? <Marke ton="ok">online</Marke> : <Marke ton="hell">offline</Marke>}
              </Link>
            </li>
          ))}
        </ul>
      </Abschnitt>
    </>
  );
}
