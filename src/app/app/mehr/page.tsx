import Link from "next/link";
import { abmelden } from "@/app/login/actions";
import { MobilKopf } from "@/components/mobil/teile";
import { PushSchalter } from "@/components/mobil/push-schalter";
import { Formular, Senden } from "@/components/admin/formular";
import { TaktStatus } from "@/components/admin/takt-status";
import { pushTest } from "@/lib/aktionen/push";
import { benutzerMitRecht } from "@/lib/auth";
import { rollenName } from "@/lib/rollen";
import { db } from "@/lib/supabase/admin";

export const metadata = { title: "Mehr" };

export default async function MehrSeite() {
  const b = await benutzerMitRecht("termine");
  // Was der Server kennt, nicht was das Handy glaubt: Nur an diese Geräte gehen Nachrichten.
  const { count: geraete } = await db().from("push_abos").select("id", { count: "exact", head: true }).eq("profil_id", b.id);
  return (
    <>
      <MobilKopf titel="Mehr" unter={`${b.name || b.email} · ${rollenName(b.rolle)}`} />
      <div className="grid gap-6 p-4">
        <section className="grid gap-2">
          <h2 className="font-semibold">Benachrichtigungen</h2>
          <p className="text-sm text-grau">
            Push bei neuen Anfragen, Absagen, angenommenen Kostenvoranschlägen, Bewerbungen und Erinnerungen aus Notizen.{" "}
            {geraete ? `Eingeschaltet auf ${geraete === 1 ? "einem Gerät" : `${geraete} Geräten`}.` : "Noch auf keinem Gerät eingeschaltet."}
          </p>
          <PushSchalter />
          <Formular aktion={pushTest}>
            <Senden art="rahmen" className="w-full" vorab="Gesendet">Test-Push an mich</Senden>
          </Formular>
          <TaktStatus />
        </section>
        <nav className="grid grid-cols-1 gap-px bg-linie">
          {[
            ["/app/notizen", "Notizen und Erinnerungen"],
            ["/app/anfragen", "Alle Anfragen"],
            ["/admin/kalender", "Wochenkalender"],
            ["/admin/kunden", "Kunden"],
            ["/team", "Team-Ansicht"],
            ["/admin", "Volle Verwaltung (für den Rechner)"],
          ].map(([h, t]) => (
            <Link key={h} href={h} className="bg-weiss px-4 py-4 font-semibold">{t}</Link>
          ))}
        </nav>
        <form action={abmelden}>
          <Senden art="rahmen" className="w-full">Abmelden</Senden>
        </form>
      </div>
    </>
  );
}
