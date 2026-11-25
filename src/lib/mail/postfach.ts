import "server-only";
import { randomUUID } from "node:crypto";
import type { Benutzer } from "../auth";
import { einstellungen } from "../einstellungen";
import { ENV } from "../env";
import { melden } from "../ereignisse";
import { fehlerMelden } from "../fehler";
import { darf, type Rolle } from "../rollen";
import { eingangAnhang, eingangLaden, mailer } from "../services/email";
import { pushSenden } from "../services/push";
import { db, dbRoh, DbFehler } from "../supabase/admin";
import { absender, adresseZerlegen, betreffKern, htmlAlsText, MAIL_NAME_MUSTER, mailNameVon, nachrichtenIds, postfaecherFuer, textAlsHtml, vorschau } from "./adressen";

/**
 * Postfächer in der Anwendung. Einziger Weg, Mails abzulegen, zu senden und zu lesen; Seiten und Aktionen
 * rufen nur diese Funktionen. Postfach `null` ist das Firmenpostfach, sonst die id der Person.
 */

export type Anhang = { name: string; typ: string; groesse: number; pfad: string };

export type MailZeile = {
  id: string;
  postfach: string | null;
  richtung: "eingang" | "ausgang";
  resend_id: string | null;
  message_id: string | null;
  referenzen: string;
  gespraech: string;
  von: string;
  von_name: string;
  an: string[];
  cc: string[];
  antwort_an: string | null;
  betreff: string;
  text: string;
  html: string | null;
  anhaenge: Anhang[];
  gelesen_am: string | null;
  erstellt_am: string;
};

/** Domain der Postfächer: die des Absenders MAIL_FROM (dieselbe Domain ist bei Resend verifiziert). */
export function mailDomain(): string {
  return adresseZerlegen(ENV.mailFrom).adresse.split("@")[1] ?? "";
}

export function darfPostfach(b: Pick<Benutzer, "id" | "rolle">, postfach: string | null): boolean {
  return postfach === null ? darf(b.rolle, "firmenmail") : postfach === b.id;
}

type Person = { id: string; name: string; mail_name: string | null; aktiv: boolean; rolle: Rolle | null };

async function personen(): Promise<Person[]> {
  const { data } = await db().from("profile").select("id, name, mail_name, aktiv, rolle");
  return (data ?? []) as Person[];
}

/** Adresse einer Person (vorname.nachname@domain), leer ohne Namen oder ohne Domain. */
export function personenAdresse(p: { name: string; mail_name?: string | null }): string {
  const lokal = mailNameVon(p);
  const domain = mailDomain();
  return lokal && domain ? `${lokal}@${domain}` : "";
}

/** Absender des Firmenpostfachs: Firmen-E-Mail aus den Einstellungen, wenn sie auf der Domain liegt, sonst MAIL_FROM. */
async function firmenAbsender(): Promise<{ name: string; adresse: string }> {
  const { firma } = await einstellungen();
  const eigene = firma.email.trim().toLowerCase();
  const von = adresseZerlegen(ENV.mailFrom);
  return { name: firma.name || von.name, adresse: eigene.endsWith(`@${mailDomain()}`) ? eigene : von.adresse };
}

/** Message-IDs immer mit spitzen Klammern speichern; Resend liefert sie mal mit, mal ohne. */
const mid = (wert: string | null | undefined) => (wert ? (wert.startsWith("<") ? wert : `<${wert}>`) : null);

/** Filter auf ein Postfach (null = Firmenpostfach braucht `is`, nicht `eq`). Lose typisiert: Die Typen der
 *  Abfragekette sind für einen generischen Helfer zu tief. */
function imPostfach<T>(q: T, postfach: string | null): T {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const a = q as any;
  return postfach === null ? a.is("postfach", null) : a.eq("postfach", postfach);
}

/**
 * Zu welchem Gespräch eine Mail gehört: über In-Reply-To/References (gleiches Postfach), sonst über
 * denselben Betreff mit demselben Gegenüber in den letzten 90 Tagen. Ohne Treffer ein neues Gespräch.
 */
async function gespraechFinden(postfach: string | null, ids: string[], betreff: string, gegenueber: string): Promise<string> {
  if (ids.length) {
    const { data } = await imPostfach(db().from("mails").select("gespraech").in("message_id", ids), postfach).limit(1);
    if (data?.[0]) return data[0].gespraech as string;
  }
  const kern = betreffKern(betreff);
  const g = gegenueber.replace(/["\\{},]/g, "");
  if (kern && g) {
    const seit = new Date(Date.now() - 90 * 864e5).toISOString();
    const { data } = await imPostfach(
      db().from("mails").select("gespraech, betreff").or(`von.eq."${g}",an.cs.{"${g}"}`).gte("erstellt_am", seit),
      postfach,
    )
      .order("erstellt_am", { ascending: false })
      .limit(50);
    const treffer = (data ?? []).find((m) => betreffKern(m.betreff as string) === kern);
    if (treffer) return treffer.gespraech as string;
  }
  return randomUUID();
}

/** Dateiname für den Speicher: ohne Pfadzeichen und Sonderzeichen, Endung bleibt. */
const sauber = (name: string) => name.normalize("NFD").replace(/[^\w.-]+/g, "_").replace(/^\.+/, "").slice(-120) || "anhang";

/**
 * Legt eine eingegangene Mail ab (aus dem Webhook). Wiederholt Resend die Zustellung, bleibt es bei
 * einer Ablage. Anhänge kommen in den eigenen Speicher, weil Resend sie nur begrenzt aufbewahrt.
 */
export async function empfangen(resendId: string): Promise<void> {
  const { data: schon } = await db().from("mails").select("id").eq("resend_id", resendId).limit(1);
  if (schon?.length) return;

  const m = await eingangLaden(resendId);
  const leute = await personen();
  const ziele = postfaecherFuer(m.fuer, mailDomain(), leute);

  const anhaenge: Anhang[] = [];
  for (const [i, a] of m.anhaenge.filter((x) => !x.inline).entries()) {
    try {
      const inhalt = await eingangAnhang(m.id, a.id);
      const pfad = `eingang/${resendId}/${i}-${sauber(a.name)}`;
      const { error } = await db().storage.from("mail").upload(pfad, inhalt, { contentType: a.typ, upsert: true });
      if (error) throw error;
      anhaenge.push({ name: a.name, typ: a.typ, groesse: a.groesse, pfad });
    } catch (fehler) {
      // Ein Anhang, der nicht ankommt, darf die Mail nicht aufhalten; er steht dann im Fehlerprotokoll
      await fehlerMelden(fehler, `Mail-Anhang „${a.name}“ speichern`);
    }
  }

  const von = adresseZerlegen(m.von);
  const text = m.text?.trim() || htmlAlsText(m.html ?? "");
  const ids = nachrichtenIds(m.inReplyTo, m.referenzen);
  for (const postfach of ziele) {
    const gespraech = await gespraechFinden(postfach, ids, m.betreff, von.adresse);
    const { error } = await dbRoh()
      .from("mails")
      .insert({
        postfach,
        richtung: "eingang",
        resend_id: resendId,
        message_id: mid(m.messageId),
        referenzen: [m.referenzen, m.inReplyTo].filter(Boolean).join(" ").trim(),
        gespraech,
        von: von.adresse,
        von_name: von.name,
        an: m.an.map((a) => adresseZerlegen(a).adresse),
        cc: m.cc.map((a) => adresseZerlegen(a).adresse),
        antwort_an: m.antwortAn ? adresseZerlegen(m.antwortAn).adresse : null,
        betreff: m.betreff,
        text,
        html: m.html,
        anhaenge,
        erstellt_am: m.erhalten,
      });
    // Zwei Zustellungen gleichzeitig: die zweite stößt auf den eindeutigen Index und ist schon erledigt
    if (error?.code === "23505") continue;
    if (error) throw new DbFehler(error, { tabelle: "mails", vorgang: "Mail ablegen" });

    const person = leute.find((p) => p.id === postfach);
    await melden("mail.eingegangen", postfach ? { postfach: "person" } : { postfach: "firma", von: von.adresse, betreff: m.betreff });
    await pushSenden(postfach ? { profile: [postfach] } : { rollen: ["inhaber", "buero"] }, {
      titel: postfach ? `Mail von ${von.name || von.adresse}` : `Firmenpostfach: ${von.name || von.adresse}`,
      text: m.betreff || vorschau(text, 80) || "(ohne Betreff)",
      url: `${person?.rolle === "mitarbeiter" ? "/team" : "/app"}/mail/${gespraech}`,
      tag: `mail-${gespraech}`,
    });
  }
}

/** Message-ID einer gesendeten Mail nachtragen (Webhook „email.sent“): Antworten finden so ihr Gespräch. */
export async function gesendetVermerken(resendId: string, messageId: string): Promise<void> {
  await db().from("mails").update({ message_id: mid(messageId) }).eq("resend_id", resendId).eq("richtung", "ausgang");
}

export type Gespraech = {
  id: string;
  betreff: string;
  gegenueber: string;
  vorschau: string;
  zuletzt: string;
  anzahl: number;
  ungelesen: number;
  anhang: boolean;
  zuletztGesendet: boolean;
};

/** Gespräche eines Postfachs, neueste zuerst; mit Suche in Betreff, Absender, Empfänger und Text. */
export async function gespraecheLaden(postfach: string | null, suche = ""): Promise<Gespraech[]> {
  let q = imPostfach(
    db().from("mails").select("gespraech, richtung, von, von_name, an, betreff, text, anhaenge, gelesen_am, erstellt_am"),
    postfach,
  );
  const s = suche.replace(/[%,()\\]/g, " ").trim();
  if (s) q = q.or(`betreff.ilike.%${s}%,von.ilike.%${s}%,von_name.ilike.%${s}%,text.ilike.%${s}%`);
  const { data } = await q.order("erstellt_am", { ascending: false }).limit(600);
  const liste = new Map<string, Gespraech>();
  for (const m of (data ?? []) as MailZeile[]) {
    const g = liste.get(m.gespraech);
    const ungelesen = m.richtung === "eingang" && !m.gelesen_am ? 1 : 0;
    if (g) {
      g.anzahl += 1;
      g.ungelesen += ungelesen;
      g.anhang ||= m.anhaenge.length > 0;
      // Gegenüber ist der letzte fremde Absender, sonst der Empfänger der letzten eigenen Mail
      if (g.zuletztGesendet && m.richtung === "eingang") g.gegenueber = m.von_name || m.von;
      continue;
    }
    liste.set(m.gespraech, {
      id: m.gespraech,
      betreff: m.betreff || "(ohne Betreff)",
      gegenueber: m.richtung === "eingang" ? m.von_name || m.von : `An ${m.an.join(", ")}`,
      vorschau: vorschau(m.text),
      zuletzt: m.erstellt_am,
      anzahl: 1,
      ungelesen,
      anhang: m.anhaenge.length > 0,
      zuletztGesendet: m.richtung === "ausgang",
    });
  }
  return [...liste.values()];
}

/** Alle Mails eines Gesprächs, älteste zuerst; null, wenn es fehlt oder nicht in ein Postfach der Person gehört. */
export async function gespraechLaden(b: Pick<Benutzer, "id" | "rolle">, gespraech: string): Promise<MailZeile[] | null> {
  if (!/^[0-9a-f-]{36}$/.test(gespraech)) return null;
  const { data } = await db().from("mails").select("*").eq("gespraech", gespraech).order("erstellt_am");
  const mails = (data ?? []) as MailZeile[];
  if (!mails.length || !darfPostfach(b, mails[0].postfach)) return null;
  return mails;
}

/** Ungelesene Mails im eigenen Postfach und (mit Recht) im Firmenpostfach. */
export async function ungelesen(b: Pick<Benutzer, "id" | "rolle">): Promise<{ eigene: number; firma: number }> {
  const zaehlen = (postfach: string | null) =>
    imPostfach(db().from("mails").select("id", { count: "exact", head: true }).eq("richtung", "eingang").is("gelesen_am", null), postfach).then(
      (r) => r.count ?? 0,
    );
  const [eigene, firma] = await Promise.all([zaehlen(b.id), darf(b.rolle, "firmenmail") ? zaehlen(null) : 0]);
  return { eigene, firma };
}

/** Adresse, unter der die Person selbst erreichbar ist (für Kopf und Hinweise). */
export async function eigeneAdresse(b: Pick<Benutzer, "id">): Promise<string> {
  const { data } = await db().from("profile").select("name, mail_name").eq("id", b.id).maybeSingle();
  return data ? personenAdresse(data as { name: string; mail_name: string | null }) : "";
}

/**
 * Prüft den Teil vor dem @ für eine Person, bevor er gespeichert wird: gültige Zeichen, nicht die Adresse
 * des Firmenpostfachs oder des Absenders (sonst landen Kundenmails bei einer Person), nicht schon vergeben.
 * Gibt die Meldung zurück oder null.
 */
export async function mailNamePruefen(id: string, name: string, mailName: string | null): Promise<string | null> {
  if (mailName && !MAIL_NAME_MUSTER.test(mailName)) return "Mailadresse: nur Kleinbuchstaben, Ziffern und einzelne Punkte, Binde- oder Unterstriche.";
  const lokal = mailNameVon({ name, mail_name: mailName });
  if (!lokal) return null;
  const reserviert = [await firmenAdresse(), adresseZerlegen(ENV.mailFrom).adresse].map((a) => a.split("@")[0]);
  if (reserviert.includes(lokal)) return `Die Adresse ${lokal}@ gehört zum Firmenpostfach. Bitte eine andere wählen.`;
  const andere = (await personen()).filter((p) => p.id !== id && p.aktiv);
  const belegt = andere.find((p) => mailNameVon(p) === lokal);
  return belegt ? `Die Adresse ${lokal}@ hat schon ${belegt.name}. Bitte unter „Mailadresse“ eine andere eintragen.` : null;
}

export async function firmenAdresse(): Promise<string> {
  return (await firmenAbsender()).adresse;
}

export type Entwurf = {
  postfach: string | null;
  an: string[];
  cc: string[];
  betreff: string;
  text: string;
  /** Mail, auf die geantwortet wird (im selben Postfach) */
  antwortAuf: MailZeile | null;
  anhaenge: Anhang[];
};

/** Sendet eine Mail aus einem Postfach und legt sie im Gespräch ab. Gibt die Gesprächs-id zurück. */
export async function senden(b: Pick<Benutzer, "id" | "rolle">, e: Entwurf): Promise<string> {
  if (!darfPostfach(b, e.postfach)) throw new Error("Aus diesem Postfach dürfen Sie nicht senden.");
  if (e.antwortAuf && e.antwortAuf.postfach !== e.postfach) throw new Error("Die Antwort gehört in dasselbe Postfach.");

  let von: { name: string; adresse: string };
  if (e.postfach === null) {
    von = await firmenAbsender();
    // Antwort aus dem Firmenpostfach: von der Adresse, an die der Kunde geschrieben hat (info@, termine@ …)
    const domain = `@${mailDomain()}`;
    const angeschrieben = e.antwortAuf?.richtung === "eingang" ? [...e.antwortAuf.an, ...e.antwortAuf.cc].find((a) => a.endsWith(domain)) : undefined;
    const leute = await personen();
    if (angeschrieben && !leute.some((p) => personenAdresse(p) === angeschrieben)) von = { ...von, adresse: angeschrieben };
  } else {
    const { data: p } = await db().from("profile").select("name, mail_name").eq("id", e.postfach).single();
    const adresse = personenAdresse(p as { name: string; mail_name: string | null });
    if (!adresse) throw new Error("Für dieses Postfach fehlt noch eine Adresse: Bitte in der Verwaltung einen Namen eintragen.");
    von = { name: p!.name as string, adresse };
  }

  const kopfzeilen: Record<string, string> = {};
  if (e.antwortAuf?.message_id) {
    kopfzeilen["In-Reply-To"] = e.antwortAuf.message_id;
    kopfzeilen.References = [e.antwortAuf.referenzen, e.antwortAuf.message_id].filter(Boolean).join(" ").trim();
  }

  const dateien = await Promise.all(
    e.anhaenge.map(async (a) => {
      if (!a.pfad.startsWith("ausgang/")) throw new Error("Unbekannter Anhang.");
      const { data, error } = await db().storage.from("mail").download(a.pfad);
      if (error || !data) throw new Error(`Der Anhang „${a.name}“ ist nicht mehr da. Bitte neu anhängen.`);
      return { dateiname: a.name, inhalt: Buffer.from(await data.arrayBuffer()), typ: a.typ };
    }),
  );

  const ergebnis = await mailer().senden({
    von: absender(von.name, von.adresse),
    an: e.an,
    cc: e.cc,
    betreff: e.betreff,
    text: e.text,
    html: textAlsHtml(e.text),
    kopfzeilen: Object.keys(kopfzeilen).length ? kopfzeilen : undefined,
    anhaenge: dateien,
  });
  if (!ergebnis.ok) throw new Error(`Die Mail wurde nicht gesendet: ${ergebnis.fehler}`);

  const gespraech = e.antwortAuf?.gespraech ?? randomUUID();
  await db().from("mails").insert({
    postfach: e.postfach,
    richtung: "ausgang",
    resend_id: ergebnis.id ?? null,
    referenzen: kopfzeilen.References ?? "",
    gespraech,
    von: von.adresse,
    von_name: von.name,
    an: e.an,
    cc: e.cc,
    betreff: e.betreff,
    text: e.text,
    anhaenge: e.anhaenge,
    gelesen_am: new Date().toISOString(),
    gesendet_von: b.id,
  });
  await melden("mail.gesendet", { postfach: e.postfach ? "person" : "firma" });
  return gespraech;
}

/** Gespräch als gelesen oder ungelesen markieren. */
export async function gelesenSetzen(b: Pick<Benutzer, "id" | "rolle">, gespraech: string, gelesen: boolean): Promise<void> {
  const mails = await gespraechLaden(b, gespraech);
  if (!mails) throw new Error("Dieses Gespräch gibt es nicht mehr.");
  if (gelesen) {
    await db().from("mails").update({ gelesen_am: new Date().toISOString() }).eq("gespraech", gespraech).is("gelesen_am", null);
  } else {
    // Ungelesen: nur die letzte eingegangene Mail, wie in anderen Mailprogrammen
    const letzte = mails.filter((m) => m.richtung === "eingang").at(-1);
    if (letzte) await db().from("mails").update({ gelesen_am: null }).eq("id", letzte.id);
  }
}

/** Gespräch löschen, mit Anhängen, die keine andere Ablage mehr braucht (eine Mail an zwei Postfächer teilt sie). */
export async function gespraechLoeschen(b: Pick<Benutzer, "id" | "rolle">, gespraech: string): Promise<void> {
  const mails = await gespraechLaden(b, gespraech);
  if (!mails) return;
  await db().from("mails").delete().eq("gespraech", gespraech);
  const pfade = [...new Set(mails.flatMap((m) => m.anhaenge.map((a) => a.pfad)))];
  if (!pfade.length) return;
  const ids = mails.map((m) => m.resend_id).filter((x): x is string => Boolean(x));
  const { data: rest } = ids.length ? await db().from("mails").select("anhaenge").in("resend_id", ids) : { data: [] };
  const nochGebraucht = new Set((rest ?? []).flatMap((r) => (r.anhaenge as Anhang[]).map((a) => a.pfad)));
  const weg = pfade.filter((p) => !nochGebraucht.has(p));
  if (weg.length) await db().storage.from("mail").remove(weg);
}

/** Kurzlebiger Link zu einem Anhang, nur für jemanden mit Zugriff auf das Postfach. */
export async function anhangLink(b: Pick<Benutzer, "id" | "rolle">, mailId: string, nr: number): Promise<string | null> {
  const { data: m } = await db().from("mails").select("postfach, anhaenge").eq("id", mailId).maybeSingle();
  if (!m || !darfPostfach(b, m.postfach as string | null)) return null;
  const a = (m.anhaenge as Anhang[])[nr];
  if (!a) return null;
  const { data } = await db().storage.from("mail").createSignedUrl(a.pfad, 60, { download: a.name });
  return data?.signedUrl ?? null;
}
