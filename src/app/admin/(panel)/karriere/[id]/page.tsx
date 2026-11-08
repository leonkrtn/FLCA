import { notFound } from "next/navigation";
import { Formular, Senden } from "@/components/admin/formular";
import { Abschnitt, Auswahl, Kopf, Textfeld } from "@/components/admin/ui";
import { bewerbungSpeichern } from "@/lib/aktionen/karriere";
import { benutzerMitRecht } from "@/lib/auth";
import { datumZeit, telHref } from "@/lib/format";
import { db } from "@/lib/supabase/admin";

export default async function Bewerbung({ params }: { params: Promise<{ id: string }> }) {
  await benutzerMitRecht("karriere");
  const { id } = await params;
  const { data: b } = await db().from("bewerbungen").select("*").eq("id", id).maybeSingle();
  if (!b) notFound();
  return (
    <>
      <Kopf titel={b.name} unter={`${b.stelle} · eingegangen ${datumZeit(b.erstellt_am)}`} zurueck={{ href: "/admin/karriere", text: "Karriere" }}>
        <a href={telHref(b.telefon)} className="knopf knopf-dunkel knopf-klein">Anrufen</a>
      </Kopf>
      <div className="grid gap-x-8 lg:grid-cols-2">
        <Abschnitt titel="Angaben">
          <dl className="grid gap-y-2 sm:grid-cols-[8rem_1fr]">
            <dt className="text-grau">Telefon</dt>
            <dd>{b.telefon}</dd>
            <dt className="text-grau">E-Mail</dt>
            <dd>{b.email || "–"}</dd>
            <dt className="text-grau">Nachricht</dt>
            <dd className="whitespace-pre-line">{b.nachricht || "–"}</dd>
            <dt className="text-grau">Lebenslauf</dt>
            <dd>{b.lebenslauf_pfad ? <a href={`/admin/karriere/${b.id}/lebenslauf`} target="_blank" className="underline">{b.lebenslauf_name}</a> : "keiner"}</dd>
          </dl>
        </Abschnitt>
        <Abschnitt titel="Bearbeitung">
          <Formular aktion={bewerbungSpeichern.bind(null, b.id)} className="grid gap-4">
            <Auswahl label="Status" name="status" wert={b.status} optionen={[["neu", "Neu"], ["in_pruefung", "In Prüfung"], ["gespraech", "Gespräch vereinbart"], ["zusage", "Zusage"], ["absage", "Absage"]]} />
            <Textfeld label="Notiz" name="notiz" wert={b.notiz} zeilen={5} />
            <div><Senden vorab="Gespeichert">Speichern</Senden></div>
          </Formular>
        </Abschnitt>
      </div>
    </>
  );
}
