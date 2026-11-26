"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { benutzerMitRecht } from "../auth";
import { einstellungen, einstellungenSpeichern } from "../einstellungen";
import { type Ergebnis, ja, text } from "../forms";
import { MAIL_NAME_MUSTER, mailNameVon } from "../mail/adressen";
import { htmlBereinigen, KATEGORIE_FARBEN } from "../mail/inhalt";
import { mailNamePruefen, standardAbsender } from "../mail/postfach";
import { mailer } from "../services/email";
import { sicher } from "../sicher";
import { db, DbFehler } from "../supabase/admin";

/** Einstellungen → E-Mail. Alles nur für den Inhaber (Recht „einstellungen“). */

const neu = () => revalidatePath("/", "layout");

/** „service, info@flcautomotive.de; termine“ → ["service", "info", "termine"] */
function lokaleTeile(eingabe: string): string[] {
  return [...new Set(eingabe.split(/[\s,;]+/).map((a) => a.trim().toLowerCase().replace(/@.*$/, "")).filter(Boolean))];
}

export async function mailAdressenSpeichern(_v: Ergebnis, fd: FormData): Promise<Ergebnis> {
  return sicher(fd, async () => {
    await benutzerMitRecht("einstellungen");
    const { mail } = await einstellungen();
    const standard = text(fd, "standardAdresse", 64).toLowerCase().replace(/@.*$/, "");
    const firma = lokaleTeile(text(fd, "firmenAdressen", 1000));
    const falsch = [standard, ...firma].filter(Boolean).find((a) => !MAIL_NAME_MUSTER.test(a));
    if (falsch) return { status: "fehler", meldung: `„${falsch}“ geht nicht als Adresse: nur Kleinbuchstaben, Ziffern, Punkt, Binde- und Unterstrich.` };
    if (!firma.length) return { status: "fehler", meldung: "Bitte mindestens eine Adresse für das Firmenpostfach eintragen." };
    // Die Standardadresse gehört immer zum Firmenpostfach, sonst landeten Antworten auf Systemmails in „Sonstige“
    const liste = standard && !firma.includes(standard) ? [standard, ...firma] : firma;
    // Eine Adresse, die schon eine Person hat, würde deren Mails ins Firmenpostfach umleiten
    const { data: leute } = await db().from("profile").select("id, name, mail_name");
    for (const a of liste) {
      const fehler = personBelegt(a, (leute ?? []) as { id: string; name: string; mail_name: string | null }[]);
      if (fehler) return { status: "fehler", meldung: fehler };
    }
    await einstellungenSpeichern("mail", { ...mail, absenderName: text(fd, "absenderName", 120), standardAdresse: standard, firmenAdressen: liste });
    neu();
    return { status: "ok", meldung: "Gespeichert." };
  });
}

function personBelegt(lokal: string, leute: { id: string; name: string; mail_name: string | null }[]): string | null {
  const p = leute.find((x) => mailNameVon(x) === lokal);
  return p ? `${lokal}@ ist die Adresse von ${p.name}. Bitte dort eine andere eintragen oder eine andere Firmenadresse wählen.` : null;
}

export async function mailZugriffSpeichern(_v: Ergebnis, fd: FormData): Promise<Ergebnis> {
  return sicher(fd, async () => {
    await benutzerMitRecht("einstellungen");
    const { mail } = await einstellungen();
    const { data: leute } = await db().from("profile").select("id, rolle").eq("aktiv", true);
    const zugriff = (leute ?? []).filter((p) => p.rolle === "inhaber" || ja(fd, `zugriff_${p.id}`)).map((p) => p.id as string);
    const push = (leute ?? []).filter((p) => ja(fd, `push_${p.id}`)).map((p) => p.id as string);
    await einstellungenSpeichern("mail", { ...mail, zugriff, push });
    neu();
    return { status: "ok", meldung: "Gespeichert." };
  });
}

export async function mailSignaturSpeichern(_v: Ergebnis, fd: FormData): Promise<Ergebnis> {
  return sicher(fd, async () => {
    await benutzerMitRecht("einstellungen");
    const { mail } = await einstellungen();
    await einstellungenSpeichern("mail", {
      ...mail,
      signatur: { gruss: text(fd, "gruss", 120), logo: ja(fd, "logo"), oeffnungszeiten: ja(fd, "oeffnungszeiten"), website: ja(fd, "website"), pflichtangaben: ja(fd, "pflichtangaben") },
    });
    neu();
    return { status: "ok", meldung: "Gespeichert." };
  });
}

/** Adressen, Jobbezeichnung und Telefon aller Personen in einem Rutsch (Tabelle im Reiter E-Mail). */
export async function mailPersonenSpeichern(_v: Ergebnis, fd: FormData): Promise<Ergebnis> {
  return sicher(fd, async () => {
    await benutzerMitRecht("einstellungen");
    const { data: leute } = await db().from("profile").select("id, name");
    for (const p of leute ?? []) {
      if (!fd.has(`job_${p.id}`)) continue;
      const mailName = text(fd, `mail_name_${p.id}`, 64).toLowerCase().replace(/@.*$/, "") || null;
      const fehler = await mailNamePruefen(p.id as string, p.name as string, mailName);
      if (fehler) return { status: "fehler", meldung: `${p.name}: ${fehler}` };
      const { error } = await db()
        .from("profile")
        .update({ mail_name: mailName, jobbezeichnung: text(fd, `job_${p.id}`, 120), signatur_telefon: text(fd, `tel_${p.id}`, 40) })
        .eq("id", p.id);
      if (error) throw new DbFehler(error);
    }
    neu();
    return { status: "ok", meldung: "Gespeichert." };
  });
}

export async function kategorieSpeichern(id: string | null, _v: Ergebnis, fd: FormData): Promise<Ergebnis> {
  return sicher(fd, async () => {
    await benutzerMitRecht("einstellungen");
    const name = text(fd, "name", 60);
    const farbe = text(fd, "farbe", 20);
    if (!name) return { status: "fehler", meldung: "Bitte einen Namen eingeben." };
    const werte = { name, farbe: KATEGORIE_FARBEN[farbe] ? farbe : "grau" };
    if (id) await db().from("mail_kategorien").update(werte).eq("id", id);
    else {
      const { count } = await db().from("mail_kategorien").select("id", { count: "exact", head: true });
      await db().from("mail_kategorien").insert({ ...werte, sortierung: count ?? 0 });
    }
    neu();
    return { status: "ok", meldung: id ? "Gespeichert." : "Angelegt." };
  });
}

export async function kategorieLoeschen(id: string, _v: Ergebnis): Promise<Ergebnis> {
  return sicher(null, async () => {
    await benutzerMitRecht("einstellungen");
    await db().from("mail_kategorien").delete().eq("id", id);
    neu();
    return { status: "ok" };
  });
}

export async function vorlageSpeichern(id: string | null, _v: Ergebnis, fd: FormData): Promise<Ergebnis> {
  return sicher(fd, async () => {
    await benutzerMitRecht("einstellungen");
    const { mail } = await einstellungen();
    const name = text(fd, "name", 80);
    const html = htmlBereinigen(String(fd.get("html") ?? "")).slice(0, 50_000);
    if (!name) return { status: "fehler", meldung: "Bitte einen Namen eingeben." };
    const vorlagen = id ? mail.vorlagen.map((v) => (v.id === id ? { ...v, name, html } : v)) : [...mail.vorlagen, { id: randomUUID(), name, html }];
    await einstellungenSpeichern("mail", { ...mail, vorlagen });
    neu();
    return { status: "ok", meldung: id ? "Gespeichert." : "Angelegt." };
  });
}

export async function vorlageLoeschen(id: string, _v: Ergebnis): Promise<Ergebnis> {
  return sicher(null, async () => {
    await benutzerMitRecht("einstellungen");
    const { mail } = await einstellungen();
    await einstellungenSpeichern("mail", { ...mail, vorlagen: mail.vorlagen.filter((v) => v.id !== id) });
    neu();
    return { status: "ok" };
  });
}

/** Schickt eine Mail an die Standardadresse: Kommt sie im Firmenpostfach an, laufen Senden und Empfangen. */
export async function mailTesten(_v: Ergebnis): Promise<Ergebnis> {
  return sicher(null, async () => {
    await benutzerMitRecht("einstellungen");
    const von = await standardAbsender();
    const zeit = new Date().toLocaleString("de-DE", { timeZone: "Europe/Berlin" });
    const r = await mailer().senden({
      an: von.adresse,
      betreff: `Testmail ${zeit}`,
      text: "Diese Mail prüft Senden und Empfangen. Steht sie im Posteingang des Firmenpostfachs, ist alles eingerichtet.",
      html: "<p>Diese Mail prüft Senden und Empfangen. Steht sie im Posteingang des Firmenpostfachs, ist alles eingerichtet.</p>",
    });
    if (!r.ok) return { status: "fehler", meldung: `Senden ging nicht: ${r.fehler}` };
    return { status: "ok", meldung: `Gesendet an ${von.adresse}. Sie sollte in einigen Sekunden unter Mail → Firma → Posteingang stehen.` };
  });
}
