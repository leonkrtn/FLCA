import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import panamera from "@/assets/panamera-reifen.jpg";
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
    <>
      {/*
        Kopf mit Foto aus der Halle wie auf der Startseite: Wer sich bewirbt, will zuerst sehen, wo er arbeiten würde.
        Unter den durchscheinenden Seitenkopf gezogen (-mt-16), die Schrift beginnt erst darunter.
      */}
      <section className="relative isolate -mt-16 flex min-h-[26rem] flex-col justify-end overflow-hidden bg-graphit text-hell md:min-h-[34rem]">
        <Image src={panamera} alt="" fill priority sizes="100vw" className="-z-20 object-cover object-[center_60%]" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black/85 via-black/55 to-black/40" />
        <div className="rand einblenden pb-12 pt-28 md:pb-16">
          <p className="mb-3 text-sm uppercase tracking-[0.16em] text-hell/60">Karriere</p>
          <h1 className="schmal text-5xl leading-[0.92] sm:text-6xl md:text-8xl">Arbeiten bei FLC</h1>
          <p className="mt-5 max-w-xl text-lg text-hell/80">{e.texte.karriereText}</p>
        </div>
      </section>

      <section aria-labelledby="stellen-titel" className="rand pt-16 md:pt-24">
        <h2 id="stellen-titel" className="schmal mb-8 text-3xl sm:text-4xl md:text-6xl">
          Offene Stellen
        </h2>
        {liste.length ? (
          <ul className="grid gap-4 md:grid-cols-2">
            {liste.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/karriere/${s.id}`}
                  className="group flex h-full flex-col rounded-lg bg-flaeche p-6 ring-1 ring-linie transition-colors hover:ring-grau-hell md:p-8"
                >
                  <span className="flex flex-wrap gap-2 text-sm">
                    {[s.umfang, "Dietzenbach"].filter(Boolean).map((x) => (
                      <span key={x} className="rounded-md bg-white/[0.07] px-2.5 py-1">
                        {x}
                      </span>
                    ))}
                  </span>
                  <span className="schmal mt-5 block text-3xl md:text-4xl">{s.titel}</span>
                  {s.einleitung ? <span className="mt-3 line-clamp-2 block text-grau">{s.einleitung}</span> : null}
                  <span className="mt-auto inline-flex items-center gap-2 pt-6 text-sm font-semibold text-tinte/70 group-hover:text-tinte">
                    Stelle ansehen und bewerben <Pfeil className="size-4 transition-transform group-hover:translate-x-1" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-lg bg-flaeche p-6 text-grau ring-1 ring-linie md:p-8">Gerade ist keine Stelle ausgeschrieben. Eine Initiativbewerbung freut uns trotzdem.</p>
        )}
      </section>

      {/* Breite innen begrenzt, nicht an der Box mit „rand“ (siehe Fehlerbuch: rand mit max-w) */}
      <section aria-labelledby="initiativ-titel" className="rand pb-24 pt-20 md:pt-28">
        {/* Grund „papier“ wie auf der Stellenseite, damit die Felder (Fläche) sich abheben */}
        <div className="mx-auto max-w-2xl rounded-lg bg-papier p-6 ring-1 ring-linie md:p-10">
          <h2 id="initiativ-titel" className="schmal mb-2 text-3xl md:text-4xl">
            Initiativ bewerben
          </h2>
          <p className="mb-8 text-grau">Name und Telefonnummer reichen. Wir rufen Sie an.</p>
          <BewerbungsFormular stelle="initiativ" />
        </div>
      </section>
    </>
  );
}
