import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { VorherNachher } from "@/components/site/vorher-nachher";
import { einstellungen } from "@/lib/einstellungen";
import { galerie } from "@/lib/inhalte";

export const revalidate = 300;
export const metadata: Metadata = { title: "Vorher und nachher", description: "Fahrzeugaufbereitung bei FLC Automotive: Ergebnisse im Vergleich." };

export default async function GalerieSeite() {
  const [e, eintraege] = await Promise.all([einstellungen(), galerie()]);
  if (!e.module.galerie) notFound();
  return (
    <div className="rand pb-24 pt-8 md:pt-14">
      <h1 className="schmal mb-3 text-4xl md:text-5xl">Vorher und nachher</h1>
      <p className="mb-12 max-w-xl text-grau">Ziehen Sie den Regler, um den Zustand vor und nach der Aufbereitung zu vergleichen.</p>
      {eintraege.length ? (
        <div className="grid gap-12 md:grid-cols-2">
          {eintraege.map((g) => (
            <figure key={g.id}>
              <VorherNachher vorher={g.vorher} nachher={g.nachher} titel={g.titel} />
              <figcaption className="mt-3">
                <span className="font-semibold">{g.titel}</span>
                {g.beschreibung ? <span className="block text-grau">{g.beschreibung}</span> : null}
              </figcaption>
            </figure>
          ))}
        </div>
      ) : (
        <p className="bg-papier p-6 text-grau">Die ersten Vorher-nachher-Bilder kommen in Kürze.</p>
      )}
    </div>
  );
}
