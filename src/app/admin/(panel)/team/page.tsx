import Link from "next/link";
import { Formular, Senden } from "@/components/admin/formular";
import { Abschnitt, Auswahl, Feld, Kopf, Leer, Marke, Schalter, Tabelle } from "@/components/admin/ui";
import { abwesenheitEntscheiden, einladen } from "@/lib/aktionen/team";
import { benutzerMitRecht } from "@/lib/auth";
import { datum } from "@/lib/format";
import { ROLLEN, rollenName, type Rolle } from "@/lib/rollen";
import { db } from "@/lib/supabase/admin";
import { berlinDatum } from "@/lib/zeit";

export const metadata = { title: "Team" };

export default async function Team() {
  await benutzerMitRecht("team");
  const heute = berlinDatum();
  const [{ data: profile }, { data: offen }, { data: kommend }, { data: laufend }] = await Promise.all([
    db().from("profile").select("id, name, email, rolle, aktiv, zeiterfassung").order("name"),
    db().from("abwesenheiten").select("id, art, von, bis, notiz, profil:profile(name)").eq("status", "beantragt").order("von"),
    db().from("abwesenheiten").select("id, art, von, bis, status, profil:profile(name)").gte("bis", heute).eq("status", "genehmigt").order("von").limit(20),
    db().from("zeiteintraege").select("profil_id").is("ende", null),
  ]);
  const eingestempelt = new Set((laufend ?? []).map((z) => z.profil_id));
  type Abw = { id: string; art: string; von: string; bis: string; notiz?: string; profil: { name: string } | null };
  const artText = (a: string) => (a === "krank" ? "krank" : a === "urlaub" ? "Urlaub" : "frei");

  return (
    <>
      <Kopf titel="Team" />
      {offen?.length ? (
        <Abschnitt titel="Offene Anträge" className="border-l-4 border-kreide">
          <ul className="divide-y divide-linie">
            {(offen as unknown as Abw[]).map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <span>
                  <span className="font-semibold">{a.profil?.name}</span> · {artText(a.art)} {datum(a.von)} bis {datum(a.bis)}
                  {a.notiz ? <span className="block text-sm text-grau">{a.notiz}</span> : null}
                </span>
                <Formular aktion={abwesenheitEntscheiden.bind(null, a.id)} className="flex gap-2">
                  <Senden klein name="entscheidung" value="genehmigt">Genehmigen</Senden>
                  <Senden klein art="rahmen" name="entscheidung" value="abgelehnt">Ablehnen</Senden>
                </Formular>
              </li>
            ))}
          </ul>
        </Abschnitt>
      ) : null}
      <Abschnitt titel="Personen">
        {profile?.length ? (
          <Tabelle kopf={["Name", "Rolle", "Zeiterfassung", "Jetzt", "Status"]}>
            {profile.map((p) => (
              <tr key={p.id} className="hover:bg-papier">
                <td>
                  <Link href={`/admin/team/${p.id}`} className="font-semibold hover:underline">{p.name || p.email}</Link>
                  <span className="block text-grau">{p.email}</span>
                </td>
                <td>{rollenName(p.rolle as Rolle)}</td>
                <td>{p.zeiterfassung ? "an" : "aus"}</td>
                <td>{eingestempelt.has(p.id) ? <Marke ton="ok">eingestempelt</Marke> : null}</td>
                <td>{p.aktiv ? "aktiv" : <Marke ton="hell">deaktiviert</Marke>}</td>
              </tr>
            ))}
          </Tabelle>
        ) : (
          <Leer>Noch niemand angelegt.</Leer>
        )}
      </Abschnitt>
      <div className="grid gap-x-8 lg:grid-cols-2">
        <Abschnitt titel="Person einladen">
          <Formular aktion={einladen} zuruecksetzen className="grid gap-4">
            <Feld label="Name" name="name" required />
            <Feld label="E-Mail" name="email" typ="email" required />
            <Auswahl label="Rolle" name="rolle" wert="mitarbeiter" optionen={ROLLEN.map((r) => [r.wert, `${r.name}: ${r.beschreibung}`])} />
            <Schalter label="Zeiterfassung einschalten" name="zeiterfassung" an={false} />
            <div><Senden>Einladung senden</Senden></div>
          </Formular>
        </Abschnitt>
        <Abschnitt titel="Demnächst nicht da">
          {kommend?.length ? (
            <ul className="space-y-1">
              {(kommend as unknown as Abw[]).map((a) => (
                <li key={a.id}>
                  {a.profil?.name} <span className="text-grau">· {artText(a.art)} {datum(a.von)} bis {datum(a.bis)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-grau">Niemand.</p>
          )}
        </Abschnitt>
      </div>
    </>
  );
}
