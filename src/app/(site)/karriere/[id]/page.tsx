import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Zurueck } from "@/components/icons";
import { BewerbungsFormular } from "@/components/site/bewerbung";
import { zeilen } from "@/lib/format";
import { stellen } from "@/lib/inhalte";

export const revalidate = 300;

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const s = (await stellen()).find((x) => x.id === id);
  return s ? { title: s.titel, description: s.einleitung.slice(0, 150) } : {};
}

export default async function StellenSeite({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = (await stellen()).find((x) => x.id === id);
  if (!s) notFound();
  const abschnitte = [
    ["Ihre Aufgaben", s.aufgaben],
    ["Was Sie mitbringen", s.profil],
    ["Was wir bieten", s.wir_bieten],
  ].filter(([, t]) => t.trim());
  return (
    <div className="rand grid gap-12 pb-24 pt-8 md:grid-cols-12 md:pt-14">
      <div className="md:col-span-6">
        <Link href="/karriere" className="mb-8 inline-flex items-center gap-2 text-sm text-grau hover:text-tinte">
          <Zurueck className="size-4" /> Alle Stellen
        </Link>
        <h1 className="schmal mb-2 text-4xl md:text-5xl">{s.titel}</h1>
        <p className="mb-8 text-grau">{s.umfang} · Dietzenbach</p>
        {s.einleitung ? <p className="mb-10 text-lg">{s.einleitung}</p> : null}
        {abschnitte.map(([titel, t]) => (
          <section key={titel} className="mb-8">
            <h2 className="mb-3 font-semibold">{titel}</h2>
            <ul className="space-y-2">
              {zeilen(t).map((z) => (
                <li key={z} className="flex gap-3">
                  <span className="mt-2.5 h-px w-3 shrink-0 bg-tinte" aria-hidden />
                  {z}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      <div className="md:col-span-5 md:col-start-8">
        <div className="bg-papier p-5 md:sticky md:top-24 md:p-8">
          <h2 className="schmal mb-1 text-2xl">Bewerben in zwei Minuten</h2>
          <p className="mb-6 text-sm text-grau">Lebenslauf ist kein Muss.</p>
          <BewerbungsFormular stelle={s.id} />
        </div>
      </div>
    </div>
  );
}
