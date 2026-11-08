import Link from "next/link";
import { abmelden } from "@/app/login/actions";
import { MobilKopf } from "@/components/mobil/teile";
import { PushSchalter } from "@/components/mobil/push-schalter";
import { benutzerMitRecht } from "@/lib/auth";
import { rollenName } from "@/lib/rollen";

export const metadata = { title: "Mehr" };

export default async function TeamMehr() {
  const b = await benutzerMitRecht("werkstatt");
  return (
    <>
      <MobilKopf titel="Mehr" unter={`${b.name || b.email} · ${rollenName(b.rolle)}`} />
      <div className="grid gap-6 p-4">
        <section className="grid gap-2">
          <h2 className="font-semibold">Benachrichtigungen</h2>
          <p className="text-sm text-grau">Push, wenn dein Urlaub genehmigt ist oder sich etwas an deinen Aufträgen ändert.</p>
          <PushSchalter />
        </section>
        {b.rolle !== "mitarbeiter" ? (
          <Link href="/app" className="knopf knopf-rahmen w-full">Zur Werkstatt-App</Link>
        ) : null}
        <form action={abmelden}>
          <button className="knopf knopf-rahmen w-full">Abmelden</button>
        </form>
      </div>
    </>
  );
}
