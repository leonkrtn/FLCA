import { notFound } from "next/navigation";
import { HtmlInhalt } from "@/components/mail/html-inhalt";
import { AutoDrucken } from "@/components/mail/auto-drucken";
import { benutzerMitRecht } from "@/lib/auth";
import { datumZeit } from "@/lib/format";
import { gespraechLaden, mailLaden, zugang } from "@/lib/mail/postfach";

export const metadata = { title: "Mail drucken", robots: { index: false } };

/**
 * Druckansicht einer Unterhaltung (oder mit `?e=1` einer Mail): schlicht, hell, ohne Navigation. Öffnet den
 * Druckdialog von selbst; dort lässt sie sich auch als PDF sichern.
 */
export default async function MailDrucken({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ e?: string }> }) {
  const b = await benutzerMitRecht("werkstatt");
  const z = await zugang(b);
  const [{ id }, { e }] = await Promise.all([params, searchParams]);
  const mails = e === "1" ? await mailLaden(z, id).then((m) => (m ? [m] : null)) : await gespraechLaden(z, id);
  if (!mails?.length) notFound();
  return (
    <main className="mx-auto max-w-3xl bg-white p-8 text-black print:p-0">
      <AutoDrucken />
      <h1 className="mb-6 text-2xl font-semibold">{mails.at(-1)!.betreff || "(ohne Betreff)"}</h1>
      {mails.map((m) => (
        <article key={m.id} className="mb-8 break-inside-avoid-page border-t border-gray-300 pt-4">
          <dl className="mb-4 grid grid-cols-[5rem_minmax(0,1fr)] gap-x-3 text-sm">
            <dt className="font-semibold">Von</dt>
            <dd>{m.von_name ? `${m.von_name} <${m.von}>` : m.von}</dd>
            <dt className="font-semibold">An</dt>
            <dd>{m.an.join(", ")}</dd>
            {m.cc.length ? (
              <>
                <dt className="font-semibold">Cc</dt>
                <dd>{m.cc.join(", ")}</dd>
              </>
            ) : null}
            <dt className="font-semibold">Datum</dt>
            <dd>{datumZeit(m.erstellt_am)}</dd>
            <dt className="font-semibold">Betreff</dt>
            <dd>{m.betreff}</dd>
            {m.anhaenge.length ? (
              <>
                <dt className="font-semibold">Anhänge</dt>
                <dd>{m.anhaenge.map((a) => a.name).join(", ")}</dd>
              </>
            ) : null}
          </dl>
          {m.html ? <HtmlInhalt html={m.html} /> : <div className="whitespace-pre-wrap">{m.text}</div>}
        </article>
      ))}
    </main>
  );
}
