"use client";

/**
 * Öffnet WhatsApp mit vorausgefüllter Nachricht. Der Vermerk im Verlauf läuft nebenher und hält den Link
 * nicht auf, sonst blockt iOS das Öffnen der App. `ohneEinwilligung`: Der Kunde hat WhatsApp nicht erlaubt
 * (Kundenbildschirm oder Kundenakte); dann erst nachfragen, statt einfach zu schreiben.
 */
export function WhatsappKnopf({
  href,
  vermerken,
  ohneEinwilligung = false,
  className = "knopf knopf-rahmen",
  children = "WhatsApp",
}: {
  href: string;
  vermerken?: () => Promise<void>;
  ohneEinwilligung?: boolean;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <a
      href={href}
      className={className}
      rel="noopener noreferrer"
      onClick={(e) => {
        if (ohneEinwilligung && !window.confirm("Für diesen Kunden ist keine Erlaubnis für WhatsApp gespeichert. Am besten vorher fragen und in der Kundenakte eintragen.\n\nTrotzdem öffnen?")) {
          e.preventDefault();
          return;
        }
        void vermerken?.();
      }}
    >
      {children}
    </a>
  );
}
