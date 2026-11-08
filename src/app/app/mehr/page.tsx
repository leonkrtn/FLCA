import Link from "next/link";
import { abmelden } from "@/app/login/actions";
import { MobilKopf } from "@/components/mobil/teile";
import { PushSchalter } from "@/components/mobil/push-schalter";
import { benutzerMitRecht } from "@/lib/auth";
import { rollenName } from "@/lib/rollen";

export const metadata = { title: "Mehr" };

export default async function MehrSeite() {
  const b = await benutzerMitRecht("termine");
  return (
    <>
      <MobilKopf titel="Mehr" unter={`${b.name || b.email} · ${rollenName(b.rolle)}`} />
      <div className="grid gap-6 p-4">
        <section className="grid gap-2">
          <h2 className="font-semibold">Benachrichtigungen</h2>
          <p className="text-sm text-grau">Push bei neuen Anfragen, Absagen und Bewerbungen.</p>
          <PushSchalter />
        </section>
        <nav className="grid gap-px bg-linie">
          {[
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
          <button className="knopf knopf-rahmen w-full">Abmelden</button>
        </form>
      </div>
    </>
  );
}
