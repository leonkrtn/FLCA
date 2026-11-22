import Link from "next/link";
import { Formular, Senden } from "./formular";
import { DateiKnopf } from "@/components/mobil/datei-knopf";
import { PositionenUebersicht } from "./positionen-uebersicht";
import { Feld } from "./ui";
import { bezahltAktion, korrekturAktion, stornoAktion, unbezahltAktion, versendenAktion } from "@/lib/aktionen/rechnungen";
import { datum, datumZeit, euro } from "@/lib/format";
import { fassungsNummer, offenerBetrag } from "@/lib/rechnung/korrektur";
import type { Bezug, KorrekturStand, Rechnung } from "@/lib/rechnung/rechnungen";
import { berlinDatum } from "@/lib/zeit";

/** Gestellte Rechnung: nur noch ansehen, senden, Zahlung vermerken, korrigieren, stornieren. */
export function RechnungAnsicht({
  r,
  basis,
  pdfHref,
  bezuege,
}: {
  r: Rechnung;
  basis: "/admin/rechnungen" | "/app/rechnungen";
  pdfHref: string;
  bezuege: { original: Bezug | null; stornoDesOriginals: Bezug | null; storno: Bezug | null; korrektur: Bezug | null };
}) {
  // Mit Leitweg-ID (Behörde) ist die E-Rechnung eine XRechnung, sonst ZUGFeRD EN 16931 (siehe zugferd.ts).
  const xrechnung = Boolean(r.empfaenger.leitweg_id?.trim());
  const verweis = (b: Bezug) => (
    <Link href={`${basis}/${b.id}`} className="underline">
      {b.nummer ?? "Entwurf"}
    </Link>
  );
  const bereits = r.bereits_bezahlt_cent ?? 0;
  const offen = offenerBetrag(r);
  const korrigierbar = ["gestellt", "bezahlt"].includes(r.status) && !r.storno_zu;
  const korrekturEntwurf = bezuege.korrektur?.status === "entwurf" ? bezuege.korrektur : null;
  return (
    <div className="grid gap-6">
      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        <DateiKnopf art="datei" href={pdfHref} className="knopf knopf-dunkel">PDF öffnen</DateiKnopf>
        <DateiKnopf art="datei" href={`/admin/rechnungen/${r.id}/xml`} className="knopf knopf-rahmen">{xrechnung ? "XRechnung (XML)" : "E-Rechnung (XML)"}</DateiKnopf>
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
        {r.korrektur_zu && bezuege.original ? (
          <>
            <dt className="text-grau">Berichtigt</dt>
            <dd>
              Ersetzt Rechnung {verweis(bezuege.original)}
              {bezuege.original.rechnungsdatum ? ` vom ${datum(bezuege.original.rechnungsdatum)}` : ""}
              {bezuege.stornoDesOriginals ? <>, storniert durch {verweis(bezuege.stornoDesOriginals)}</> : null}
            </dd>
            <dt className="text-grau">Grund</dt>
            <dd>{r.korrektur_grund || "–"}</dd>
          </>
        ) : null}
        {r.storno_zu && bezuege.original ? (
          <>
            <dt className="text-grau">Storniert</dt>
            <dd>Rechnung {verweis(bezuege.original)}</dd>
          </>
        ) : null}
        {r.status === "storniert" ? (
          <>
            <dt className="text-grau">Storniert durch</dt>
            <dd>{bezuege.storno ? verweis(bezuege.storno) : "–"}</dd>
          </>
        ) : null}
        {bezuege.korrektur && bezuege.korrektur.status !== "entwurf" ? (
          <>
            <dt className="text-grau">Ersetzt durch</dt>
            <dd>Berichtigte Rechnung {verweis(bezuege.korrektur)}</dd>
          </>
        ) : null}
        {bereits ? (
          <>
            <dt className="text-grau">Bereits bezahlt</dt>
            <dd className="zahlen">
              {euro(bereits)} auf {bezuege.original?.nummer ?? "das Original"}, {offen < 0 ? `zu erstatten ${euro(-offen)}` : offen > 0 ? `offen ${euro(offen)}` : "nichts mehr offen"}
            </dd>
          </>
        ) : null}
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

      {korrigierbar ? (
        korrekturEntwurf ? (
          <p className="text-sm">
            Die Korrektur ist begonnen:{" "}
            <Link href={`${basis}/${korrekturEntwurf.id}`} className="font-semibold underline">
              Korrekturentwurf bearbeiten
            </Link>
          </p>
        ) : (
          <details className="text-sm">
            <summary className="cursor-pointer text-grau">Rechnung korrigieren …</summary>
            <Formular aktion={korrekturAktion.bind(null, r.id, basis)} className="mt-3 grid max-w-md gap-3">
              <p>
                Es entsteht ein Entwurf mit allen Angaben dieser Rechnung, in dem sich alles ändern lässt. Beim Stellen wird diese Rechnung storniert (Stornorechnung mit eigener Nummer) und die neue Fassung als{" "}
                <span className="zahlen">{fassungsNummer(r.nummer ?? "", Boolean(r.korrektur_zu), r.nummer ? [r.nummer] : [])}</span> gestellt.
                {r.status === "bezahlt" ? " Die Zahlung wird verrechnet: Ist die neue Fassung teurer, bleibt der Unterschied offen." : ""}
              </p>
              <label className="block">
                <span className="label">Grund der Korrektur (Pflicht, steht auf der Rechnung)</span>
                <input name="grund" required minLength={3} maxLength={300} placeholder="z. B. falsche Anschrift, Position vergessen" className="feld" />
              </label>
              <Senden art="rahmen" klein className="justify-self-start" vorab="Entwurf wird angelegt">
                Korrektur beginnen
              </Senden>
            </Formular>
          </details>
        )
      ) : null}
      {r.status !== "storniert" && !r.storno_zu ? (
        <details className="text-sm">
          <summary className="cursor-pointer text-grau">Rechnung stornieren …</summary>
          <form action={stornoAktion.bind(null, r.id, basis)} className="mt-3">
            <p className="mb-3 max-w-md">Es entsteht eine Stornorechnung mit eigener Nummer und negativen Beträgen. Die Originalrechnung bleibt erhalten. Danach können Sie eine neue Rechnung stellen.</p>
            <Senden art="rahmen" klein>Stornorechnung erstellen</Senden>
          </form>
        </details>
      ) : null}
      {r.termin_id ? (
        <Link href={basis === "/app/rechnungen" ? `/app/termine/${r.termin_id}` : `/admin/termine/${r.termin_id}`} className="text-sm underline">zum Termin</Link>
      ) : null}
    </div>
  );
}

/** Steht über dem Editor eines Korrekturentwurfs: was beim Stellen passiert. */
export function KorrekturHinweis({ k, basis }: { k: KorrekturStand; basis: "/admin/rechnungen" | "/app/rechnungen" }) {
  return (
    <div className="mb-6 grid gap-1 border-l-4 border-tinte bg-papier p-4 text-sm">
      <p className="font-semibold">
        Korrektur zu Rechnung{" "}
        <Link href={`${basis}/${k.id}`} className="underline">
          {k.original}
        </Link>
        {k.datum ? ` vom ${datum(k.datum)}` : ""}
      </p>
      <p>Grund: {k.grund || "–"}</p>
      <p>
        Beim Stellen wird {k.original} storniert (Stornorechnung mit eigener Nummer), diese Fassung wird <span className="zahlen">{k.fassung}</span>.
        {k.bereits ? ` Auf ${k.original} sind schon ${euro(k.bereits)} bezahlt, das wird verrechnet.` : ""} Wer die Korrektur verwerfen will, löscht den Entwurf; {k.original} bleibt dann unverändert gültig.
      </p>
    </div>
  );
}
