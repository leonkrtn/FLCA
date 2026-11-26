import "server-only";
import { randomUUID } from "node:crypto";
import { cache } from "react";
import type { Benutzer } from "../auth";
import { einstellungen } from "../einstellungen";
import { ENV } from "../env";
import { melden } from "../ereignisse";
import { fehlerMelden } from "../fehler";
import { darf, type Rolle } from "../rollen";
import { eingangAnhang, eingangLaden, mailer, standardAbsender } from "../services/email";

export { standardAbsender };
import { pushSenden } from "../services/push";
import { db, dbRoh, DbFehler } from "../supabase/admin";
import { berlinDatum } from "../zeit";
import { absender, adresseZerlegen, betreffKern, htmlAlsText, MAIL_NAME_MUSTER, mailNameVon, nachrichtenIds, vorschau, zuordnen } from "./adressen";
import { hatText, htmlBereinigen, verlaufAbschneiden } from "./inhalt";

/**
 * Postfächer in der Anwendung. Einziger Weg, Mails abzulegen, zu senden, zu verschieben und zu lesen; Seiten
 * und Aktionen rufen nur diese Funktionen. Postfach `null` ist das Firmenpostfach, sonst die id der Person.
 * Jede Funktion mit Benutzerbezug prüft den Zugriff selbst (`darfMail`).
 */

export type Anhang = { name: string; typ: string; groesse: number; pfad: string };

export const ORDNER = ["eingang", "sonstige", "ausgang", "gesendet", "entwuerfe", "archiv", "papierkorb"] as const;
export type Ordner = (typeof ORDNER)[number];
/** Ansichten in der Ordnerleiste: echte Ordner und Filter über alle Ordner */
export type Ansicht = Ordner | "gekennzeichnet" | "zugewiesen" | "spaeter";

export type MailZeile = {
  id: string;
  postfach: string | null;
  richtung: "eingang" | "ausgang";
  ordner: Ordner;
  ordner_vorher: string | null;
  /** Aus dem Papierkorb gelöscht: nicht mehr im Postfach, nur noch unter Einstellungen → Archiv */
  aufbewahrt_am?: string | null;
  resend_id: string | null;
  message_id: string | null;
  referenzen: string;
  gespraech: string;
  von: string;
  von_name: string;
  an: string[];
  cc: string[];
  bcc: string[];
  antwort_an: string | null;
  ziel_adresse: string | null;
  betreff: string;
  text: string;
  html: string | null;
  anhaenge: Anhang[];
  gelesen_am: string | null;
  gekennzeichnet: boolean;
  angeheftet: boolean;
  kategorien: string[];
  zugewiesen_an: string | null;
  erinnern_am: string | null;
  oben_am: string;
  senden_am: string | null;
  versand: "geplant" | "laeuft" | "fehler" | null;
  versand_fehler: string | null;
  zustellung: string | null;
  zustellung_am: string | null;
  antwort_auf: string | null;
  gesendet_von: string | null;
  geloescht_am: string | null;
  erstellt_am: string;
};

// ---------------------------------------------------------------------------
// Adressen und Zugriff
// ---------------------------------------------------------------------------

/** Domain der Postfächer: die des Absenders MAIL_FROM (dieselbe Domain ist bei Resend verifiziert). */
export function mailDomain(): string {
  return adresseZerlegen(ENV.mailFrom).adresse.split("@")[1] ?? "";
}

type Person = { id: string; name: string; mail_name: string | null; aktiv: boolean; rolle: Rolle | null; mail_push: boolean; jobbezeichnung: string; signatur_telefon: string };

const personen = cache(async (): Promise<Person[]> => {
  const { data } = await db().from("profile").select("id, name, mail_name, aktiv, rolle, mail_push, jobbezeichnung, signatur_telefon");
  return (data ?? []) as Person[];
});

/** Adresse einer Person (vorname.nachname@domain), leer ohne Namen oder ohne Domain. */
export function personenAdresse(p: { name: string; mail_name?: string | null }): string {
  const lokal = mailNameVon(p);
  const domain = mailDomain();
  return lokal && domain ? `${lokal}@${domain}` : "";
}

/** Alle Adressen, die in den Posteingang des Firmenpostfachs gehen (voll, klein geschrieben). */
export async function firmenAdressen(): Promise<string[]> {
  const { mail } = await einstellungen();
  const domain = mailDomain();
  const lokal = new Set([...mail.firmenAdressen, mail.standardAdresse, adresseZerlegen(ENV.mailFrom).adresse.split("@")[0]].map((a) => a.trim().toLowerCase()).filter(Boolean));
  return [...lokal].map((l) => `${l}@${domain}`);
}

/** Was eine Person im Postfach darf. Einmal je Anfrage ermitteln und an alle Funktionen geben. */
export type Zugang = { id: string; rolle: Rolle | null; firma: boolean };

/**
 * Firmenpostfach: Inhaber immer, sonst wer in Einstellungen → E-Mail angekreuzt ist (ohne Liste: Inhaber und Büro).
 * Wem eine Mail des Firmenpostfachs zugewiesen ist, sieht diese eine Unterhaltung trotzdem (`darfMail`).
 */
export async function zugang(b: Pick<Benutzer, "id" | "rolle">): Promise<Zugang> {
  const { mail } = await einstellungen();
  const firma = b.rolle === "inhaber" || (mail.zugriff === null ? darf(b.rolle, "firmenmail") : mail.zugriff.includes(b.id));
  return { id: b.id, rolle: b.rolle, firma };
}

export function darfMail(z: Zugang, m: { postfach: string | null; zugewiesen_an?: string | null }): boolean {
  return m.postfach === null ? z.firma || m.zugewiesen_an === z.id : m.postfach === z.id;
}

/** Personen mit Zugriff aufs Firmenpostfach (für Push und Einstellungen). */
async function firmaPersonen(): Promise<Person[]> {
  const [{ mail }, leute] = await Promise.all([einstellungen(), personen()]);
  return leute.filter((p) => p.aktiv && (p.rolle === "inhaber" || (mail.zugriff === null ? darf(p.rolle, "firmenmail") : mail.zugriff.includes(p.id))));
}

/** Adressen, von denen jemand senden darf: eigene Adresse und (mit Zugriff) die Adressen des Firmenpostfachs. */
export async function absenderListe(z: Zugang): Promise<{ adresse: string; name: string; postfach: string | null }[]> {
  const [leute, std, firma] = await Promise.all([personen(), standardAbsender(), firmenAdressen()]);
  const ich = leute.find((p) => p.id === z.id);
  const liste: { adresse: string; name: string; postfach: string | null }[] = [];
  if (z.firma) {
    liste.push({ adresse: std.adresse, name: std.name, postfach: null });
    for (const a of firma) if (a !== std.adresse) liste.push({ adresse: a, name: std.name, postfach: null });
  }
  const eigene = ich ? personenAdresse(ich) : "";
  if (ich && eigene) liste.push({ adresse: eigene, name: ich.name, postfach: z.id });
  return liste;
}

/**
 * Prüft den Teil vor dem @ für eine Person, bevor er gespeichert wird: gültige Zeichen, keine Adresse des
 * Firmenpostfachs (sonst landen Kundenmails bei einer Person), nicht schon vergeben. Gibt die Meldung zurück oder null.
 */
export async function mailNamePruefen(id: string, name: string, mailName: string | null): Promise<string | null> {
  if (mailName && !MAIL_NAME_MUSTER.test(mailName)) return "Mailadresse: nur Kleinbuchstaben, Ziffern und einzelne Punkte, Binde- oder Unterstriche.";
  const lokal = mailNameVon({ name, mail_name: mailName });
  if (!lokal) return null;
  const reserviert = (await firmenAdressen()).map((a) => a.split("@")[0]);
  if (reserviert.includes(lokal)) return `Die Adresse ${lokal}@ gehört zum Firmenpostfach. Bitte eine andere wählen.`;
  const belegt = (await personen()).find((p) => p.id !== id && p.aktiv && mailNameVon(p) === lokal);
  return belegt ? `Die Adresse ${lokal}@ hat schon ${belegt.name}. Bitte unter „Mailadresse“ eine andere eintragen.` : null;
}

// ---------------------------------------------------------------------------
// Empfangen
// ---------------------------------------------------------------------------

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
async function gespraechFinden(postfach: string | null, ids: string[], betreff: string, gegenueber: string): Promise<{ id: string; zugewiesen: string | null }> {
  if (ids.length) {
    const { data } = await imPostfach(db().from("mails").select("gespraech, zugewiesen_an").in("message_id", ids), postfach).limit(1);
    if (data?.[0]) return { id: data[0].gespraech as string, zugewiesen: (data[0].zugewiesen_an as string | null) ?? null };
  }
  const kern = betreffKern(betreff);
  const g = gegenueber.replace(/["\\{},]/g, "");
  if (kern && g) {
    const seit = new Date(Date.now() - 90 * 864e5).toISOString();
    const { data } = await imPostfach(
      db().from("mails").select("gespraech, betreff, zugewiesen_an").or(`von.eq."${g}",an.cs.{"${g}"}`).gte("erstellt_am", seit).neq("ordner", "entwuerfe"),
      postfach,
    )
      .order("erstellt_am", { ascending: false })
      .limit(50);
    const treffer = (data ?? []).find((m) => betreffKern(m.betreff as string) === kern);
    if (treffer) return { id: treffer.gespraech as string, zugewiesen: (treffer.zugewiesen_an as string | null) ?? null };
  }
  return { id: randomUUID(), zugewiesen: null };
}

/** Dateiname für den Speicher: ohne Pfadzeichen und Sonderzeichen, Endung bleibt. */
export const sauber = (name: string) => name.normalize("NFD").replace(/[^\w.-]+/g, "_").replace(/^\.+/, "").slice(-120) || "anhang";

/** Wohin ein Tipp auf den Push führt: Mitarbeiter in die Team-App, alle anderen in die Werkstatt-App. */
const mailUrl = (p: Person | undefined, gespraech: string) => `${p?.rolle === "mitarbeiter" ? "/team" : "/app"}/mail/${gespraech}`;

/**
 * Legt eine eingegangene Mail ab (aus dem Webhook). Wiederholt Resend die Zustellung, bleibt es bei
 * einer Ablage. Anhänge kommen in den eigenen Speicher, weil Resend sie nur begrenzt aufbewahrt.
 */
export async function empfangen(resendId: string): Promise<void> {
  const { data: schon } = await db().from("mails").select("id").eq("resend_id", resendId).limit(1);
  if (schon?.length) return;

  const [m, leute, e] = await Promise.all([eingangLaden(resendId), personen(), einstellungen()]);
  const firmaLokal = (await firmenAdressen()).map((a) => a.split("@")[0]);
  const ablagen = zuordnen(m.fuer, mailDomain(), leute, firmaLokal);

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
  for (const ablage of ablagen) {
    const g = await gespraechFinden(ablage.postfach, ids, m.betreff, von.adresse);
    const { error } = await dbRoh()
      .from("mails")
      .insert({
        postfach: ablage.postfach,
        richtung: "eingang",
        ordner: ablage.ordner,
        ziel_adresse: ablage.ziel || null,
        resend_id: resendId,
        message_id: mid(m.messageId),
        referenzen: [m.referenzen, m.inReplyTo].filter(Boolean).join(" ").trim(),
        gespraech: g.id,
        // Eine zugewiesene Unterhaltung bleibt bei ihrer Person, auch wenn der Kunde antwortet
        zugewiesen_an: g.zugewiesen,
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
        oben_am: new Date().toISOString(),
      });
    // Zwei Zustellungen gleichzeitig: die zweite stößt auf den eindeutigen Index und ist schon erledigt
    if (error?.code === "23505") continue;
    if (error) throw new DbFehler(error, { tabelle: "mails", vorgang: "Mail ablegen" });

    await melden("mail.eingegangen", ablage.postfach ? { postfach: "person" } : { postfach: "firma", ordner: ablage.ordner, von: von.adresse, betreff: m.betreff });

    // Push: Person selbst; Firmenpostfach an die in den Einstellungen Gewählten (ohne Liste: alle mit Zugriff),
    // „Sonstige“ ohne Push. Jede Person kann Push für Mails für sich abschalten.
    let ziel: Person[] = [];
    if (ablage.postfach) ziel = leute.filter((p) => p.id === ablage.postfach);
    else if (ablage.ordner === "eingang") {
      const mitZugriff = await firmaPersonen();
      ziel = e.mail.push === null ? mitZugriff : leute.filter((p) => p.aktiv && e.mail.push!.includes(p.id));
      const zugewiesen = leute.find((p) => p.id === g.zugewiesen);
      if (zugewiesen && !ziel.includes(zugewiesen)) ziel.push(zugewiesen);
    }
    ziel = ziel.filter((p) => p.mail_push);
    for (const p of ziel) {
      await pushSenden(
        { profile: [p.id] },
        {
          titel: ablage.postfach ? `Mail von ${von.name || von.adresse}` : `${ablage.ziel || "Firmenpostfach"}: ${von.name || von.adresse}`,
          text: m.betreff || vorschau(text, 80) || "(ohne Betreff)",
          url: mailUrl(p, g.id),
          tag: `mail-${g.id}`,
        },
      );
    }
  }
}

/** Message-ID einer gesendeten Mail nachtragen (Webhook „email.sent“): Antworten finden so ihr Gespräch. */
export async function gesendetVermerken(resendId: string, messageId: string): Promise<void> {
  await db().from("mails").update({ message_id: mid(messageId) }).eq("resend_id", resendId).eq("richtung", "ausgang");
}

export type Zustellung = "zugestellt" | "verzoegert" | "abgewiesen" | "beschwerde";

/**
 * Zustellstatus einer gesendeten Mail (Webhook). Eine Abweisung meldet sich per Push bei der Person, die gesendet
 * hat, weil der Kunde die Mail sonst nie bekommt und niemand es merkt.
 */
export async function zustellungVermerken(resendId: string, stand: Zustellung, grund?: string): Promise<void> {
  const { data } = await db()
    .from("mails")
    .update({ zustellung: stand, zustellung_am: new Date().toISOString(), ...(grund ? { versand_fehler: grund } : {}) })
    .eq("resend_id", resendId)
    .eq("richtung", "ausgang")
    .select("id, gespraech, gesendet_von, an, betreff");
  const m = data?.[0];
  if (!m || stand !== "abgewiesen" || !m.gesendet_von) return;
  const p = (await personen()).find((x) => x.id === m.gesendet_von);
  await pushSenden(
    { profile: [m.gesendet_von as string] },
    { titel: "Mail nicht zugestellt", text: `${(m.an as string[]).join(", ")}: ${m.betreff || "(ohne Betreff)"}`, url: mailUrl(p, m.gespraech as string), tag: `mail-${m.gespraech}` },
  );
}

// ---------------------------------------------------------------------------
// Liste
// ---------------------------------------------------------------------------

export type ListenEintrag = {
  /** Gesprächs-id (Unterhaltung) bzw. Mail-id (einzeln) */
  schluessel: string;
  gespraech: string;
  mailId: string;
  postfach: string | null;
  betreff: string;
  gegenueber: string;
  vorschau: string;
  zuletzt: string;
  anzahl: number;
  ungelesen: number;
  anhang: boolean;
  gekennzeichnet: boolean;
  angeheftet: boolean;
  kategorien: string[];
  zugewiesen_an: string | null;
  erinnern_am: string | null;
  zustellung: string | null;
  versand: MailZeile["versand"];
  senden_am: string | null;
  entwurf: boolean;
};

const LISTE_FELDER =
  "id, postfach, gespraech, richtung, ordner, von, von_name, an, betreff, text, anhaenge, gelesen_am, gekennzeichnet, angeheftet, kategorien, zugewiesen_an, erinnern_am, oben_am, zustellung, versand, senden_am";

/** Eine Seite der Liste: Postfach (Firma oder eigenes), Ordner oder Filter, Kategorie, Suche, Unterhaltung oder einzeln. */
export async function listeLaden(
  z: Zugang,
  o: { postfach: "firma" | "ich"; ansicht: Ansicht; kategorie?: string; suche?: string; einzeln?: boolean },
): Promise<ListenEintrag[]> {
  let q = db().from("mails").select(LISTE_FELDER);
  const jetzt = new Date().toISOString();
  if (o.ansicht === "zugewiesen") {
    q = q.eq("zugewiesen_an", z.id).not("ordner", "in", "(papierkorb,entwuerfe)");
  } else {
    if (o.postfach === "firma" && !z.firma) return [];
    q = imPostfach(q, o.postfach === "firma" ? null : z.id);
    if (o.ansicht === "gekennzeichnet") q = q.eq("gekennzeichnet", true).not("ordner", "in", "(papierkorb,entwuerfe)");
    else if (o.ansicht === "spaeter") q = q.gt("erinnern_am", jetzt).neq("ordner", "papierkorb");
    else {
      q = q.eq("ordner", o.ansicht);
      if (o.ansicht === "papierkorb") q = q.is("aufbewahrt_am", null);
      // Zurückgestellte Mails tauchen erst zum Erinnerungszeitpunkt wieder im Posteingang auf
      if (o.ansicht === "eingang" || o.ansicht === "sonstige") q = q.or(`erinnern_am.is.null,erinnern_am.lte.${jetzt}`);
    }
  }
  if (o.kategorie && /^[0-9a-f-]{36}$/.test(o.kategorie)) q = q.contains("kategorien", [o.kategorie]);
  const s = (o.suche ?? "").replace(/[%,()\\"]/g, " ").trim();
  if (s) q = q.or(`betreff.ilike.%${s}%,von.ilike.%${s}%,von_name.ilike.%${s}%,text.ilike.%${s}%`);
  const { data } = await q.order("oben_am", { ascending: false }).limit(800);
  const mails = (data ?? []) as MailZeile[];

  const eintraege = new Map<string, ListenEintrag>();
  for (const m of mails) {
    const schluessel = o.einzeln ? m.id : m.gespraech;
    const ungelesen = m.richtung === "eingang" && !m.gelesen_am ? 1 : 0;
    const g = eintraege.get(schluessel);
    if (g) {
      g.anzahl += 1;
      g.ungelesen += ungelesen;
      g.anhang ||= m.anhaenge.length > 0;
      g.gekennzeichnet ||= m.gekennzeichnet;
      g.angeheftet ||= m.angeheftet;
      g.kategorien = [...new Set([...g.kategorien, ...m.kategorien])];
      continue;
    }
    // Vorschau ohne mitzitierten Verlauf: Was neu ist, steht vorn
    const neu = verlaufAbschneiden(m.text, false).neu;
    eintraege.set(schluessel, {
      schluessel,
      gespraech: m.gespraech,
      mailId: m.id,
      postfach: m.postfach,
      betreff: m.betreff || "(ohne Betreff)",
      gegenueber: m.richtung === "eingang" ? m.von_name || m.von : m.an.length ? `An ${m.an.join(", ")}` : "(kein Empfänger)",
      vorschau: vorschau(neu),
      zuletzt: m.oben_am,
      anzahl: 1,
      ungelesen,
      anhang: m.anhaenge.length > 0,
      gekennzeichnet: m.gekennzeichnet,
      angeheftet: m.angeheftet,
      kategorien: m.kategorien,
      zugewiesen_an: m.zugewiesen_an,
      erinnern_am: m.erinnern_am,
      zustellung: m.zustellung,
      versand: m.versand,
      senden_am: m.senden_am,
      entwurf: m.ordner === "entwuerfe",
    });
  }
  // Angeheftete oben, sonst nach letzter Bewegung
  return [...eintraege.values()].sort((a, b) => Number(b.angeheftet) - Number(a.angeheftet) || b.zuletzt.localeCompare(a.zuletzt));
}

/** Ungelesene im Posteingang: eigenes Postfach, Firmenpostfach (mit Zugriff), mir Zugewiesenes. */
export async function ungelesen(z: Zugang): Promise<{ eigene: number; firma: number; zugewiesen: number; gesamt: number }> {
  const jetzt = new Date().toISOString();
  const basis = () =>
    db().from("mails").select("id", { count: "exact", head: true }).eq("richtung", "eingang").eq("ordner", "eingang").is("gelesen_am", null).or(`erinnern_am.is.null,erinnern_am.lte.${jetzt}`);
  const [eigene, firma, zugewiesen] = await Promise.all([
    basis().eq("postfach", z.id).then((r) => r.count ?? 0),
    z.firma ? basis().is("postfach", null).then((r) => r.count ?? 0) : 0,
    // Ohne Zugriff aufs Firmenpostfach zählt, was einem zugewiesen ist (sonst steckt es schon in „firma“)
    z.firma ? 0 : basis().eq("zugewiesen_an", z.id).then((r) => r.count ?? 0),
  ]);
  return { eigene, firma, zugewiesen, gesamt: eigene + firma + zugewiesen };
}

/** Anzahl je Ordner für die Ordnerleiste (ungelesen im Posteingang und Sonstige, Entwürfe und Postausgang gesamt). */
export async function ordnerZahlen(z: Zugang, postfach: "firma" | "ich"): Promise<Partial<Record<Ansicht, number>>> {
  if (postfach === "firma" && !z.firma) return {};
  const pf = postfach === "firma" ? null : z.id;
  const jetzt = new Date().toISOString();
  const zaehlen = (f: (q: ReturnType<typeof basis>) => ReturnType<typeof basis>) => f(basis()).then((r) => r.count ?? 0);
  const basis = () => imPostfach(db().from("mails").select("id", { count: "exact", head: true }), pf);
  const [eingang, sonstige, entwuerfe, ausgang, gekennzeichnet, spaeter] = await Promise.all([
    zaehlen((q) => q.eq("ordner", "eingang").eq("richtung", "eingang").is("gelesen_am", null).or(`erinnern_am.is.null,erinnern_am.lte.${jetzt}`)),
    pf === null ? zaehlen((q) => q.eq("ordner", "sonstige").is("gelesen_am", null)) : 0,
    zaehlen((q) => q.eq("ordner", "entwuerfe")),
    zaehlen((q) => q.eq("ordner", "ausgang")),
    zaehlen((q) => q.eq("gekennzeichnet", true).not("ordner", "in", "(papierkorb,entwuerfe)")),
    zaehlen((q) => q.gt("erinnern_am", jetzt).neq("ordner", "papierkorb")),
  ]);
  return { eingang, sonstige, entwuerfe, ausgang, gekennzeichnet, spaeter };
}

// ---------------------------------------------------------------------------
// Lesen
// ---------------------------------------------------------------------------

/**
 * Alle Mails einer Unterhaltung, älteste zuerst, ohne Entwürfe. Gelöschte nur, wenn man im Papierkorb liest.
 * null, wenn es sie nicht gibt oder sie in kein Postfach der Person gehört.
 */
export async function gespraechLaden(z: Zugang, gespraech: string, imPapierkorb = false): Promise<MailZeile[] | null> {
  if (!/^[0-9a-f-]{36}$/.test(gespraech)) return null;
  let q = db().from("mails").select("*").eq("gespraech", gespraech).neq("ordner", "entwuerfe").is("aufbewahrt_am", null);
  if (!imPapierkorb) q = q.neq("ordner", "papierkorb");
  const { data } = await q.order("erstellt_am");
  const mails = (data ?? []) as MailZeile[];
  if (!mails.length || !mails.some((m) => darfMail(z, m))) return null;
  return mails.filter((m) => darfMail(z, m) || (m.postfach === null && mails.some((x) => x.zugewiesen_an === z.id)));
}

/** Eine einzelne Mail (Einzelansicht, Antworten, Weiterleiten, Entwurf öffnen). */
export async function mailLaden(z: Zugang, id: string): Promise<MailZeile | null> {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  const { data } = await db().from("mails").select("*").eq("id", id).maybeSingle();
  const m = data as MailZeile | null;
  if (!m) return null;
  if (darfMail(z, m)) return m;
  // Zugewiesen ist die Unterhaltung, nicht jede einzelne Mail darin
  if (m.postfach === null) {
    const { count } = await db().from("mails").select("id", { count: "exact", head: true }).eq("gespraech", m.gespraech).eq("zugewiesen_an", z.id);
    if (count) return m;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Ordnen: gelesen, Fahne, anheften, Kategorie, zuweisen, erinnern, verschieben, löschen
// ---------------------------------------------------------------------------

export type Aktion =
  | { art: "gelesen" | "ungelesen" | "kennzeichnen" | "entkennzeichnen" | "anheften" | "loesen" | "loeschen" | "wiederherstellen" }
  | { art: "verschieben"; ordner: "eingang" | "archiv" | "sonstige" }
  | { art: "kategorie"; id: string; an: boolean }
  | { art: "zuweisen"; an: string | null }
  | { art: "erinnern"; am: string | null };

/**
 * Wendet eine Aktion auf Unterhaltungen (`gespraeche`) oder einzelne Mails (`mails`) an. `ordner` ist der Ordner,
 * in dem man gerade steht: Verschieben und Löschen betreffen nur die Mails daraus (die eigene Antwort bleibt in
 * „Gesendet“), Fahne, gelesen, Kategorie und Zuweisen gelten für die ganze Unterhaltung. Löschen im Papierkorb
 * nimmt die Mails aus der Ansicht; aufbewahrt werden sie trotzdem (`aufbewahren`).
 */
export async function ordnen(z: Zugang, ziel: { gespraeche?: string[]; mails?: string[] }, a: Aktion, ordner: Ansicht): Promise<number> {
  const gespraeche = (ziel.gespraeche ?? []).filter((x) => /^[0-9a-f-]{36}$/.test(x)).slice(0, 500);
  const einzel = (ziel.mails ?? []).filter((x) => /^[0-9a-f-]{36}$/.test(x)).slice(0, 500);
  if (!gespraeche.length && !einzel.length) return 0;

  // Erlaubte Mails einsammeln (Zugriff je Mail; Zugewiesenes zählt für die ganze Unterhaltung)
  const felder = "id, postfach, gespraech, ordner, ordner_vorher, richtung, zugewiesen_an, anhaenge, resend_id";
  // Aufbewahrte Mails (aus dem Papierkorb gelöscht) fasst keine Aktion mehr an, auch nicht über ihre Unterhaltung.
  const [{ data: g }, { data: e }] = await Promise.all([
    gespraeche.length ? db().from("mails").select(felder).in("gespraech", gespraeche).is("aufbewahrt_am", null) : Promise.resolve({ data: [] }),
    einzel.length ? db().from("mails").select(felder).in("id", einzel).is("aufbewahrt_am", null) : Promise.resolve({ data: [] }),
  ]);
  const alle = [...((g ?? []) as MailZeile[]), ...((e ?? []) as MailZeile[])];
  const zugewiesenG = new Set(alle.filter((m) => m.zugewiesen_an === z.id).map((m) => m.gespraech));
  const erlaubt = alle.filter((m) => darfMail(z, m) || zugewiesenG.has(m.gespraech));
  if (!erlaubt.length) return 0;
  const ids = [...new Set(erlaubt.map((m) => m.id))];
  // Nur die Mails aus dem aktuellen Ordner (bei Filtern wie „Gekennzeichnet“: alle außer Entwürfen)
  const imOrdner = erlaubt.filter((m) => (ORDNER as readonly string[]).includes(ordner) ? m.ordner === ordner : m.ordner !== "entwuerfe");
  const idsOrdner = [...new Set((einzel.length ? erlaubt : imOrdner).map((m) => m.id))];
  const jetzt = new Date().toISOString();
  const setzen = (werte: Record<string, unknown>, nur = ids) => (nur.length ? db().from("mails").update(werte).in("id", nur) : Promise.resolve());

  switch (a.art) {
    case "gelesen":
      await db().from("mails").update({ gelesen_am: jetzt }).in("id", ids).is("gelesen_am", null);
      break;
    case "ungelesen": {
      // Wie in Outlook: nur die letzte eingegangene Mail je Unterhaltung wird wieder ungelesen
      const letzte = new Map<string, string>();
      const { data: eing } = await db().from("mails").select("id, gespraech").in("id", ids).eq("richtung", "eingang").order("erstellt_am");
      for (const m of eing ?? []) letzte.set(m.gespraech as string, m.id as string);
      await setzen({ gelesen_am: null }, [...letzte.values()]);
      break;
    }
    case "kennzeichnen":
    case "entkennzeichnen":
      await setzen({ gekennzeichnet: a.art === "kennzeichnen" });
      break;
    case "anheften":
    case "loesen":
      await setzen({ angeheftet: a.art === "anheften" });
      break;
    case "kategorie": {
      if (!/^[0-9a-f-]{36}$/.test(a.id)) throw new Error("Unbekannte Kategorie.");
      const { data: rows } = await db().from("mails").select("id, kategorien").in("id", ids);
      for (const r of rows ?? []) {
        const alt = (r.kategorien as string[]) ?? [];
        const neu = a.an ? [...new Set([...alt, a.id])] : alt.filter((x) => x !== a.id);
        if (neu.length !== alt.length) await db().from("mails").update({ kategorien: neu }).eq("id", r.id);
      }
      break;
    }
    case "zuweisen": {
      // Zuweisen geht nur im Firmenpostfach und nur mit Zugriff darauf
      if (!z.firma) throw new Error("Zuweisen geht nur mit Zugriff auf das Firmenpostfach.");
      const firmaIds = erlaubt.filter((m) => m.postfach === null).map((m) => m.id);
      const person = a.an ? (await personen()).find((p) => p.id === a.an && p.aktiv) : null;
      if (a.an && !person) throw new Error("Diese Person gibt es nicht (mehr).");
      await setzen({ zugewiesen_an: person?.id ?? null }, firmaIds);
      if (person && person.id !== z.id) {
        const erste = erlaubt.find((m) => m.postfach === null)!;
        const { data: kopf } = await db().from("mails").select("betreff, von_name, von").eq("id", erste.id).single();
        await pushSenden(
          { profile: [person.id] },
          { titel: "Mail für dich", text: `${kopf?.von_name || kopf?.von || ""}: ${kopf?.betreff || "(ohne Betreff)"}`, url: mailUrl(person, erste.gespraech), tag: `mail-${erste.gespraech}` },
        );
      }
      break;
    }
    case "erinnern":
      await setzen({ erinnern_am: a.am });
      break;
    case "verschieben":
      if (a.ordner === "sonstige" && erlaubt.some((m) => m.postfach !== null)) throw new Error("„Sonstige“ gibt es nur im Firmenpostfach.");
      await setzen({ ordner: a.ordner, ordner_vorher: null, geloescht_am: null }, idsOrdner.filter((id) => erlaubt.find((m) => m.id === id)?.richtung === "eingang"));
      break;
    case "loeschen":
      if (ordner === "papierkorb") await aufbewahren(erlaubt.filter((m) => idsOrdner.includes(m.id)));
      else {
        for (const m of erlaubt.filter((x) => idsOrdner.includes(x.id))) {
          await db().from("mails").update({ ordner: "papierkorb", ordner_vorher: m.ordner, geloescht_am: jetzt, versand: null }).eq("id", m.id);
        }
      }
      break;
    case "wiederherstellen":
      for (const m of erlaubt.filter((x) => x.ordner === "papierkorb")) {
        const zurueck = (ORDNER as readonly string[]).includes(m.ordner_vorher ?? "") && m.ordner_vorher !== "ausgang" ? m.ordner_vorher : m.richtung === "eingang" ? "eingang" : "gesendet";
        await db().from("mails").update({ ordner: zurueck, ordner_vorher: null, geloescht_am: null }).eq("id", m.id);
      }
      break;
  }
  return ids.length;
}

/**
 * „Endgültig löschen“ im Papierkorb und der Papierkorb nach 30 Tagen: Die Mails verschwinden aus dem Postfach,
 * bleiben aber mit Anhängen erhalten (Einstellungen → Archiv), denn geschäftliche Mails sind Handels- und
 * Geschäftsbriefe mit 6 Jahren Aufbewahrungsfrist (§ 257 HGB, § 147 AO). Danach löscht der Takt sie
 * (`AUFBEWAHRUNG_JAHRE`). Nie verschickte Entwürfe sind kein Brief und gehen gleich weg.
 */
async function aufbewahren(mails: Pick<MailZeile, "id" | "anhaenge" | "resend_id" | "ordner_vorher" | "ordner">[]): Promise<void> {
  if (!mails.length) return;
  // Entwurf verwerfen kommt direkt aus „Entwürfe“, ein gelöschter Entwurf aus dem Papierkorb mit ordner_vorher.
  const istEntwurf = (m: Pick<MailZeile, "ordner" | "ordner_vorher">) => m.ordner === "entwuerfe" || m.ordner_vorher === "entwuerfe";
  const entwuerfe = mails.filter(istEntwurf);
  const briefe = mails.filter((m) => !istEntwurf(m));
  if (briefe.length) await db().from("mails").update({ aufbewahrt_am: new Date().toISOString(), gekennzeichnet: false, angeheftet: false, erinnern_am: null, zugewiesen_an: null }).in("id", briefe.map((m) => m.id));
  await endgueltigLoeschen(entwuerfe);
}

/** Aufbewahrungsfrist geschäftlicher Mails, gezählt ab dem Ende des Jahres, in dem sie kamen oder gingen. */
export const AUFBEWAHRUNG_JAHRE = 6;

/** Mails endgültig löschen, mit Anhängen, die keine andere Ablage mehr braucht (eine Mail an zwei Postfächer teilt sie). */
async function endgueltigLoeschen(mails: Pick<MailZeile, "id" | "anhaenge" | "resend_id">[]): Promise<void> {
  if (!mails.length) return;
  await db().from("mails").delete().in("id", mails.map((m) => m.id));
  const pfade = [...new Set(mails.flatMap((m) => (m.anhaenge ?? []).map((a) => a.pfad)))];
  if (!pfade.length) return;
  const resendIds = mails.map((m) => m.resend_id).filter((x): x is string => Boolean(x));
  const { data: rest } = resendIds.length ? await db().from("mails").select("anhaenge").in("resend_id", resendIds) : { data: [] };
  const nochGebraucht = new Set((rest ?? []).flatMap((r) => (r.anhaenge as Anhang[]).map((a) => a.pfad)));
  const weg = pfade.filter((p) => !nochGebraucht.has(p));
  if (weg.length) await db().storage.from("mail").remove(weg);
}

// ---------------------------------------------------------------------------
// Entwürfe und Senden
// ---------------------------------------------------------------------------

export type Entwurf = {
  id: string | null;
  /** Absenderadresse (aus `absenderListe`); bestimmt das Postfach */
  von: string;
  an: string[];
  cc: string[];
  bcc: string[];
  betreff: string;
  html: string;
  anhaenge: Anhang[];
  /** Mail, auf die geantwortet oder die weitergeleitet wird */
  bezug: string | null;
};

/** Speichert einen Entwurf (neu oder überschreiben). Gibt die id zurück. */
export async function entwurfSpeichern(z: Zugang, e: Entwurf): Promise<string> {
  const absenderOk = (await absenderListe(z)).find((a) => a.adresse === e.von.toLowerCase());
  if (!absenderOk) throw new Error("Von dieser Adresse dürfen Sie nicht senden.");
  const bezug = e.bezug ? await mailLaden(z, e.bezug) : null;
  if (e.bezug && !bezug) throw new Error("Die Mail, auf die Sie antworten, gibt es nicht mehr.");
  const html = htmlBereinigen(e.html).slice(0, 500_000);
  for (const a of e.anhaenge) if (!a.pfad.startsWith("ausgang/")) throw new Error("Unbekannter Anhang.");
  const werte = {
    postfach: absenderOk.postfach,
    richtung: "ausgang",
    ordner: "entwuerfe",
    von: absenderOk.adresse,
    von_name: absenderOk.name,
    an: e.an,
    cc: e.cc,
    bcc: e.bcc,
    betreff: e.betreff.slice(0, 300),
    html,
    text: htmlAlsText(html),
    anhaenge: e.anhaenge,
    antwort_auf: bezug?.id ?? null,
    // Antwort bleibt in der Unterhaltung, auch wenn sie aus einem anderen Postfach gesendet wird, nur im selben
    gespraech: bezug && bezug.postfach === absenderOk.postfach ? bezug.gespraech : undefined,
    gelesen_am: new Date().toISOString(),
    gesendet_von: z.id,
    oben_am: new Date().toISOString(),
  };
  if (e.id) {
    const alt = await mailLaden(z, e.id);
    if (!alt || alt.ordner !== "entwuerfe") throw new Error("Dieser Entwurf ist schon gesendet oder gelöscht.");
    await db().from("mails").update(werte).eq("id", e.id).eq("ordner", "entwuerfe");
    return e.id;
  }
  const { data } = await db().from("mails").insert(werte).select("id").single();
  return data!.id as string;
}

/** Schreiben fertig: geplant zum Zeitpunkt (später senden) oder in 10 Sekunden (Frist für „Rückgängig“). */
export async function sendenPlanen(z: Zugang, id: string, spaeter: Date | null): Promise<{ senden_am: string }> {
  const m = await mailLaden(z, id);
  if (!m || m.ordner !== "entwuerfe") throw new Error("Dieser Entwurf ist schon gesendet oder gelöscht.");
  if (!m.an.length && !m.cc.length && !m.bcc.length) throw new Error("Bitte mindestens einen Empfänger eintragen.");
  if (!m.betreff.trim() && !hatText(m.html ?? "")) throw new Error("Bitte einen Betreff oder Text eingeben.");
  if (spaeter && spaeter.getTime() < Date.now() + 60_000) throw new Error("Der Zeitpunkt muss in der Zukunft liegen.");
  const senden_am = (spaeter ?? new Date(Date.now() + 10_000)).toISOString();
  await db().from("mails").update({ ordner: "ausgang", versand: "geplant", senden_am, versand_fehler: null, oben_am: new Date().toISOString() }).eq("id", id).eq("ordner", "entwuerfe");
  return { senden_am };
}

/** „Rückgängig“ oder geplanten Versand abbrechen: zurück in die Entwürfe, solange noch nicht abgeholt. */
export async function sendenAbbrechen(z: Zugang, id: string): Promise<boolean> {
  const m = await mailLaden(z, id);
  if (!m) return false;
  const { data } = await db().from("mails").update({ ordner: "entwuerfe", versand: null, senden_am: null }).eq("id", id).eq("versand", "geplant").select("id");
  return Boolean(data?.length);
}

/**
 * Versendet eine geplante Mail, sobald sie fällig ist. Wer zuerst kommt (Browser nach der Rückgängig-Frist oder
 * der Minutentakt), holt sie ab (`geplant` → `laeuft`); so geht keine Mail doppelt raus.
 */
export async function versenden(id: string): Promise<"gesendet" | "nicht_faellig" | "fehler"> {
  const { data } = await db()
    .from("mails")
    .update({ versand: "laeuft" })
    .eq("id", id)
    .eq("versand", "geplant")
    .lte("senden_am", new Date().toISOString())
    .select("*");
  const m = data?.[0] as MailZeile | undefined;
  if (!m) return "nicht_faellig";
  try {
    const bezug = m.antwort_auf ? ((await db().from("mails").select("message_id, referenzen").eq("id", m.antwort_auf).maybeSingle()).data as Pick<MailZeile, "message_id" | "referenzen"> | null) : null;
    const kopfzeilen: Record<string, string> = {};
    if (bezug?.message_id) {
      kopfzeilen["In-Reply-To"] = bezug.message_id;
      kopfzeilen.References = [bezug.referenzen, bezug.message_id].filter(Boolean).join(" ").trim();
    }
    const dateien = await Promise.all(
      m.anhaenge.map(async (a) => {
        const { data: d, error } = await db().storage.from("mail").download(a.pfad);
        if (error || !d) throw new Error(`Der Anhang „${a.name}“ fehlt.`);
        return { dateiname: a.name, inhalt: Buffer.from(await d.arrayBuffer()), typ: a.typ };
      }),
    );
    const html = htmlBereinigen(m.html ?? "");
    const ergebnis = await mailer().senden({
      von: absender(m.von_name, m.von),
      an: m.an,
      cc: m.cc,
      bcc: m.bcc,
      betreff: m.betreff,
      html: `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#222222">${html}</div>`,
      text: htmlAlsText(html),
      kopfzeilen: Object.keys(kopfzeilen).length ? kopfzeilen : undefined,
      anhaenge: dateien,
    });
    if (!ergebnis.ok) throw new Error(ergebnis.fehler);
    const jetzt = new Date().toISOString();
    await db()
      .from("mails")
      .update({ ordner: "gesendet", versand: null, resend_id: ergebnis.id ?? null, referenzen: kopfzeilen.References ?? "", erstellt_am: jetzt, oben_am: jetzt })
      .eq("id", m.id);
    await melden("mail.gesendet", { postfach: m.postfach ? "person" : "firma" });
    return "gesendet";
  } catch (fehler) {
    const grund = fehler instanceof Error ? fehler.message : String(fehler);
    await db().from("mails").update({ versand: "fehler", versand_fehler: grund.slice(0, 500) }).eq("id", m.id);
    await fehlerMelden(fehler, "Mail senden");
    if (m.gesendet_von) {
      const p = (await personen()).find((x) => x.id === m.gesendet_von);
      await pushSenden({ profile: [m.gesendet_von] }, { titel: "Mail nicht gesendet", text: `${m.betreff || "(ohne Betreff)"}: ${grund}`.slice(0, 180), url: mailUrl(p, m.gespraech), tag: `mail-${m.gespraech}` });
    }
    return "fehler";
  }
}

/** Nach einem Fehler erneut versuchen (aus dem Postausgang). */
export async function erneutSenden(z: Zugang, id: string): Promise<void> {
  const m = await mailLaden(z, id);
  if (!m || m.versand !== "fehler") throw new Error("Diese Mail wartet nicht auf einen neuen Versuch.");
  await db().from("mails").update({ versand: "geplant", senden_am: new Date().toISOString(), versand_fehler: null }).eq("id", id);
  await versenden(id);
}

// ---------------------------------------------------------------------------
// Takt: geplante Mails senden, Erinnerungen wecken, Papierkorb leeren
// ---------------------------------------------------------------------------

export async function taktMail(): Promise<string> {
  const jetzt = new Date().toISOString();
  // Geplante Mails (und solche, deren Rückgängig-Frist ohne Browser abgelaufen ist)
  const { data: faellig } = await db().from("mails").select("id").eq("versand", "geplant").lte("senden_am", jetzt).limit(50);
  let gesendet = 0;
  for (const m of faellig ?? []) if ((await versenden(m.id as string)) === "gesendet") gesendet++;
  // Hängt eine Mail länger als 10 Minuten in „laeuft“ (Funktion abgebrochen), noch einmal versuchen
  await db().from("mails").update({ versand: "geplant" }).eq("versand", "laeuft").lte("senden_am", new Date(Date.now() - 10 * 60_000).toISOString());

  // „Später erinnern“: wieder oben und ungelesen, Push an das Postfach
  const { data: wach } = await db().from("mails").select("id, postfach, gespraech, betreff, zugewiesen_an").not("erinnern_am", "is", null).lte("erinnern_am", jetzt).limit(100);
  const leute = await personen();
  for (const m of wach ?? []) {
    await db().from("mails").update({ erinnern_am: null, gelesen_am: null, oben_am: jetzt }).eq("id", m.id);
    const ziel = m.postfach ? [m.postfach as string] : m.zugewiesen_an ? [m.zugewiesen_an as string] : (await firmaPersonen()).map((p) => p.id);
    for (const id of ziel) {
      await pushSenden({ profile: [id] }, { titel: "Erinnerung an eine Mail", text: (m.betreff as string) || "(ohne Betreff)", url: mailUrl(leute.find((p) => p.id === id), m.gespraech as string), tag: `mail-${m.gespraech}` });
    }
  }

  // Papierkorb nach 30 Tagen leeren: aus der Ansicht ins Archiv
  const { data: alt } = await db()
    .from("mails")
    .select("id, anhaenge, resend_id, ordner, ordner_vorher")
    .eq("ordner", "papierkorb")
    .is("aufbewahrt_am", null)
    .lte("geloescht_am", new Date(Date.now() - 30 * 864e5).toISOString())
    .limit(200);
  await aufbewahren((alt ?? []) as MailZeile[]);
  // Nach Ablauf der Aufbewahrungsfrist endgültig löschen: Mails von vor dem 1.1. vor sechs Jahren
  const grenze = `${Number(berlinDatum().slice(0, 4)) - AUFBEWAHRUNG_JAHRE}-01-01T00:00:00Z`;
  const { data: abgelaufen } = await db().from("mails").select("id, anhaenge, resend_id").not("aufbewahrt_am", "is", null).lt("erstellt_am", grenze).limit(200);
  await endgueltigLoeschen((abgelaufen ?? []) as MailZeile[]);
  return `${gesendet} gesendet, ${wach?.length ?? 0} erinnert, ${alt?.length ?? 0} aufbewahrt, ${abgelaufen?.length ?? 0} nach Ablauf gelöscht`;
}

// ---------------------------------------------------------------------------
// Anhänge
// ---------------------------------------------------------------------------

/** Kurzlebiger Link zu einem Anhang, nur für jemanden mit Zugriff auf die Mail. */
export async function anhangLink(z: Zugang, mailId: string, nr: number): Promise<string | null> {
  const m = await mailLaden(z, mailId);
  const a = m?.anhaenge[nr];
  if (!a) return null;
  const { data } = await db().storage.from("mail").createSignedUrl(a.pfad, 60, { download: a.name });
  return data?.signedUrl ?? null;
}

/** Anhänge einer Mail für eine Weiterleitung in den Ausgang kopieren (der Entwurf hat dann eigene Dateien). */
export async function anhaengeKopieren(z: Zugang, mailId: string): Promise<Anhang[]> {
  const m = await mailLaden(z, mailId);
  if (!m) throw new Error("Diese Mail gibt es nicht mehr.");
  const ordner = `ausgang/${randomUUID()}`;
  const kopien: Anhang[] = [];
  for (const [i, a] of m.anhaenge.entries()) {
    const pfad = `${ordner}/${i}-${sauber(a.name)}`;
    const { error } = await db().storage.from("mail").copy(a.pfad, pfad);
    if (error) throw new Error(`Der Anhang „${a.name}“ lässt sich nicht übernehmen.`);
    kopien.push({ ...a, pfad });
  }
  return kopien;
}

/** Eine fertige Datei (Beleg als PDF) als Anhang in den Ausgang legen. */
export async function anhangAblegen(name: string, inhalt: Buffer, typ = "application/pdf"): Promise<Anhang> {
  const pfad = `ausgang/${randomUUID()}/${sauber(name)}`;
  const { error } = await db().storage.from("mail").upload(pfad, inhalt, { contentType: typ });
  if (error) throw new Error("Der Anhang ließ sich nicht speichern.");
  return { name, typ, groesse: inhalt.length, pfad };
}

/** Vorschau für die Liste und Suche: Klartext aus dem HTML eines Entwurfs (wird beim Speichern gesetzt). */
export function klartext(html: string): string {
  return htmlAlsText(html);
}
