import type { Metadata } from "next";
import { einstellungen } from "@/lib/einstellungen";

export const revalidate = 300;
export const metadata: Metadata = { title: "Impressum" };

export default async function Impressum() {
  const { firma: f } = await einstellungen();
  return (
    <article className="rand pb-24 *:max-w-3xl pt-8 md:pt-14">
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
        <h2>Haftungsausschluss</h2>
        <h3>Haftung für Inhalte</h3>
        <p>
          Als Diensteanbieter sind wir gemäß § 7 Abs. 1 DDG für eigene Inhalte auf diesen Seiten nach den allgemeinen Gesetzen verantwortlich. Nach §§ 8 bis 10
          DDG sind wir als Diensteanbieter jedoch nicht verpflichtet, übermittelte oder gespeicherte fremde Informationen zu überwachen oder nach Umständen zu
          forschen, die auf eine rechtswidrige Tätigkeit hinweisen.
        </p>
        <h3>Haftung für Links</h3>
        <p>
          Unser Angebot enthält Links zu externen Websites Dritter, auf deren Inhalte wir keinen Einfluss haben. Deshalb können wir für diese fremden Inhalte
          auch keine Gewähr übernehmen. Für die Inhalte der verlinkten Seiten ist stets der jeweilige Anbieter oder Betreiber der Seiten verantwortlich.
        </p>
        <h3>Urheberrecht</h3>
        <p>
          Die durch die Seitenbetreiber erstellten Inhalte und Werke auf diesen Seiten unterliegen dem deutschen Urheberrecht. Die Vervielfältigung,
          Bearbeitung, Verbreitung und jede Art der Verwertung außerhalb der Grenzen des Urheberrechtes bedürfen der schriftlichen Zustimmung des jeweiligen
          Autors bzw. Erstellers.
        </p>
      </div>
    </article>
  );
}
