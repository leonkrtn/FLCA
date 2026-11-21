import "server-only";
import { einstellungen } from "../einstellungen";
import { fahrzeugTypen } from "../kunden";
import { belegTyp, bezeichnungen, gemerktFuer, paketeListe } from "./preisgedaechtnis";
import { preislisteFuerBelege, type Rechnung } from "./rechnungen";

/**
 * Alles, was der Beleg-Editor außer dem Beleg selbst braucht: Preisliste, Stundensätze, Aufschlag, Pakete,
 * Vorschläge für Bezeichnungen und Fahrzeugtypen und die gemerkten Preise für das Auto auf dem Beleg.
 * Verwaltung und Handy-App laden es gleich.
 */
export async function editorDaten(fahrzeug: Rechnung["fahrzeug"] | null | undefined) {
  const typ = belegTyp(fahrzeug);
  const [preisliste, e, pakete, texte, typen, gemerkt] = await Promise.all([
    preislisteFuerBelege(),
    einstellungen(),
    paketeListe(),
    bezeichnungen(),
    fahrzeugTypen(),
    gemerktFuer(typ.marke, typ.modell),
  ]);
  return {
    preisliste,
    preise: { stundensaetze: e.rechnung.stundensaetze, aufschlagProzent: e.rechnung.aufschlagProzent },
    pakete,
    bezeichnungen: texte,
    typen,
    gemerkt,
  };
}

export type EditorDaten = Awaited<ReturnType<typeof editorDaten>>;
