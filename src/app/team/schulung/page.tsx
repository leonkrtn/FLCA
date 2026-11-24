import { MobilKopf } from "@/components/mobil/teile";
import { SchulungSuche } from "@/components/mobil/schulung-suche";
import { benutzerMitRecht } from "@/lib/auth";
import { weich } from "@/lib/fehler";
import { schulungLaden, sichtbar } from "@/lib/schulung/daten";

export const metadata = { title: "Schulung" };

/** Schulung in der Team-App: veröffentlichte Lektionen nach Kategorien, mit Suche. Für alle mit Konto. */
export default async function TeamSchulung() {
  await benutzerMitRecht("werkstatt");
  // Fehlt die Migration oder klemmt die Datenbank, steht eine leere Schulung da statt einer Fehlerseite
  const { kategorien, lektionen } = await weich(schulungLaden(), { kategorien: [], lektionen: [], unmigriert: true }, "Schulung in der Team-App");
  const liste = lektionen.filter(sichtbar).map((l) => ({
    id: l.id,
    kategorie_id: l.kategorie_id,
    titel: l.titel,
    kurz: l.kurz,
    inhalt: l.inhalt,
    schlagwoerter: l.schlagwoerter,
    werkzeug: l.werkzeug,
    dauer_min: l.dauer_min,
    video: Boolean(l.video_url),
  }));
  return (
    <>
      <MobilKopf titel="Schulung" unter="Anleitungen und Videos" zurueck="/team/mehr" />
      <SchulungSuche kategorien={kategorien.map((k) => ({ id: k.id, name: k.name }))} lektionen={liste} />
    </>
  );
}
