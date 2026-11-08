import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Pfeil } from "@/components/icons";
import { BewerbungsFormular } from "@/components/site/bewerbung";
import { einstellungen } from "@/lib/einstellungen";
import { stellen } from "@/lib/inhalte";

export const revalidate = 300;
export const metadata: Metadata = { title: "Karriere", description: "Jobs bei FLC Automotive in Dietzenbach. Bewerben in zwei Minuten, Lebenslauf optional." };

export default async function KarriereSeite() {
  const [e, liste] = await Promise.all([einstellungen(), stellen()]);
  if (!e.module.karriere) notFound();
  return (
    <div className="rand pb-24 pt-8 md:pt-14">
      <div className="grid gap-10 md:grid-cols-12">
        <div className="md:col-span-5">
          <h1 className="schmal mb-4 text-4xl md:text-5xl">Arbeiten bei FLC</h1>
          <p className="text-lg">{e.texte.karriereText}</p>
        </div>
        <ul className="border-t border-grau-hell md:col-span-7">
          {liste.map((s) => (
            <li key={s.id} className="border-b border-linie">
              <Link href={`/karriere/${s.id}`} className="group flex items-center justify-between gap-4 py-5">
                <span>
                  <span className="block text-lg font-semibold group-hover:underline">{s.titel}</span>
                  <span className="text-grau">{s.umfang} · Dietzenbach</span>
                </span>
                <Pfeil className="size-5 shrink-0" />
              </Link>
            </li>
          ))}
          {!liste.length ? <li className="py-5 text-grau">Gerade ist keine Stelle ausgeschrieben. Eine Initiativbewerbung freut uns trotzdem.</li> : null}
        </ul>
      </div>
      <section className="mt-20 max-w-3xl">
        <h2 className="schmal mb-2 text-3xl">Initiativ bewerben</h2>
        <p className="mb-8 text-grau">Name und Telefonnummer reichen. Wir rufen Sie an.</p>
        <BewerbungsFormular stelle="initiativ" />
      </section>
    </div>
  );
}
