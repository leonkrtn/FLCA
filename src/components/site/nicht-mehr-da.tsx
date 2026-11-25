import Link from "next/link";
import { einstellungen } from "@/lib/einstellungen";
import { telHref } from "@/lib/format";

/**
 * Kundenlink ins Leere: Termin oder Kostenvoranschlag gibt es nicht mehr (gelöscht, Link vertippt). Der Kunde
 * kam aus einer Mail von uns, deshalb kein nacktes „404“, sondern eine freundliche Erklärung und ein Weg weiter.
 */
export async function NichtMehrDa({ was }: { was: "Termin" | "Kostenvoranschlag" }) {
  const { firma, buchung } = await einstellungen();
  const artikel = was === "Termin" ? "Dieser Termin" : "Dieser Kostenvoranschlag";
  return (
    <div className="rand flex min-h-[60dvh] flex-col justify-center pb-24 pt-8 *:max-w-2xl md:pt-14">
      <p className="mb-2 text-sm font-medium uppercase tracking-[0.14em] text-grau">Ihr {was}</p>
      {/* Kurze Überschrift: „Kostenvoranschlag“ in Barlow Condensed groß bricht auf schmalen Telefonen mitten im Wort. */}
      <h1 className="schmal mb-4 text-4xl md:text-5xl">Nicht mehr verfügbar.</h1>
      <p className="mb-8 text-lg">
        {artikel} wurde aus unserer Planung genommen, zum Beispiel weil sich etwas geändert hat oder er durch einen neuen
        ersetzt wurde. Haben Sie Fragen oder möchten Sie einen neuen Termin, sind wir gern für Sie da.
      </p>
      <div className="flex flex-wrap gap-3">
        <a href={telHref(firma.telefon)} className="knopf knopf-rot">Anrufen</a>
        {buchung.aktiv ? <Link href="/termin" className="knopf knopf-rahmen">Termin anfragen</Link> : null}
        <Link href="/" className="knopf knopf-rahmen">Zur Startseite</Link>
      </div>
    </div>
  );
}
