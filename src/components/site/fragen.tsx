import type { Einstellungen } from "@/lib/einstellungen";

/** Häufige Fragen, aus der bisherigen Website übernommen und ergänzt. Aufklappbar ohne JavaScript. */
export function Fragen({ e }: { e: Einstellungen }) {
  const fragen: [string, string][] = [
    ["Brauche ich einen Termin?", "Am besten ja, dann steht ein Platz für Sie bereit. Kurzfristige Termine sind oft möglich, rufen Sie einfach an."],
    ["Wie lange dauert ein Radwechsel?", "In der Regel etwa 30 Minuten. Sie können in der Zeit warten."],
    ["Lagern Sie meine Räder ein?", "Ja. Wir notieren Profiltiefe und Zustand und erinnern Sie zum nächsten Saisonwechsel."],
    ["Sind die Preise wirklich fest?", "Ja. Die Preise auf dieser Seite sind Endpreise inklusive Mehrwertsteuer. Bei Reparaturen und Inspektionen nennen wir Ihnen den Preis, bevor wir anfangen."],
    ["Wie kann ich bezahlen?", "Bar oder per Überweisung. Auf der Rechnung ist ein QR-Code, den Ihre Banking-App lesen kann."],
    ["Wo genau ist der Eingang?", e.firma.hinweisAnfahrt],
    ["Kann ich einen Termin absagen?", `Ja, bis ${e.buchung.stornoFristStd} Stunden vorher über den Link in Ihrer Bestätigungsmail. Danach bitte anrufen.`],
  ];
  return (
    <div className="divide-y divide-linie border-y border-linie">
      {fragen.map(([f, a]) => (
        <details key={f} className="group py-1">
          <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 font-semibold [&::-webkit-details-marker]:hidden">
            {f}
            <span aria-hidden className="text-xl leading-none text-grau transition-transform group-open:rotate-45">
              +
            </span>
          </summary>
          <p className="max-w-prose pb-4 text-grau">{a}</p>
        </details>
      ))}
    </div>
  );
}
