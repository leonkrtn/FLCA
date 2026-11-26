import type { Metadata } from "next";
import { einstellungen } from "@/lib/einstellungen";
import { widerrufHtml } from "@/lib/rechtstexte-standard";

export const revalidate = 3600;
export const metadata: Metadata = { title: "Widerrufsbelehrung" };

/** Immer der Mustertext mit den Firmendaten aus den Einstellungen, nie ein Ersatztext (siehe widerrufAbschnitte). */
export default async function Widerruf() {
  const { firma } = await einstellungen();
  return (
    <article className="rand pb-24 *:max-w-3xl pt-8 md:pt-14">
      <h1 className="schmal mb-8 text-4xl md:text-5xl">Widerrufsbelehrung</h1>
      <div className="rechtstext" dangerouslySetInnerHTML={{ __html: widerrufHtml(firma) }} />
    </article>
  );
}
