import { Formular, Senden } from "@/components/admin/formular";
import { loeschenAktion } from "@/lib/aktionen/termine";

/**
 * „Termin löschen“ mit Rückfrage. Ist ein Termin noch angefragt oder bestätigt, erinnert die Frage an
 * „Absagen“: Nur das schickt dem Kunden eine Mail, das Löschen geschieht still.
 */
export function TerminLoeschen({
  id,
  status,
  ziel,
  kal,
  gross = false,
}: {
  id: string;
  status: string;
  ziel: "/admin/termine" | "/app";
  /** Aus dem Kalender geöffnet (`?kal=…`): nach dem Löschen dorthin zurück */
  kal?: string;
  /** Handy-App: volle Breite in normaler Knopfgröße */
  gross?: boolean;
}) {
  const steht = ["angefragt", "bestaetigt"].includes(status);
  const frage = [
    "Termin endgültig löschen?",
    "Fotos, Verlauf und Kostenvoranschläge zum Termin werden mitgelöscht. Rechnungen zum Termin bleiben erhalten.",
    steht ? "Der Kunde bekommt keine Nachricht. Soll er Bescheid bekommen, den Termin vorher absagen." : "",
  ]
    .filter(Boolean)
    .join("\n\n");
  return (
    <Formular aktion={loeschenAktion.bind(null, ziel, id)} bestaetigen={frage}>
      {kal ? <input type="hidden" name="kal" value={kal} /> : null}
      <Senden art="rahmen" klein={!gross} className={`text-fehler ${gross ? "w-full" : ""}`} vorab="Gelöscht">
        Termin löschen
      </Senden>
    </Formular>
  );
}
