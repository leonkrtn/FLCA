import Link from "next/link";
import { abmelden } from "@/app/login/actions";
import { MobilKopf } from "@/components/mobil/teile";
import { PushSchalter } from "@/components/mobil/push-schalter";
import { Formular, Senden } from "@/components/admin/formular";
import { pushTest } from "@/lib/aktionen/push";
import { benutzerMitRecht } from "@/lib/auth";
import { KATEGORIEN } from "@/lib/inhalte";
import { rollenName } from "@/lib/rollen";
import { db } from "@/lib/supabase/admin";
import { istTerminLeistung, type Leistung } from "@/lib/termine";

export const metadata = { title: "Mehr" };

export default async function TeamMehr() {
  const b = await benutzerMitRecht("werkstatt");
  // Was die Werkstatt für mich eingetragen hat: nur lesen, ändern geht im Büro
  const [{ data: p }, { data: l }, { data: sperren }] = await Promise.all([
    db().from("profile").select("nimmt_auftraege").eq("id", b.id).maybeSingle(),
    db().from("leistungen").select("id, name, kategorie, art, aktiv, sortierung").order("sortierung"),
    db().from("leistung_sperren").select("leistung_id").eq("profil_id", b.id),
  ]);
  const gesperrt = new Set((sperren ?? []).map((s) => s.leistung_id as string));
  const darf = ((l ?? []) as Leistung[]).filter((x) => istTerminLeistung(x) && !gesperrt.has(x.id));
  const kategorien = [...new Set(darf.map((x) => x.kategorie))];
  return (
    <>
      <MobilKopf titel="Mehr" unter={`${b.name || b.email} · ${rollenName(b.rolle)}`} />
      <div className="grid gap-6 p-4">
        <section className="grid gap-2">
          <h2 className="font-semibold">Benachrichtigungen</h2>
          <p className="text-sm text-grau">Push, wenn dein Urlaub genehmigt ist, sich etwas an deinen Aufträgen ändert oder eine Erinnerung fällig ist.</p>
          <PushSchalter />
          <Formular aktion={pushTest}>
            <Senden art="rahmen" className="w-full" vorab="Gesendet">Test-Push an mich</Senden>
          </Formular>
        </section>
        <section className="grid gap-2">
          <h2 className="font-semibold">Was ich machen darf</h2>
          {p?.nimmt_auftraege ? (
            <>
              <p className="text-sm text-grau">Trägt die Werkstatt ein. Danach richtet sich, welche Aufträge du bekommst und übernehmen kannst.</p>
              {kategorien.map((k) => (
                <p key={k} className="text-sm">
                  <span className="font-semibold">{KATEGORIEN[k] ?? k}:</span> {darf.filter((x) => x.kategorie === k).map((x) => x.name).join(", ")}
                </p>
              ))}
              {!darf.length ? <p className="text-sm text-grau">Noch keine Leistung freigegeben.</p> : null}
            </>
          ) : (
            <p className="text-sm text-grau">Du wirst nicht für Aufträge eingeplant.</p>
          )}
        </section>
        <Link href="/team/notizen" className="knopf knopf-rahmen w-full">Meine Erinnerungen</Link>
        {b.rolle !== "mitarbeiter" ? (
          <Link href="/app" className="knopf knopf-rahmen w-full">Zur Werkstatt-App</Link>
        ) : null}
        <form action={abmelden}>
          <Senden art="rahmen" className="w-full">Abmelden</Senden>
        </form>
      </div>
    </>
  );
}
