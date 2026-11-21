import Link from "next/link";
import { Formular, Senden } from "./formular";
import { PositionenUebersicht } from "./positionen-uebersicht";
import { Feld } from "./ui";
import { bezahltAktion, stornoAktion, unbezahltAktion, versendenAktion } from "@/lib/aktionen/rechnungen";
import { datum, datumZeit } from "@/lib/format";
import type { Rechnung } from "@/lib/rechnung/rechnungen";
import { berlinDatum } from "@/lib/zeit";

/** Gestellte Rechnung: nur noch ansehen, senden, Zahlung vermerken, stornieren. */
export function RechnungAnsicht({ r, basis, pdfHref }: { r: Rechnung; basis: "/admin/rechnungen" | "/app/rechnungen"; pdfHref: string }) {
  // Mit Leitweg-ID (Behörde) ist die E-Rechnung eine XRechnung, sonst ZUGFeRD EN 16931 (siehe zugferd.ts).
  const xrechnung = Boolean(r.empfaenger.leitweg_id?.trim());
  return (
    <div className="grid gap-6">
      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        <a href={pdfHref} target="_blank" className="knopf knopf-dunkel">PDF öffnen</a>
        <a href={`/admin/rechnungen/${r.id}/xml`} className="knopf knopf-rahmen">{xrechnung ? "XRechnung (XML)" : "E-Rechnung (XML)"}</a>
        {r.status === "gestellt" ? (
          <Formular aktion={bezahltAktion.bind(null, r.id)} className="contents">
            <input type="hidden" name="am" value={berlinDatum()} />
            <Senden art="rahmen" name="zahlungsart" value="bar" vorab="Bezahlt">Bar bezahlt</Senden>
            <Senden art="rahmen" name="zahlungsart" value="ueberweisung" vorab="Bezahlt">Überweisung da</Senden>
          </Formular>
        ) : r.status === "bezahlt" ? (
          <Formular aktion={unbezahltAktion.bind(null, r.id)} className="contents">
            <Senden art="rahmen" vorab="Wird zurückgesetzt">Nicht bezahlt</Senden>
          </Formular>
        ) : null}
      </div>

      <PositionenUebersicht positionen={r.positionen} />

      <dl className="grid gap-y-1 text-sm sm:grid-cols-[10rem_minmax(0,1fr)]">
        <dt className="text-grau">Empfänger</dt>
        <dd>{[r.empfaenger.firma, r.empfaenger.name].filter(Boolean).join(", ")}</dd>
        <dt className="text-grau">E-Rechnung</dt>
        <dd>{xrechnung ? `XRechnung 3.0, Leitweg-ID ${r.empfaenger.leitweg_id}` : "ZUGFeRD / Factur-X (EN 16931), im PDF eingebettet"}</dd>
        <dt className="text-grau">Rechnungsdatum</dt>
        <dd>{datum(r.rechnungsdatum)}</dd>
        <dt className="text-grau">Fällig</dt>
        <dd>{datum(r.faellig_am)}</dd>
        <dt className="text-grau">Versendet</dt>
        <dd>{r.gesendet_am ? `${datumZeit(r.gesendet_am)} an ${r.gesendet_an}` : "noch nicht"}</dd>
        {r.bezahlt_am ? (
          <>
            <dt className="text-grau">Bezahlt</dt>
            <dd>{datum(r.bezahlt_am)} ({r.zahlungsart === "bar" ? "bar" : "Überweisung"})</dd>
          </>
        ) : null}
      </dl>

      <Formular aktion={versendenAktion.bind(null, r.id)} className="grid max-w-md gap-2">
        <Feld label="Per E-Mail senden an" name="an" typ="email" wert={r.gesendet_an ?? r.empfaenger.email ?? ""} />
        <Senden art="rahmen" vorab="Wird gesendet">{r.gesendet_am ? "Erneut senden" : "Senden"}</Senden>
      </Formular>

      {r.status !== "storniert" && !r.storno_zu ? (
        <details className="text-sm">
          <summary className="cursor-pointer text-grau">Rechnung stornieren …</summary>
          <form action={stornoAktion.bind(null, r.id, basis)} className="mt-3">
            <p className="mb-3 max-w-md">Es entsteht eine Stornorechnung mit eigener Nummer und negativen Beträgen. Die Originalrechnung bleibt erhalten. Danach können Sie eine neue Rechnung stellen.</p>
            <button className="knopf knopf-rahmen knopf-klein">Stornorechnung erstellen</button>
          </form>
        </details>
      ) : null}
      {r.termin_id ? (
        <Link href={basis === "/app/rechnungen" ? `/app/termine/${r.termin_id}` : `/admin/termine/${r.termin_id}`} className="text-sm underline">zum Termin</Link>
      ) : null}
    </div>
  );
}
