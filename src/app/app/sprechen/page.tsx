import { MobilKopf } from "@/components/mobil/teile";
import { SprachEingabe } from "@/components/mobil/sprach-eingabe";
import { spracheUebernehmen } from "@/lib/aktionen/sprache";
import { benutzerMitRecht } from "@/lib/auth";
import { einstellungen } from "@/lib/einstellungen";
import { notizTeam } from "@/lib/notizen-seiten";
import { preislisteFuerBelege } from "@/lib/rechnung/rechnungen";
import { db } from "@/lib/supabase/admin";
import { istTerminLeistung, type Leistung } from "@/lib/termine";

export const metadata = { title: "Sprechen" };

/** Notiz, Termin oder Rechnung per Sprache. Erkennung mit festen Regeln im Code, siehe `src/lib/sprache/`. */
export default async function Sprechen() {
  await benutzerMitRecht("termine");
  const [{ data: l }, team, preisliste, e] = await Promise.all([
    db().from("leistungen").select("*").order("sortierung"),
    notizTeam(),
    preislisteFuerBelege(),
    einstellungen(),
  ]);
  const leistungen = ((l ?? []) as Leistung[]).filter(istTerminLeistung).map((x) => ({ id: x.id, name: x.name }));
  return (
    <>
      <MobilKopf titel="Sprechen" unter="Notiz, Termin oder Rechnung" />
      <SprachEingabe
        aktion={spracheUebernehmen}
        leistungen={leistungen}
        team={team}
        grundlagen={{ preisliste, stundensaetze: e.rechnung.stundensaetze, aufschlagProzent: e.rechnung.aufschlagProzent }}
      />
    </>
  );
}
