import Link from "next/link";
import { abmelden } from "@/app/login/actions";
import { MobilKopf } from "@/components/mobil/teile";
import { PushSchalter } from "@/components/mobil/push-schalter";
import { MailPushSchalter } from "@/components/mail/push-mail";
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
    db().from("profile").select("nimmt_auftraege, mail_push").eq("id", b.id).maybeSingle(),
    db().from("leistungen").select("id, name, kategorie, art, aktiv, sortierung").order("sortierung"),
    db().from("leistung_sperren").select("leistung_id").eq("profil_id", b.id),
  ]);
  const mailPush = (p?.mail_push as boolean | undefined) ?? true;
  const gesperrt = new Set((sperren ?? []).map((s) => s.leistung_id as string));
  const darf = ((l ?? []) as Leistung[]).filter((x) => istTerminLeistung(x) && !gesperrt.has(x.id));
  const kategorien = [...new Set(darf.map((x) => x.kategorie))];
  return (
    <>
      <MobilKopf titel="Mehr" unter={`${b.name || b.email} · ${rollenName(b.rolle)}`} />
      <div className="grid gap-6 p-4">
        <section className="grid gap-2">
          <h2 className="font-semibold">Schulung</h2>
          <p className="text-sm text-grau">Anleitungen und Videos: wie die App funktioniert und wie bestimmte Arbeiten gemacht werden.</p>
          <Link href="/team/schulung" className="knopf knopf-dunkel w-full">Zur Schulung</Link>
        </section>
        <section className="grid gap-2">
          <h2 className="font-semibold">Benachrichtigungen</h2>
          <p className="text-sm text-grau">Push, wenn dein Urlaub genehmigt ist, sich etwas an deinen Aufträgen ändert oder eine Erinnerung fällig ist.</p>
          <PushSchalter />
          <MailPushSchalter an={mailPush} />
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
        {/* Art. 13 DSGVO, § 26 BDSG: Beschäftigte erfahren, was die App über sie speichert und wer es sieht. */}
        <details className="grid gap-2">
          <summary className="cursor-pointer font-semibold">Datenschutz: Was die App über mich speichert</summary>
          <div className="mt-2 grid gap-2 text-sm">
            <p>Verantwortlich ist dein Arbeitgeber. Gespeichert wird nur, was für die Arbeit nötig ist (§ 26 BDSG):</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>Name, Rolle, Zugang, Arbeitszeitplan, Urlaub und Abwesenheiten (bei Krankheit nur „krank“, nie ein Grund). Kollegen sehen davon nur, ob du da bist.</li>
              <li>Zeiterfassung (falls eingeschaltet): Beginn, Ende und Pausen. Das Gesetz verlangt die Aufzeichnung der Arbeitszeit.</li>
              <li>Ist „Einstempeln nur in der Werkstatt“ eingeschaltet: einmal beim Einstempeln der Abstand zur Werkstatt, nie dein Standort. Von weiter weg bekommt der Inhaber eine Mitteilung mit Name und Abstand.</li>
              <li>Zeit an Aufträgen, Befunde, Fotos und Teileanforderungen: für Rechnung und Nachweis gegenüber dem Kunden.</li>
              <li>Dein Postfach ist privat; das Firmenpostfach sehen alle, die dafür freigeschaltet sind.</li>
            </ul>
            <p>Zugriff haben Inhaber und Büro, Personalsachen (Konto, Zeiterfassung) nur der Inhaber. Gelöscht wird, wenn der Zweck entfällt und keine Aufbewahrungspflicht mehr besteht. Fragen, Auskunft oder Berichtigung: beim Inhaber.</p>
          </div>
        </details>
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
