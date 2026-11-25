"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { benutzerMitRecht } from "../auth";
import { einstellungen } from "../einstellungen";
import { datumZeit } from "../format";
import { adresseZerlegen, antwortBetreff, istAdresse, weiterleitenBetreff } from "../mail/adressen";
import { esc, htmlBereinigen, zitatHtml } from "../mail/inhalt";
import { belegAnhang, type BelegKurz, belegeZuAdressen, type Kontakt, kontakteSuchen } from "../mail/kunde";
import {
  absenderListe,
  type Aktion,
  type Anhang,
  type Ansicht,
  anhaengeKopieren,
  entwurfSpeichern,
  erneutSenden,
  firmenAdressen,
  mailLaden,
  ordnen,
  sendenAbbrechen,
  sendenPlanen,
  versenden,
  zugang,
} from "../mail/postfach";
import { signaturFuer } from "../mail/signatur";
import { db } from "../supabase/admin";

/**
 * Aktionen des Postfachs. Verwaltung, Werkstatt-App und Team-App teilen sie. Sie werden aus dem Browser direkt
 * aufgerufen (Schreibfenster, Mehrfachauswahl, Wischen) und geben ein schlichtes Ergebnis zurück; was jemand darf,
 * prüft `postfach.ts` über `zugang()`.
 */

type Antwort<T = undefined> = { ok: true; daten: T } | { ok: false; meldung: string };

function neuLaden() {
  revalidatePath("/admin", "layout");
  revalidatePath("/app", "layout");
  revalidatePath("/team", "layout");
}

/** Wie `sicher()`, aber für Aufrufe ohne Formular: Fehler als Meldung statt als Ausnahme. */
async function versuch<T>(fn: () => Promise<T>): Promise<Antwort<T>> {
  try {
    return { ok: true, daten: await fn() };
  } catch (fehler) {
    const { fehlerMelden, istSystemfehler } = await import("../fehler");
    if (istSystemfehler(fehler)) await fehlerMelden(fehler, "Postfach");
    return { ok: false, meldung: fehler instanceof Error ? fehler.message : "Das hat nicht geklappt." };
  }
}

async function ich() {
  const b = await benutzerMitRecht("werkstatt");
  return { b, z: await zugang(b) };
}

// ---------------------------------------------------------------------------
// Ordnen
// ---------------------------------------------------------------------------

export async function mailOrdnen(ziel: { gespraeche?: string[]; mails?: string[] }, aktion: Aktion, ordner: Ansicht): Promise<Antwort<number>> {
  return versuch(async () => {
    const { z } = await ich();
    const n = await ordnen(z, ziel, aktion, ordner);
    neuLaden();
    return n;
  });
}

/** Öffnen heißt gelesen. */
export async function alsGelesen(gespraech: string | null, mailId: string | null): Promise<void> {
  const { z } = await ich();
  await ordnen(z, gespraech ? { gespraeche: [gespraech] } : { mails: mailId ? [mailId] : [] }, { art: "gelesen" }, "eingang");
  neuLaden();
}

// ---------------------------------------------------------------------------
// Schreiben
// ---------------------------------------------------------------------------

export type EntwurfDaten = {
  id: string | null;
  von: string;
  absender: { adresse: string; name: string; firma: boolean }[];
  an: string[];
  cc: string[];
  bcc: string[];
  betreff: string;
  html: string;
  anhaenge: Anhang[];
  bezug: string | null;
  art: "neu" | "antwort" | "weiter" | "entwurf";
  vorlagen: { id: string; name: string; html: string }[];
  versand: { fehler: string | null } | null;
};

/**
 * Daten für das Schreibfenster: neue Mail (mit Signatur), Antwort (Empfänger, „AW:“, Signatur über dem Zitat),
 * Weiterleitung (mit kopierten Anhängen) oder ein gespeicherter Entwurf.
 */
export async function entwurfVorbereiten(art: EntwurfDaten["art"], mailId: string | null, wunsch: { postfach?: "firma" | "ich"; an?: string; betreff?: string } = {}): Promise<Antwort<EntwurfDaten>> {
  return versuch(async () => {
    const { b, z } = await ich();
    const [liste, { mail }, firma] = await Promise.all([absenderListe(z), einstellungen(), firmenAdressen()]);
    if (!liste.length) throw new Error("Für Sie gibt es noch keine Absenderadresse. Bitte in Einstellungen → E-Mail einen Namen eintragen lassen.");
    const absender = liste.map((a) => ({ adresse: a.adresse, name: a.name, firma: a.postfach === null }));
    const eigene = liste.find((a) => a.postfach === z.id)?.adresse;
    const basis = { absender, vorlagen: mail.vorlagen, bcc: [] as string[], versand: null };

    if (art === "entwurf") {
      const m = mailId ? await mailLaden(z, mailId) : null;
      if (!m || (m.ordner !== "entwuerfe" && m.ordner !== "ausgang")) throw new Error("Diesen Entwurf gibt es nicht mehr.");
      // Ein geplanter oder fehlgeschlagener Versand wird zum Bearbeiten wieder Entwurf
      if (m.ordner === "ausgang") await sendenAbbrechen(z, m.id).then((ok) => (ok ? null : db().from("mails").update({ ordner: "entwuerfe", versand: null }).eq("id", m.id).eq("versand", "fehler")));
      return { ...basis, id: m.id, von: m.von, an: m.an, cc: m.cc, bcc: m.bcc, betreff: m.betreff, html: m.html ?? "", anhaenge: m.anhaenge, bezug: m.antwort_auf, art, versand: m.versand_fehler ? { fehler: m.versand_fehler } : null };
    }

    const bezug = mailId ? await mailLaden(z, mailId) : null;
    if (mailId && !bezug) throw new Error("Diese Mail gibt es nicht mehr.");
    // Absender: Antwort aus dem Postfach der Mail (Firmenpostfach von der Adresse, an die geschrieben wurde)
    let von = wunsch.postfach === "ich" && eigene ? eigene : (liste.find((a) => a.postfach === null)?.adresse ?? eigene!);
    if (bezug) {
      if (bezug.postfach === null && z.firma) von = bezug.ziel_adresse && firma.includes(bezug.ziel_adresse) ? bezug.ziel_adresse : liste.find((a) => a.postfach === null)!.adresse;
      else if (bezug.postfach === z.id && eigene) von = eigene;
      else if (eigene) von = eigene; // zugewiesen, ohne Zugriff aufs Firmenpostfach: von der eigenen Adresse
    }
    const signatur = await signaturFuer(b.id, von);
    const leer = "<p><br></p><p><br></p>";

    if (!bezug) {
      const an = wunsch.an && istAdresse(adresseZerlegen(wunsch.an).adresse) ? [adresseZerlegen(wunsch.an).adresse] : [];
      return { ...basis, id: null, von, an, cc: [], betreff: wunsch.betreff?.slice(0, 300) ?? "", html: `${leer}${signatur}`, anhaenge: [], bezug: null, art };
    }

    const zitiert = zitatHtml(
      {
        von: bezug.von,
        vonName: bezug.von_name,
        an: bezug.an,
        cc: bezug.cc,
        wann: datumZeit(bezug.erstellt_am),
        betreff: bezug.betreff,
        html: bezug.html ? htmlBereinigen(bezug.html) : esc(bezug.text).replace(/\n/g, "<br>"),
      },
      art === "weiter",
    );
    if (art === "weiter") {
      return { ...basis, id: null, von, an: [], cc: [], betreff: weiterleitenBetreff(bezug.betreff), html: `${leer}${signatur}${zitiert}`, anhaenge: await anhaengeKopieren(z, bezug.id), bezug: bezug.id, art };
    }
    const an = bezug.richtung === "eingang" ? [bezug.antwort_an || bezug.von] : bezug.an;
    return { ...basis, id: null, von, an, cc: bezug.richtung === "ausgang" ? bezug.cc : [], betreff: antwortBetreff(bezug.betreff), html: `${leer}${signatur}${zitiert}`, anhaenge: [], bezug: bezug.id, art };
  });
}

export type EntwurfEingabe = { id: string | null; von: string; an: string[]; cc: string[]; bcc: string[]; betreff: string; html: string; anhaenge: Anhang[]; bezug: string | null };

function pruefen(e: EntwurfEingabe, streng: boolean) {
  const alle = [...e.an, ...e.cc, ...e.bcc].map((a) => adresseZerlegen(a).adresse);
  const falsch = alle.find((a) => !istAdresse(a));
  if (falsch) throw new Error(`„${falsch}“ ist keine gültige E-Mail-Adresse.`);
  if (streng && !alle.length) throw new Error("Bitte mindestens einen Empfänger eintragen.");
  if (alle.length > 50) throw new Error("Höchstens 50 Empfänger.");
  const groesse = e.anhaenge.reduce((s, a) => s + (Number(a.groesse) || 0), 0);
  if (groesse > 35 * 1024 * 1024) throw new Error("Die Anhänge sind zusammen zu groß (höchstens 35 MB).");
  return {
    ...e,
    an: e.an.map((a) => adresseZerlegen(a).adresse),
    cc: e.cc.map((a) => adresseZerlegen(a).adresse),
    bcc: e.bcc.map((a) => adresseZerlegen(a).adresse),
    anhaenge: e.anhaenge.map((a) => ({ pfad: String(a.pfad), name: String(a.name).slice(0, 200), typ: String(a.typ || "application/octet-stream"), groesse: Number(a.groesse) || 0 })),
  };
}

/** Automatisch speichern (alle paar Sekunden beim Schreiben). */
export async function entwurfSichern(e: EntwurfEingabe): Promise<Antwort<string>> {
  return versuch(async () => {
    const { z } = await ich();
    // Beim Zwischenspeichern dürfen Empfänger noch halb fertig sein
    const sauber = { ...e, an: e.an.filter((a) => istAdresse(adresseZerlegen(a).adresse)), cc: e.cc.filter((a) => istAdresse(adresseZerlegen(a).adresse)), bcc: e.bcc.filter((a) => istAdresse(adresseZerlegen(a).adresse)) };
    const id = await entwurfSpeichern(z, pruefen(sauber, false));
    neuLaden();
    return id;
  });
}

/** Senden: speichern und planen (sofort mit 10 Sekunden „Rückgängig“ oder zum gewählten Zeitpunkt). */
export async function entwurfSenden(e: EntwurfEingabe, spaeter: string | null): Promise<Antwort<{ id: string; senden_am: string }>> {
  return versuch(async () => {
    const { z } = await ich();
    const id = await entwurfSpeichern(z, pruefen(e, true));
    const zeit = spaeter ? new Date(spaeter) : null;
    if (zeit && Number.isNaN(zeit.getTime())) throw new Error("Der Zeitpunkt ist ungültig.");
    const { senden_am } = await sendenPlanen(z, id, zeit);
    neuLaden();
    return { id, senden_am };
  });
}

/** „Rückgängig“: zurück in die Entwürfe, solange die Mail noch nicht abgeholt ist. */
export async function sendenRueckgaengig(id: string): Promise<Antwort<boolean>> {
  return versuch(async () => {
    const { z } = await ich();
    const ok = await sendenAbbrechen(z, id);
    neuLaden();
    return ok;
  });
}

/** Nach Ablauf der Rückgängig-Frist aus dem Browser; sonst holt der Minutentakt sie ab. */
export async function jetztVersenden(id: string): Promise<Antwort<string>> {
  return versuch(async () => {
    const { z } = await ich();
    const m = await mailLaden(z, id);
    if (!m) throw new Error("Diese Mail gibt es nicht mehr.");
    const r = await versenden(id);
    neuLaden();
    if (r === "fehler") {
      const { data } = await db().from("mails").select("versand_fehler").eq("id", id).single();
      throw new Error(`Nicht gesendet: ${data?.versand_fehler ?? "unbekannter Fehler"}. Die Mail liegt im Postausgang.`);
    }
    return r;
  });
}

export async function erneutVersuchen(id: string): Promise<Antwort<undefined>> {
  return versuch(async () => {
    const { z } = await ich();
    await erneutSenden(z, id);
    neuLaden();
    return undefined;
  });
}

/** Entwurf verwerfen: endgültig weg, mit seinen hochgeladenen Anhängen. */
export async function entwurfVerwerfen(id: string): Promise<Antwort<undefined>> {
  return versuch(async () => {
    const { z } = await ich();
    const m = await mailLaden(z, id);
    if (!m || m.ordner !== "entwuerfe") return undefined;
    await ordnen(z, { mails: [id] }, { art: "loeschen" }, "papierkorb");
    neuLaden();
    return undefined;
  });
}

// ---------------------------------------------------------------------------
// Anhänge, Belege, Empfänger
// ---------------------------------------------------------------------------

const MAX_DATEI = 25 * 1024 * 1024;

/**
 * Signierte Upload-Adresse für einen Anhang: Dateien gehen direkt vom Browser in den Speicher, nicht durch
 * die Server-Funktion (Vercel begrenzt deren Anfragen auf 4,5 MB).
 */
export async function anhangVorbereiten(name: string, groesse: number): Promise<{ ok: true; pfad: string; url: string } | { ok: false; meldung: string }> {
  await benutzerMitRecht("werkstatt");
  if (groesse > MAX_DATEI) return { ok: false, meldung: "Die Datei ist zu groß (höchstens 25 MB)." };
  const { sauber } = await import("../mail/postfach");
  const pfad = `ausgang/${randomUUID()}/${sauber(name)}`;
  const { data, error } = await db().storage.from("mail").createSignedUploadUrl(pfad);
  if (error || !data) return { ok: false, meldung: "Upload konnte nicht vorbereitet werden." };
  return { ok: true, pfad, url: data.signedUrl };
}

export async function belegeSuchen(adressen: string[]): Promise<Antwort<{ kunde: string; belege: BelegKurz[] }[]>> {
  return versuch(async () => {
    const { z } = await ich();
    return belegeZuAdressen(z, adressen.map((a) => adresseZerlegen(a).adresse).filter(istAdresse));
  });
}

export async function belegAnhaengen(art: BelegKurz["art"], id: string): Promise<Antwort<Anhang>> {
  return versuch(async () => {
    const { z } = await ich();
    return belegAnhang(z, art, id);
  });
}

export async function kontakteVorschlagen(eingabe: string): Promise<Kontakt[]> {
  const { z } = await ich();
  return kontakteSuchen(z, eingabe.slice(0, 80));
}

/** Push für eigene Mails an- oder ausschalten (Handy-Apps unter „Mehr“). */
export async function mailPushSchalten(an: boolean): Promise<Antwort<undefined>> {
  return versuch(async () => {
    const { b } = await ich();
    await db().from("profile").update({ mail_push: an }).eq("id", b.id);
    return undefined;
  });
}
