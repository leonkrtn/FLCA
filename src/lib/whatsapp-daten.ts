import "server-only";
import { auftragLink } from "./auftrag";
import { einstellungen } from "./einstellungen";
import { ENV } from "./env";
import { datum, datumLangText, euro, whatsappHref, zeit } from "./format";
import { offenerBetrag } from "./rechnung/korrektur";
import { type Kostenvoranschlag, kvLink } from "./rechnung/kostenvoranschlaege";
import { type Rechnung, rechnungLink } from "./rechnung/rechnungen";
import { db } from "./supabase/admin";
import { type Termin, terminLink } from "./termine";
import { fahrzeugText, kvVorlage, rechnungVorlage, terminVorlage, WHATSAPP_STANDARD, WHATSAPP_VORLAGEN, type WhatsappVorlage, whatsappText } from "./whatsapp";

/** Fertiger Link für den Knopf: öffnet WhatsApp mit der zum Stand passenden Nachricht. */
export type WhatsappLink = { href: string; vorlage: WhatsappVorlage; titel: string };

async function bauen(telefon: string | null | undefined, vorlage: WhatsappVorlage | null, werte: Record<string, string | undefined>): Promise<WhatsappLink | null> {
  if (!telefon?.trim() || !vorlage) return null;
  const { firma, whatsapp } = await einstellungen();
  // Ein in den Einstellungen geleertes Feld heißt „Standardtext“, nicht „leere Nachricht“.
  const text = whatsapp[vorlage]?.trim() ? whatsapp[vorlage] : WHATSAPP_STANDARD[vorlage];
  const alle = {
    firma: firma.name,
    adresse: `${firma.strasse}, ${firma.plz} ${firma.ort}`,
    telefon: firma.telefon,
    bewertung: firma.googleBewertungLink,
    buchen: `${ENV.siteUrl}/termin`,
    ...werte,
  };
  return {
    href: whatsappHref(telefon, whatsappText(text, alle)),
    vorlage,
    titel: WHATSAPP_VORLAGEN.find((v) => v.schluessel === vorlage)?.titel ?? vorlage,
  };
}

export async function terminWhatsapp(t: Termin): Promise<WhatsappLink | null> {
  const vorlage = terminVorlage(t);
  return bauen(t.kunde?.telefon, vorlage, {
    name: t.kunde?.name,
    fahrzeug: fahrzeugText(t.fahrzeug),
    leistung: t.leistung_name,
    datum: t.beginn ? datumLangText(t.beginn) : undefined,
    uhrzeit: t.beginn ? zeit(t.beginn) : undefined,
    link: vorlage === "freigabe" ? auftragLink(t) : terminLink(t),
    betrag: t.auftrag_summe_brutto_cent != null ? euro(t.auftrag_summe_brutto_cent) : undefined,
    grenze: t.auftrag_kostengrenze_cent != null ? euro(t.auftrag_kostengrenze_cent) : undefined,
  });
}

/** Belege tragen keine Telefonnummer, die steht nur in der Kartei. */
async function telefonVon(kundeId: string | null): Promise<string | null> {
  if (!kundeId) return null;
  const { data } = await db().from("kunden").select("telefon").eq("id", kundeId).maybeSingle();
  return (data?.telefon as string | undefined) ?? null;
}

const belegFahrzeug = (f: Rechnung["fahrzeug"] | null | undefined) => fahrzeugText({ kennzeichen: f?.kennzeichen, marke_modell: [f?.marke, f?.modell].filter(Boolean).join(" ") });

export async function kvWhatsapp(k: Kostenvoranschlag): Promise<WhatsappLink | null> {
  const vorlage = kvVorlage(k);
  if (!vorlage) return null;
  return bauen(await telefonVon(k.kunde_id), vorlage, {
    name: k.empfaenger?.name,
    fahrzeug: belegFahrzeug(k.fahrzeug),
    nummer: k.nummer ?? undefined,
    betrag: euro(k.summe_brutto_cent),
    link: kvLink(k),
  });
}

export async function rechnungWhatsapp(r: Rechnung): Promise<WhatsappLink | null> {
  const vorlage = rechnungVorlage(r);
  if (!vorlage) return null;
  return bauen(await telefonVon(r.kunde_id), vorlage, {
    name: r.empfaenger?.name,
    fahrzeug: belegFahrzeug(r.fahrzeug),
    nummer: r.nummer ?? undefined,
    betrag: euro(offenerBetrag(r)),
    bis: r.faellig_am ? datum(r.faellig_am) : undefined,
    link: rechnungLink(r),
  });
}
