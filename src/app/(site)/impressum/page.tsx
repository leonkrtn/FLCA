import type { Metadata } from "next";
import { einstellungen } from "@/lib/einstellungen";

export const revalidate = 300;
export const metadata: Metadata = { title: "Impressum" };

export default async function Impressum() {
  const { firma: f } = await einstellungen();
  return (
    <article className="rand max-w-3xl pb-24 pt-8 md:pt-14">
      <h1 className="schmal mb-8 text-4xl md:text-5xl">Impressum</h1>
      <div className="rechtstext">
        <h2>Angaben gemäß § 5 DDG</h2>
        <p>
          {f.name}
          <br />
          Inhaber: {f.inhaber}
          {f.rechtsform ? ` (${f.rechtsform})` : ""}
          <br />
          {f.strasse}
          <br />
          {f.plz} {f.ort}
        </p>
        <h2>Kontakt</h2>
        <p>
          Telefon: {f.telefon}
          <br />
          E-Mail: {f.email}
        </p>
        {f.ustId ? (
          <>
            <h2>Umsatzsteuer</h2>
            <p>Umsatzsteuer-Identifikationsnummer gemäß § 27a UStG: {f.ustId}</p>
          </>
        ) : null}
        <h2>Berufsbezeichnung</h2>
        <p>
          {f.titel} (verliehen in der Bundesrepublik Deutschland).{f.kammer ? ` Zuständige Kammer: ${f.kammer}.` : ""}
        </p>
        <h2>Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV</h2>
        <p>
          {f.inhaber}, {f.strasse}, {f.plz} {f.ort}
        </p>
        <h2>Verbraucherstreitbeilegung</h2>
        <p>Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.</p>
      </div>
    </article>
  );
}
