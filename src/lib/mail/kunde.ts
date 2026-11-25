import "server-only";
import { auftragDateiname, auftragLaden, auftragPdf } from "../auftrag";
import { offenerBetrag } from "../rechnung/korrektur";
import { kvDateiname, kvLaden, kvPdf } from "../rechnung/kostenvoranschlaege";
import { dateiname, pdfErzeugen, rechnungLaden } from "../rechnung/rechnungen";
import { darf } from "../rollen";
import { db } from "../supabase/admin";
import { type Anhang, anhangAblegen, darfMail, type MailZeile, personenAdresse, type Zugang } from "./postfach";

/**
 * Postfach und Kundenkartei: Kunde neben der Mail, Vorschläge für Empfänger, Belege als Anhang und die Mails in
 * der Kundenakte. Gefunden wird der Kunde über seine E-Mail-Adresse.
 */

/** E-Mail für `ilike` ohne Platzhalter: `_` und `%` kommen in Adressen vor und sollen nichts anderes treffen. */
const genau = (adresse: string) => adresse.trim().toLowerCase().replace(/[\\%_]/g, (z) => `\\${z}`);

export type BelegKurz = { art: "rechnung" | "kv" | "auftrag"; id: string; text: string };

export type KundeKurz = {
  id: string;
  nummer: number;
  name: string;
  firma: string;
  telefon: string;
  fahrzeuge: { kennzeichen: string; marke_modell: string }[];
  naechsterTermin: { id: string; beginn: string; leistung: string; status: string } | null;
  offen: { id: string; nummer: string; offen_cent: number }[];
  belege: BelegKurz[];
};

/** Kunde zu einer Adresse, mit dem, was man beim Antworten braucht. Nur mit Recht „kunden“. */
export async function kundeZuAdresse(z: Zugang, adresse: string): Promise<KundeKurz | null> {
  if (!adresse || !darf(z.rolle, "kunden")) return null;
  const { data: k } = await db().from("kunden").select("id, nummer, name, firma, telefon").ilike("email", genau(adresse)).limit(1).maybeSingle();
  if (!k) return null;
  return kundeKurz(z, k as { id: string; nummer: number; name: string; firma: string; telefon: string });
}

async function kundeKurz(z: Zugang, k: { id: string; nummer: number; name: string; firma: string; telefon: string }): Promise<KundeKurz> {
  const rechnungen = darf(z.rolle, "rechnungen");
  const [{ data: f }, { data: t }, { data: r }, { data: kv }, { data: a }] = await Promise.all([
    db().from("fahrzeuge").select("kennzeichen, marke_modell").eq("kunde_id", k.id).limit(5),
    db().from("termine").select("id, beginn, leistung_name, status").eq("kunde_id", k.id).in("status", ["angefragt", "bestaetigt"]).gte("beginn", new Date().toISOString()).order("beginn").limit(1),
    rechnungen
      ? db().from("rechnungen").select("id, nummer, status, summe_brutto_cent, bereits_bezahlt_cent, rechnungsdatum").eq("kunde_id", k.id).neq("status", "entwurf").order("rechnungsdatum", { ascending: false }).limit(10)
      : Promise.resolve({ data: [] }),
    rechnungen ? db().from("kostenvoranschlaege").select("id, nummer, status").eq("kunde_id", k.id).neq("status", "entwurf").order("datum", { ascending: false }).limit(5) : Promise.resolve({ data: [] }),
    darf(z.rolle, "termine") ? db().from("termine").select("id, auftrag_nummer").eq("kunde_id", k.id).not("auftrag_nummer", "is", null).order("beginn", { ascending: false }).limit(5) : Promise.resolve({ data: [] }),
  ]);
  const naechster = t?.[0];
  return {
    ...k,
    fahrzeuge: (f ?? []) as KundeKurz["fahrzeuge"],
    naechsterTermin: naechster ? { id: naechster.id as string, beginn: naechster.beginn as string, leistung: naechster.leistung_name as string, status: naechster.status as string } : null,
    offen: (r ?? [])
      .filter((x) => x.status === "gestellt" && offenerBetrag(x as { summe_brutto_cent: number; bereits_bezahlt_cent: number | null }) > 0)
      .map((x) => ({ id: x.id as string, nummer: x.nummer as string, offen_cent: offenerBetrag(x as { summe_brutto_cent: number; bereits_bezahlt_cent: number | null }) })),
    belege: [
      ...(r ?? []).map((x) => ({ art: "rechnung" as const, id: x.id as string, text: `Rechnung ${x.nummer}${x.status === "storniert" ? " (storniert)" : ""}` })),
      ...(kv ?? []).map((x) => ({ art: "kv" as const, id: x.id as string, text: `Kostenvoranschlag ${x.nummer}` })),
      ...(a ?? []).map((x) => ({ art: "auftrag" as const, id: x.id as string, text: `Werkstattauftrag ${x.auftrag_nummer}` })),
    ],
  };
}

/** Belege zu den Empfängern einer Mail (für „Beleg anhängen“ im Schreibfenster). */
export async function belegeZuAdressen(z: Zugang, adressen: string[]): Promise<{ kunde: string; belege: BelegKurz[] }[]> {
  const liste: { kunde: string; belege: BelegKurz[] }[] = [];
  for (const a of adressen.slice(0, 5)) {
    const k = await kundeZuAdresse(z, a);
    if (k?.belege.length) liste.push({ kunde: k.name, belege: k.belege });
  }
  return liste;
}

/** PDF eines Belegs erzeugen und als Anhang in den Ausgang legen. */
export async function belegAnhang(z: Zugang, art: BelegKurz["art"], id: string): Promise<Anhang> {
  if (!/^[0-9a-f-]{36}$/.test(id)) throw new Error("Unbekannter Beleg.");
  if (art === "rechnung") {
    if (!darf(z.rolle, "rechnungen")) throw new Error("Dafür fehlt Ihnen die Berechtigung.");
    const r = await rechnungLaden(id);
    if (!r || r.status === "entwurf") throw new Error("Nur gestellte Rechnungen lassen sich anhängen.");
    return anhangAblegen(dateiname(r), await pdfErzeugen(r));
  }
  if (art === "kv") {
    if (!darf(z.rolle, "rechnungen")) throw new Error("Dafür fehlt Ihnen die Berechtigung.");
    const k = await kvLaden(id);
    if (!k) throw new Error("Diesen Kostenvoranschlag gibt es nicht mehr.");
    return anhangAblegen(kvDateiname(k), await kvPdf(k));
  }
  if (!darf(z.rolle, "termine")) throw new Error("Dafür fehlt Ihnen die Berechtigung.");
  const t = await auftragLaden(id);
  if (!t?.auftrag_nummer) throw new Error("Diesen Werkstattauftrag gibt es nicht mehr.");
  return anhangAblegen(auftragDateiname(t), await auftragPdf(t));
}

export type Kontakt = { name: string; adresse: string; art: "kunde" | "team" | "zuletzt" };

/** Vorschläge beim Tippen eines Empfängers: Kundenkartei, Team und bisherige Mailkontakte. */
export async function kontakteSuchen(z: Zugang, eingabe: string): Promise<Kontakt[]> {
  const q = eingabe.replace(/[%,()\\"]/g, " ").trim();
  if (q.length < 2) return [];
  const [kunden, team, zuletzt] = await Promise.all([
    darf(z.rolle, "kunden")
      ? db().from("kunden").select("name, email").neq("email", "").or(`name.ilike.%${q}%,email.ilike.%${q}%,firma.ilike.%${q}%`).limit(6)
      : Promise.resolve({ data: [] }),
    db().from("profile").select("name, mail_name").eq("aktiv", true).ilike("name", `%${q}%`).limit(4),
    db().from("mails").select("postfach, zugewiesen_an, von, von_name").eq("richtung", "eingang").or(`von.ilike.%${q}%,von_name.ilike.%${q}%`).order("erstellt_am", { ascending: false }).limit(30),
  ]);
  const liste: Kontakt[] = [];
  const dazu = (k: Kontakt) => {
    if (k.adresse && !liste.some((x) => x.adresse === k.adresse)) liste.push(k);
  };
  for (const k of kunden.data ?? []) dazu({ name: k.name as string, adresse: (k.email as string).toLowerCase(), art: "kunde" });
  for (const p of team.data ?? []) dazu({ name: p.name as string, adresse: personenAdresse(p as { name: string; mail_name: string | null }), art: "team" });
  for (const m of (zuletzt.data ?? []) as Pick<MailZeile, "postfach" | "zugewiesen_an" | "von" | "von_name">[]) if (darfMail(z, m)) dazu({ name: m.von_name, adresse: m.von, art: "zuletzt" });
  return liste.slice(0, 10);
}

/** Mails mit einem Kunden (für die Kundenakte), nur aus Postfächern, die man sieht. */
export async function mailsZuKunde(z: Zugang, email: string): Promise<Pick<MailZeile, "id" | "gespraech" | "postfach" | "richtung" | "betreff" | "von" | "von_name" | "an" | "erstellt_am" | "ordner">[]> {
  const a = email.trim().toLowerCase().replace(/["\\{},]/g, "");
  if (!a) return [];
  const { data } = await db()
    .from("mails")
    .select("id, gespraech, postfach, zugewiesen_an, richtung, betreff, von, von_name, an, erstellt_am, ordner")
    .or(`von.eq."${a}",an.cs.{"${a}"}`)
    .not("ordner", "in", "(papierkorb,entwuerfe)")
    .order("erstellt_am", { ascending: false })
    .limit(30);
  return ((data ?? []) as (MailZeile & { zugewiesen_an: string | null })[]).filter((m) => darfMail(z, m));
}
