"use client";

/**
 * Öffnet WhatsApp mit vorausgefüllter Nachricht. Der Vermerk im Verlauf läuft nebenher und hält den Link
 * nicht auf, sonst blockt iOS das Öffnen der App.
 */
export function WhatsappKnopf({ href, vermerken, className = "knopf knopf-rahmen", children = "WhatsApp" }: { href: string; vermerken?: () => Promise<void>; className?: string; children?: React.ReactNode }) {
  return (
    <a href={href} className={className} rel="noopener noreferrer" onClick={() => void vermerken?.()}>
      {children}
    </a>
  );
}
