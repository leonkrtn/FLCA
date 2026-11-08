import type { Metadata } from "next";
import { einstellungen } from "@/lib/einstellungen";
import { rechtstext } from "@/lib/rechtstexte";

export const revalidate = 86400;
export const metadata: Metadata = { title: "AGB" };

export default async function Agb() {
  const [{ html, quelle }, { firma }] = await Promise.all([rechtstext("agb"), einstellungen()]);
  return (
    <article className="rand max-w-3xl pb-24 pt-8 md:pt-14">
      <h1 className="schmal mb-8 text-4xl md:text-5xl">Allgemeine Geschäftsbedingungen</h1>
      {quelle === "fehlt" ? (
        <p>
          Die AGB werden gerade eingerichtet. Sie erhalten sie auf Anfrage unter{" "}
          <a href={`mailto:${firma.email}`} className="underline">
            {firma.email}
          </a>
          .
        </p>
      ) : (
        <div className="rechtstext" dangerouslySetInnerHTML={{ __html: html }} />
      )}
    </article>
  );
}
