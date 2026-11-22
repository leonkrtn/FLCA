import "server-only";
import { melden } from "../ereignisse";
import { markeModellTrennen } from "../rechnung/aehnlich";
import { db } from "../supabase/admin";
import { type AltKunde, nameNorm, type Plan, zaehlen } from "./lesen";

export type Bericht = {
  probelauf: boolean;
  kunden: { neu: number; vorhanden: number };
  fahrzeuge: { neu: number; ergaenzt: number };
  rechnungen: { neu: number; vorhanden: number };
  positionen: number;
  hinweise: string[];
};

type Kartei = { id: string; name: string; firma: string; strasse: string; plz: string; ort: string; notiz: string };
type Auto = { id: string; kunde_id: string | null; kennzeichen: string; kennzeichen_norm: string; km_stand: number | null; marke_modell: string };

const kzNorm = (s: string) => s.toUpperCase().replace(/[^A-ZÄÖÜ0-9]/g, "");
const gleich = (a?: string | null, b?: string | null) => nameNorm(a ?? "") === nameNorm(b ?? "");
const GROSS = 10000;

/**
 * Schreibt einen Plan aus `planen()` in Kartei, Fahrzeuge und frühere Rechnungen. Beliebig oft
 * wiederholbar: Kunden werden über Name und Anschrift (oder ein gemeinsames Kennzeichen) wiedergefunden,
 * Fahrzeuge über das Kennzeichen, Rechnungen über den Dateinamen. Vorhandenes wird nur ergänzt (leere
 * Felder, höherer KM-Stand), nie überschrieben, und ein Auto, das in der Kartei schon einem anderen Kunden
 * gehört, bleibt dort.
 *
 * `probelauf`: alles prüfen und zählen, nichts schreiben.
 */
export async function uebernehmen(plan: Plan, probelauf: boolean): Promise<Bericht> {
  const bericht: Bericht = { probelauf, kunden: { neu: 0, vorhanden: 0 }, fahrzeuge: { neu: 0, ergaenzt: 0 }, rechnungen: { neu: 0, vorhanden: 0 }, positionen: 0, hinweise: [...plan.hinweise] };

  // Einmal alles laden statt je Kunde zu fragen: Der Bestand einer Werkstatt passt locker in den Speicher.
  const [{ data: kd }, { data: fd }, { data: rd }] = await Promise.all([
    db().from("kunden").select("id, name, firma, strasse, plz, ort, notiz").limit(GROSS),
    db().from("fahrzeuge").select("id, kunde_id, kennzeichen, kennzeichen_norm, km_stand, marke_modell").limit(GROSS),
    db().from("alt_rechnungen").select("datei").limit(GROSS),
  ]);
  const kartei = (kd ?? []) as Kartei[];
  const autos = new Map(((fd ?? []) as Auto[]).map((f) => [f.kennzeichen_norm, f]));
  const schonDa = new Set(((rd ?? []) as { datei: string }[]).map((r) => r.datei));

  for (const k of plan.kunden) {
    const kundeId = await kundeFinden(k, kartei, autos, bericht, probelauf);

    for (const f of k.fahrzeuge) {
      const vorhanden = autos.get(kzNorm(f.kennzeichen));
      const typ = markeModellTrennen(f.marke_modell);
      if (!vorhanden) {
        bericht.fahrzeuge.neu++;
        const zeile = { kunde_id: kundeId, kennzeichen: f.kennzeichen, marke_modell: f.marke_modell, ...typ, ...(f.km_stand ? { km_stand: f.km_stand } : {}) };
        const neu = probelauf
          ? { id: `probe-${f.kennzeichen}`, kennzeichen_norm: kzNorm(f.kennzeichen) }
          : (await db().from("fahrzeuge").insert(zeile).select("id, kennzeichen_norm").single()).data!;
        autos.set(neu.kennzeichen_norm, { ...neu, kunde_id: kundeId, kennzeichen: f.kennzeichen, km_stand: f.km_stand, marke_modell: f.marke_modell });
        continue;
      }
      if (vorhanden.kunde_id && vorhanden.kunde_id !== kundeId) {
        bericht.hinweise.push(`${f.kennzeichen} gehört in der Kartei schon einem anderen Kunden und bleibt dort.`);
        continue;
      }
      const ergaenzen = {
        ...(!vorhanden.kunde_id ? { kunde_id: kundeId } : {}),
        ...(f.km_stand && (vorhanden.km_stand ?? 0) < f.km_stand ? { km_stand: f.km_stand } : {}),
        ...(f.marke_modell && !vorhanden.marke_modell ? { marke_modell: f.marke_modell, ...typ } : {}),
      };
      if (!Object.keys(ergaenzen).length) continue;
      bericht.fahrzeuge.ergaenzt++;
      if (!probelauf) await db().from("fahrzeuge").update(ergaenzen).eq("id", vorhanden.id);
      Object.assign(vorhanden, ergaenzen);
    }

    const neue = k.rechnungen.filter((r) => !schonDa.has(r.datei));
    bericht.rechnungen.vorhanden += k.rechnungen.length - neue.length;
    bericht.rechnungen.neu += neue.length;
    bericht.positionen += neue.reduce((s, r) => s + r.positionen.length, 0);
    for (const r of neue) schonDa.add(r.datei);
    if (probelauf || !neue.length) continue;
    await db()
      .from("alt_rechnungen")
      .insert(
        neue.map((r) => {
          const auto = r.kennzeichen ? autos.get(kzNorm(r.kennzeichen)) : undefined;
          return {
            kunde_id: kundeId,
            fahrzeug_id: auto && auto.kunde_id === kundeId ? auto.id : null,
            nummer: r.nummer,
            korrektur: r.korrektur,
            rechnungsdatum: r.rechnungsdatum,
            leistungsdatum: r.leistungsdatum,
            empfaenger: { name: r.name, strasse: r.strasse, plz: r.plz, ort: r.ort, land: r.land },
            kennzeichen: r.kennzeichen,
            km_stand: r.km_stand,
            steuer: r.steuer,
            netto_cent: r.netto_cent,
            mwst_cent: r.mwst_cent,
            brutto_cent: r.brutto_cent,
            endbetrag_cent: r.endbetrag_cent,
            regulaer_cent: r.regulaer_cent,
            zahlart: r.zahlart,
            positionen: r.positionen,
            datei: r.datei,
          };
        }),
      );
  }

  const etwas = bericht.kunden.neu + bericht.fahrzeuge.neu + bericht.fahrzeuge.ergaenzt + bericht.rechnungen.neu;
  if (!probelauf && etwas) {
    await melden("daten.importiert", { dateien: plan.dateien, ...zaehlen(plan), kunden_neu: bericht.kunden.neu, fahrzeuge_neu: bericht.fahrzeuge.neu, rechnungen_neu: bericht.rechnungen.neu });
  }
  return bericht;
}

/**
 * Den Kunden in der Kartei suchen (wie `kundeAusBeleg`): gleicher Name, der zur Anschrift passt, oder dem
 * eins seiner Kennzeichen gehört; ein eindeutiger Name reicht, wenn eine Seite keine Anschrift hat.
 * Gefunden: leere Felder ergänzen. Sonst anlegen.
 */
async function kundeFinden(k: AltKunde, kartei: Kartei[], autos: Map<string, Auto>, bericht: Bericht, probelauf: boolean): Promise<string> {
  const namen = [k.name, k.firma].filter(Boolean);
  const gleicheNamen = kartei.filter((x) => namen.some((n) => gleich(x.name, n) || (x.firma && gleich(x.firma, n))));
  const halter = new Set(k.fahrzeuge.map((f) => autos.get(kzNorm(f.kennzeichen))?.kunde_id).filter(Boolean));
  const passend = gleicheNamen.filter((x) => halter.has(x.id) || (k.strasse && gleich(x.strasse, k.strasse)) || (k.plz && x.plz === k.plz && (!k.strasse || !x.strasse)));
  const ohneAdresse = (x: Kartei) => !x.strasse.trim() && !x.plz.trim();
  const treffer =
    passend.length === 1 ? passend[0] : gleicheNamen.length === 1 && (ohneAdresse(gleicheNamen[0]) || (!k.strasse && !k.plz)) ? gleicheNamen[0] : null;

  if (treffer) {
    bericht.kunden.vorhanden++;
    const ergaenzen: Partial<Kartei> = {};
    for (const feld of ["firma", "strasse", "plz", "ort"] as const) if (!treffer[feld]?.trim() && k[feld]) ergaenzen[feld] = k[feld];
    if (k.notiz && !treffer.notiz.includes(k.notiz)) ergaenzen.notiz = [treffer.notiz.trim(), k.notiz].filter(Boolean).join("\n");
    if (Object.keys(ergaenzen).length && !probelauf) await db().from("kunden").update(ergaenzen).eq("id", treffer.id);
    Object.assign(treffer, ergaenzen);
    return treffer.id;
  }

  bericht.kunden.neu++;
  const zeile = { name: k.name, firma: k.firma, strasse: k.strasse, plz: k.plz, ort: k.ort, notiz: k.notiz };
  const id = probelauf ? `probe-${k.schluessel}` : (await db().from("kunden").insert(zeile).select("id").single()).data!.id as string;
  // Damit ein zweiter Eintrag desselben Kunden in derselben Datei ihn wiederfindet
  kartei.push({ id, ...zeile });
  return id;
}
