import type { Metadata } from "next";
import { Abmelden } from "./abmelden";

export const metadata: Metadata = { title: "Abmelden", robots: { index: false } };

/**
 * Abmeldelink aus Erinnerungs- und Bewertungsmails. Erst ein Knopf meldet ab: Virenscanner und Mailprogramme
 * rufen Links in Mails oft vorab auf, ein Abmelden schon beim Öffnen träfe Kunden, die gar nicht wollten.
 */
export default async function AbmeldenSeite({ params }: { params: Promise<{ id: string; schluessel: string }> }) {
  const { id, schluessel } = await params;
  return (
    <article className="rand pb-24 *:max-w-2xl pt-8 md:pt-14">
      <h1 className="schmal mb-6 text-4xl md:text-5xl">Abmelden</h1>
      <p className="mb-6">Sie bekommen dann keine Erinnerungen (z. B. Reifenwechsel, HU) und keine Bitten um eine Bewertung mehr. Mails zu Ihren Terminen, Aufträgen und Rechnungen kommen weiter.</p>
      <Abmelden id={id} schluessel={schluessel} />
    </article>
  );
}
