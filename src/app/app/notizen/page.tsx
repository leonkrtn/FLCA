import Link from "next/link";
import { NotizZeile } from "@/components/admin/notizen";
import { MobilKopf, MobilReiter } from "@/components/mobil/teile";
import { benutzerMitRecht } from "@/lib/auth";
import { type NotizAnsicht, notizenLaden } from "@/lib/notizen";
import { jetztMs } from "@/lib/zeit";

export const metadata = { title: "Notizen" };

const ANSICHTEN: [NotizAnsicht, string][] = [
  ["offen", "Offen"],
  ["erinnerungen", "Erinnerungen"],
  ["erledigt", "Erledigt"],
];

export default async function AppNotizen({ searchParams }: { searchParams: Promise<{ ansicht?: string }> }) {
  const b = await benutzerMitRecht("notizen");
  const { ansicht: roh } = await searchParams;
  const ansicht = ANSICHTEN.some(([k]) => k === roh) ? (roh as NotizAnsicht) : "offen";
  const liste = await notizenLaden(b, { ansicht, limit: 100 });
  const jetzt = jetztMs();
  return (
    <>
      <MobilKopf
        titel="Notizen"
        unter={`${liste.length} ${ansicht === "erledigt" ? "erledigt" : "offen"}`}
        aktion={<Link href="/app/notizen/neu" className="knopf knopf-dunkel knopf-klein">Neu</Link>}
      />
      <MobilReiter aktiv={`/app/notizen?ansicht=${ansicht}`} eintraege={ANSICHTEN.map(([k, t]) => ({ href: `/app/notizen?ansicht=${k}`, text: t }))} />
      <ul className="grid grid-cols-1 gap-px bg-linie">
        {liste.map((n) => (
          <li key={n.id} className="bg-weiss px-4">
            <NotizZeile n={n} href={`/app/notizen/${n.id}`} jetzt={jetzt} />
          </li>
        ))}
      </ul>
      {!liste.length ? <p className="px-4 py-10 text-center text-grau">{ansicht === "erledigt" ? "Noch nichts erledigt." : "Keine offenen Notizen."}</p> : null}
    </>
  );
}
