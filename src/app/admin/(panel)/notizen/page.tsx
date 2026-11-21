import Link from "next/link";
import { NotizZeile } from "@/components/admin/notizen";
import { Abschnitt, Kopf, Leer, Reiter } from "@/components/admin/ui";
import { benutzerMitRecht } from "@/lib/auth";
import { type NotizAnsicht, notizenLaden } from "@/lib/notizen";
import { jetztMs } from "@/lib/zeit";

export const metadata = { title: "Notizen" };

const ANSICHTEN: [NotizAnsicht, string][] = [
  ["offen", "Offen"],
  ["erinnerungen", "Mit Erinnerung"],
  ["erledigt", "Erledigt"],
];

export default async function NotizenSeite({ searchParams }: { searchParams: Promise<{ ansicht?: string }> }) {
  const b = await benutzerMitRecht("notizen");
  const { ansicht: roh } = await searchParams;
  const ansicht = ANSICHTEN.some(([k]) => k === roh) ? (roh as NotizAnsicht) : "offen";
  const liste = await notizenLaden(b, { ansicht });
  const jetzt = jetztMs();
  return (
    <>
      <Kopf titel="Notizen" unter="Private Notizen sehen nur Sie und die Person, an die erinnert wird.">
        <Link href="/admin/notizen/neu" className="knopf knopf-dunkel">Neue Notiz</Link>
      </Kopf>
      <Reiter aktiv={`/admin/notizen?ansicht=${ansicht}`} eintraege={ANSICHTEN.map(([k, t]) => ({ href: `/admin/notizen?ansicht=${k}`, text: t }))} />
      <Abschnitt>
        {liste.length ? (
          <ul className="divide-y divide-linie">
            {liste.map((n) => (
              <li key={n.id}>
                <NotizZeile n={n} href={`/admin/notizen/${n.id}`} jetzt={jetzt} />
              </li>
            ))}
          </ul>
        ) : (
          <Leer>{ansicht === "erledigt" ? "Noch nichts erledigt." : "Keine offenen Notizen."}</Leer>
        )}
      </Abschnitt>
    </>
  );
}
