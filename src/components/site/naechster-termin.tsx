import { KONFIGURIERT } from "@/lib/env";
import { datumKurzText } from "@/lib/format";
import { freieTermine, type Leistung } from "@/lib/termine";
import { berlinDatum } from "@/lib/zeit";

/** „Nächster freier Termin: Di., 01.12. 10:30“ für eine kurze Leistung. Fehler blenden den Hinweis nur aus. */
export async function NaechsterTermin({ leistung }: { leistung: Leistung | undefined }) {
  if (!leistung || !KONFIGURIERT.supabaseAdmin) return null;
  let tag: { datum: string; slots: string[] } | undefined;
  try {
    tag = (await freieTermine(leistung, berlinDatum(), 21)).find((t) => t.slots.length);
  } catch (error) {
    console.error(error);
  }
  if (!tag) return null;
  return (
      <p className="text-sm">
        <span className="text-grau">Nächster freier Termin für {leistung.name}: </span>
        <span className="zahlen font-medium">
          {datumKurzText(tag.datum)} {tag.slots[0]}
        </span>
      </p>
  );
}
