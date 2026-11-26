"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { annahmeAus, FREIGABE_WEGE, grenzeText } from "../auftrag-regeln";
import { annahmeSpeichern, auftragAnlegen, auftragErteilen, auftragSpeichern, auftragVersenden, erteilungZuruecknehmen, mehrkostenFreigeben } from "../auftrag";
import { benutzerMitRecht } from "../auth";
import { type Ergebnis, istEmail, text, zahl } from "../forms";
import { sicher } from "../sicher";
import { positionenAus } from "../rechnung/eingabe";
import { kvAusTermin, kvMitTerminVerknuepfen, kvTerminLoesen } from "../rechnung/kostenvoranschlaege";
import type { Ort } from "./belege";

/** Werkstattauftrag am Termin. Verwaltung und Handy-App teilen sich diese Aktionen. */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Unterschrift aus dem Zeichenfeld: PNG als data:-URL, höchstens so groß wie die Spalte erlaubt. */
const PNG = /^data:image\/png;base64,[A-Za-z0-9+/]+=*$/;

function neuLaden(id: string) {
  revalidatePath("/admin", "layout");
  revalidatePath("/app", "layout");
  revalidatePath("/team", "layout");
  revalidatePath(`/admin/termine/${id}`);
}

export async function auftragAnlegenAktion(id: string, _v: Ergebnis, fd: FormData): Promise<Ergebnis> {
  return sicher(fd, async () => {
    const b = await benutzerMitRecht("termine");
    const nummer = await auftragAnlegen(id, b.id);
    neuLaden(id);
    return { status: "ok", meldung: `Werkstattauftrag ${nummer} angelegt.` };
  });
}

/**
 * Speichern aus dem Beleg-Editor (Positionen, Kostengrenze). Mit weiter=zurueck geht es danach zum Termin;
 * `ort` sagt, ob Verwaltung oder Handy-App.
 */
export async function auftragEntwurfSpeichernAktion(id: string, _v: Ergebnis, fd: FormData): Promise<Ergebnis> {
  let ziel = "";
  const ergebnis = await sicher(null, async () => {
    const b = await benutzerMitRecht("termine");
    const roh = JSON.parse(String(fd.get("daten") ?? "{}")) as Record<string, unknown>;
    const grenze = roh.kostengrenze_cent == null || roh.kostengrenze_cent === "" ? null : Math.round(Number(roh.kostengrenze_cent));
    if (grenze !== null && (!Number.isFinite(grenze) || grenze < 0)) return { status: "fehler", meldung: "Bitte die Kostengrenze prüfen." };
    const t = await auftragSpeichern(id, { positionen: positionenAus(roh.positionen), kostengrenze_cent: grenze }, b.id);
    neuLaden(id);
    if (fd.get("weiter") === "zurueck") ziel = `/${fd.get("ort") === "app" ? "app" : "admin"}/termine/${id}`;
    const warnung = grenzeText(t);
    return { status: warnung ? "fehler" : "ok", meldung: warnung ? `Gespeichert. ${warnung}` : "Auftrag gespeichert." };
  });
  if (ziel) redirect(ziel);
  return ergebnis;
}

export async function annahmeAktion(id: string, _v: Ergebnis, fd: FormData): Promise<Ergebnis> {
  return sicher(fd, async () => {
    const b = await benutzerMitRecht("termine");
    const km = zahl(fd, "km_stand");
    if (km !== null && (km < 0 || km > 5_000_000)) return { status: "fehler", meldung: "Bitte den Kilometerstand prüfen." };
    await annahmeSpeichern(
      id,
      {
        annahme: annahmeAus({ tank: fd.get("tank"), schluessel: fd.get("schluessel"), vorschaeden: fd.get("vorschaeden") }),
        km: km === null ? null : Math.round(km),
        beschreibung: text(fd, "beschreibung", 1500),
        fin: text(fd, "fin", 17).toUpperCase(),
        hsn: text(fd, "hsn", 4),
        tsn: text(fd, "tsn", 10).toUpperCase(),
        erstzulassung: text(fd, "erstzulassung", 10),
      },
      b.id,
    );
    neuLaden(id);
    return { status: "ok", meldung: "Annahme gespeichert." };
  });
}

/** Unterschrift des Kunden auf dem Gerät (Verwaltung am Tablet oder Handy-App). */
export async function unterschriftAktion(id: string, _v: Ergebnis, fd: FormData): Promise<Ergebnis> {
  return sicher(null, async () => {
    const b = await benutzerMitRecht("termine");
    const bild = text(fd, "bild", 400_000);
    const name = text(fd, "name", 120);
    if (!PNG.test(bild)) return { status: "fehler", meldung: "Bitte im Feld unterschreiben lassen." };
    if (!name) return { status: "fehler", meldung: "Bitte den Namen des Unterzeichners eintragen." };
    await auftragErteilen(id, "unterschrift", { name, bild, vonBenutzer: b.id });
    neuLaden(id);
    return { status: "ok", meldung: "Auftrag erteilt. Der Kunde bekommt eine Kopie per E-Mail, wenn eine Adresse bekannt ist." };
  });
}

export async function auftragVersendenAktion(id: string, _v: Ergebnis, fd: FormData): Promise<Ergebnis> {
  return sicher(fd, async () => {
    const b = await benutzerMitRecht("termine");
    const an = text(fd, "an", 160).toLowerCase();
    if (!istEmail(an)) return { status: "fehler", meldung: "Bitte eine gültige E-Mail-Adresse angeben." };
    await auftragVersenden(id, an, b.id);
    neuLaden(id);
    return { status: "ok", meldung: `An ${an} gesendet. Der Kunde kann den Auftrag über seinen Link erteilen.` };
  });
}

export async function erteilungZuruecknehmenAktion(id: string, _v: Ergebnis, fd: FormData): Promise<Ergebnis> {
  return sicher(fd, async () => {
    const b = await benutzerMitRecht("termine");
    await erteilungZuruecknehmen(id, b.id);
    neuLaden(id);
    return { status: "ok", meldung: "Erteilung zurückgenommen." };
  });
}

/** Zustimmung des Kunden zu Mehrkosten über der Kostengrenze festhalten (Weg aus FREIGABE_WEGE). */
export async function mehrkostenFreigebenAktion(id: string, _v: Ergebnis, fd: FormData): Promise<Ergebnis> {
  return sicher(fd, async () => {
    const b = await benutzerMitRecht("termine");
    const wie = text(fd, "wie", 60);
    if (!(FREIGABE_WEGE as readonly string[]).includes(wie)) return { status: "fehler", meldung: "Bitte wählen, wie der Kunde zugestimmt hat." };
    await mehrkostenFreigeben(id, wie, b.id);
    neuLaden(id);
    return { status: "ok", meldung: "Zustimmung eingetragen." };
  });
}

// ---------------------------------------------------------------------------
// Kostenvoranschlag und Termin
// ---------------------------------------------------------------------------

/** Neuer Kostenvoranschlag aus dem Termin, danach direkt in den Editor. */
export async function kvAusTerminAktion(id: string, ort: Ort): Promise<void> {
  const b = await benutzerMitRecht("rechnungen");
  const kv = await kvAusTermin(id, b.id);
  neuLaden(id);
  redirect(`/${ort}/kostenvoranschlaege/${kv}`);
}

/** Am Termin: vorhandenen Kostenvoranschlag des Kunden verknüpfen. */
export async function kvAmTerminVerknuepfen(id: string, _v: Ergebnis, fd: FormData): Promise<Ergebnis> {
  return sicher(fd, async () => {
    const b = await benutzerMitRecht("rechnungen");
    const kv = String(fd.get("kv") ?? "");
    if (!UUID.test(kv)) return { status: "fehler", meldung: "Bitte einen Kostenvoranschlag wählen." };
    await kvMitTerminVerknuepfen(kv, id, b.id);
    neuLaden(id);
    revalidatePath("/admin/kostenvoranschlaege", "layout");
    return { status: "ok", meldung: "Verknüpft." };
  });
}

/** Am Kostenvoranschlag: mit einem Termin des Kunden verknüpfen (z. B. die Anfrage, für die er geschrieben wurde). */
export async function terminAmKvVerknuepfen(kvId: string, _v: Ergebnis, fd: FormData): Promise<Ergebnis> {
  return sicher(fd, async () => {
    const b = await benutzerMitRecht("rechnungen");
    const termin = String(fd.get("termin") ?? "");
    if (!UUID.test(termin)) return { status: "fehler", meldung: "Bitte einen Termin wählen." };
    await kvMitTerminVerknuepfen(kvId, termin, b.id);
    neuLaden(termin);
    revalidatePath("/admin/kostenvoranschlaege", "layout");
    return { status: "ok", meldung: "Mit dem Termin verknüpft." };
  });
}

export async function kvTerminLoesenAktion(kvId: string, terminId: string): Promise<void> {
  const b = await benutzerMitRecht("rechnungen");
  await kvTerminLoesen(kvId, b.id);
  neuLaden(terminId);
  revalidatePath("/admin/kostenvoranschlaege", "layout");
}

