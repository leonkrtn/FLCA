import "server-only";
import { randomUUID } from "node:crypto";
import { alleFrueherenRechnungen } from "../altbestand/daten";
import { alleAngebote, laufendeAngebote } from "../angebote/daten";
import { archivLaden } from "../archiv";
import { auftragDateiname, auftragLaden, auftragPdf } from "../auftrag";
import type { Benutzer } from "../auth";
import { letzteAblehnung, letzterTakt, taktLaeuft } from "../automatik";
import { einstellungen } from "../einstellungen";
import { mail } from "../email/vorlagen";
import { KONFIGURIERT } from "../env";
import { zustellen } from "../ereignisse";
import { fehlerMelden } from "../fehler";
import { protokollLaden } from "../fehlerprotokoll";
import { bewertungen, oeffentlicheLeistungen, stellen } from "../inhalte";
import { fahrzeugTypen, kundeLaden, kundenSuchen } from "../kunden";
import { geraeteLaden } from "../kundenbildschirm/daten";
import { einrichtungPruefen } from "../mail/einrichtung";
import { listeLaden, ungelesen, zugang } from "../mail/postfach";
import { belegungenMitPerson, planPersonen, urlaubKonten } from "../mitarbeiter";
import { faelligeAnzahl, notizenLaden } from "../notizen";
import { kvDateiname, kvLaden, kvPdf } from "../rechnung/kostenvoranschlaege";
import { bezeichnungen, paketeListe } from "../rechnung/preisgedaechtnis";
import { bezuegeLaden, dateiname, pdfErzeugen, preislisteFuerBelege, rechnungLaden } from "../rechnung/rechnungen";
import type { Rolle } from "../rollen";
import { schulungLaden } from "../schulung/daten";
import { mailer, resendPruefen, standardAbsender } from "../services/email";
import { pushSenden } from "../services/push";
import { imTestmodus } from "../services/testmodus";
import { sprachGrundlagen } from "../sprache/daten";
import { db, DbFehler, dbRoh } from "../supabase/admin";
import { terminZusatz } from "../termin-daten";
import { auftraegeOhneTermin, freieTermine, leistungen, terminLaden } from "../termine";
import { offeneMeldungen } from "../werkstatt";
import { berlinDatum, berlinUhrzeit, plusTage } from "../zeit";
import { type Pruefung, pruefen, pushText, Warnung, zaehlen } from "./regeln";

/**
 * Systemcheck (Einstellungen → Fehler, jede Nacht aus dem Takt): viele kleine Einzelprüfungen, jede Grün, Gelb
 * oder Rot mit Meldung. Es bleibt nichts zurück und es geht nichts nach außen:
 * - Lesen: die Ladefunktionen der App laufen einmal echt (nur lesend).
 * - Schreiben: Datenbankfunktion `systemcheck()` legt an, ändert, löscht und nimmt am Ende alles zurück.
 * - Belege und Versand: PDFs werden erzeugt, Mail, Push und Webhooks laufen im Testmodus (`imTestmodus`).
 * - Dienste nur lesend (Resend-Domain, MX), Speicher mit Testdatei, die sofort wieder gelöscht wird.
 * Rot landet im Fehlerprotokoll.
 */

type Eintrag = Pruefung & { ursache?: unknown };

/** Rot, aber schon im Fehlerprotokoll (z. B. Fehler aus dem Takt): nicht noch einmal melden. */
class SchonGemeldet extends Error {}

const anzahl = (n: number, eins: string, mehr: string) => `${n} ${n === 1 ? eins : mehr}`;

/** Die neueste ID einer Tabelle, damit Ladefunktionen für einen einzelnen Datensatz etwas zu laden haben. */
async function neueste(tabelle: string, nichtLeer?: string): Promise<string | null> {
  let q = db().from(tabelle).select("id");
  if (nichtLeer) q = q.not(nichtLeer, "is", null);
  const { data } = await q.order("erstellt_am", { ascending: false }).limit(1);
  return (data?.[0]?.id as string | undefined) ?? null;
}

/** Wer die Ansichten „sieht“: beim Knopf die Person selbst, nachts der Inhaber. */
async function pruefPerson(b?: Benutzer): Promise<Benutzer | null> {
  if (b) return b;
  const { data } = await db().from("profile").select("id, name, email, rolle, aktiv, zeiterfassung").eq("rolle", "inhaber").eq("aktiv", true).limit(1);
  const p = data?.[0];
  if (!p) return null;
  return { id: p.id, name: p.name ?? "", email: p.email ?? "", rolle: p.rolle as Rolle, aktiv: true, zeiterfassung: Boolean(p.zeiterfassung) };
}

function lesen(b: Benutzer | null): Promise<Eintrag>[] {
  const g = "Lesen";
  const heute = berlinDatum();
  const liste = async (fn: () => Promise<unknown[]>) => anzahl((await fn()).length, "Eintrag", "Einträge");
  const einzeln = async (tabelle: string, laden: (id: string) => Promise<unknown>, nichtLeer?: string) => {
    const id = await neueste(tabelle, nichtLeer);
    if (!id) return "Noch kein Eintrag zum Laden.";
    if (!(await laden(id))) throw new Error(`Eintrag ${id} ließ sich nicht laden.`);
    return "Neuester Eintrag geladen.";
  };
  const mitPerson = async (fn: (b: Benutzer) => Promise<string>) => {
    if (!b) throw new Warnung("Kein aktiver Inhaber gefunden, für den die Ansicht geladen werden könnte.");
    return fn(b);
  };
  return [
    pruefen(g, "Einstellungen", async () => void (await einstellungen())),
    pruefen(g, "Preisliste", () => liste(() => leistungen(false))),
    pruefen(g, "Website: Leistungen, Bewertungen, Stellen", async () => {
      const [l, bw, s] = await Promise.all([oeffentlicheLeistungen(), bewertungen(), stellen()]);
      return `${l.length} Leistungen, ${bw.length} Bewertungen, ${s.length} Stellen`;
    }),
    pruefen(g, "Kundensuche", () => liste(() => kundenSuchen("a"))),
    pruefen(g, "Kunde", () => einzeln("kunden", kundeLaden)),
    pruefen(g, "Fahrzeugtypen", async () => void (await fahrzeugTypen())),
    pruefen(g, "Termin mit Auftrag und Zusatzdaten", () =>
      einzeln("termine", async (id) => (await terminLaden(id)) && (await auftragLaden(id)) && (await terminZusatz(id)), "beginn"),
    ),
    pruefen(g, "Aufträge ohne Termin", () => liste(auftraegeOhneTermin)),
    pruefen(g, "Freie Termine (7 Tage)", async () => {
      const tage = await freieTermine({ dauer_min: 60 }, heute, 7);
      return `${tage.reduce((s, t) => s + t.slots.length, 0)} freie Zeiten`;
    }),
    pruefen(g, "Mitarbeiterplanung", async () => {
      const [personen, belegt, urlaub] = await Promise.all([
        planPersonen(heute, plusTage(heute, 7)),
        belegungenMitPerson(new Date(), new Date(Date.now() + 7 * 86_400_000)),
        urlaubKonten(heute.slice(0, 4)),
      ]);
      return `${personen.length} planbar, ${belegt.length} Belegungen, ${urlaub.size} Urlaubskonten`;
    }),
    pruefen(g, "Werkstatt: offene Meldungen", () => liste(offeneMeldungen)),
    pruefen(g, "Rechnung mit Bezügen", () =>
      einzeln("rechnungen", async (id) => {
        const r = await rechnungLaden(id);
        return r && (await bezuegeLaden(r));
      }),
    ),
    pruefen(g, "Kostenvoranschlag", () => einzeln("kostenvoranschlaege", kvLaden)),
    pruefen(g, "Preisliste für Belege und gemerkte Preise", async () => {
      const [p, pk, bz] = await Promise.all([preislisteFuerBelege(), paketeListe(), bezeichnungen()]);
      return `${p.length} Positionen, ${pk.length} Pakete, ${bz.length} Bezeichnungen`;
    }),
    pruefen(g, "Frühere Rechnungen", () => liste(alleFrueherenRechnungen)),
    pruefen(g, "Angebote", async () => {
      const [{ angebote, unmigriert }, laufend] = await Promise.all([alleAngebote(), laufendeAngebote()]);
      if (unmigriert) throw new Warnung("Migration für Angebote fehlt.");
      return `${angebote.length} Angebote, ${laufend.length} laufend`;
    }),
    pruefen(g, "Schulung", async () => {
      const s = await schulungLaden();
      if (s.unmigriert) throw new Warnung("Migration für die Schulung fehlt.");
      return anzahl(s.lektionen.length, "Lektion", "Lektionen");
    }),
    pruefen(g, "Kundenbildschirme", () => liste(geraeteLaden)),
    pruefen(g, "Sprache: Begriffe", async () => void (await sprachGrundlagen())),
    pruefen(g, "Notizen", () => mitPerson(async (p) => `${anzahl((await notizenLaden(p)).length, "offene Notiz", "offene Notizen")}, ${await faelligeAnzahl(p)} fällig`)),
    pruefen(g, "Postfach", () =>
      mitPerson(async (p) => {
        const z = await zugang(p);
        const [eigene, firma, zahl] = await Promise.all([
          listeLaden(z, { postfach: "ich", ansicht: "eingang" }),
          listeLaden(z, { postfach: "firma", ansicht: "eingang" }),
          ungelesen(z),
        ]);
        return `${eigene.length + firma.length} Mails im Eingang, ${zahl.gesamt} ungelesen`;
      }),
    ),
    pruefen(g, "Archiv", () =>
      mitPerson(async (p) => {
        const a = await archivLaden(p);
        return `${a.kvs.length} KV, ${a.auftraege.length} Aufträge, ${a.mails.length} Mails`;
      }),
    ),
    pruefen(g, "Fehlerprotokoll", async () => {
      const { eintraege, unmigriert } = await protokollLaden(false);
      if (unmigriert) throw new Warnung("Migration für das Fehlerprotokoll fehlt: Rote Prüfungen landen nur im Server-Log.");
      return anzahl(eintraege.length, "offener Fehler", "offene Fehler");
    }),
  ];
}

/** Ein Eintrag je Schritt der Datenbankfunktion; der erste rote bricht ab, alles ist danach zurückgenommen. */
async function schreiben(): Promise<Eintrag[]> {
  const start = Date.now();
  const { data, error } = await dbRoh().rpc("systemcheck");
  if (error) {
    const ursache = new DbFehler(error, { funktion: "systemcheck" });
    return [{ gruppe: "Schreiben", name: "Datenbankfunktion systemcheck()", stand: "fehler", text: ursache.message, ms: Date.now() - start, ursache }];
  }
  const schritte = (data ?? []) as { schritt: string; ok: boolean; text: string; code: string | null; ms: number }[];
  const liste: Eintrag[] = schritte.map((s) => ({
    gruppe: "Schreiben",
    name: s.schritt,
    stand: s.ok ? "ok" : "fehler",
    text: s.ok ? s.text : `${s.text} Die übrigen Schritte wurden nicht mehr geprüft.`,
    ms: s.ms,
    ursache: s.ok ? undefined : { message: s.text, code: s.code },
  }));
  if (liste.every((s) => s.stand === "ok")) {
    liste.push({ gruppe: "Schreiben", name: "Alles zurückgenommen", stand: "ok", text: "Testdaten per Rollback entfernt, Nummernkreise unverändert.", ms: 0 });
  }
  return liste;
}

type Pdf = { dateiname: string; inhalt: Buffer; typ: string };

/** Belege als PDF aus dem neuesten Datensatz. Die Rechnung (falls da) hängt danach an der Probe-Mail. */
async function belege(): Promise<{ eintraege: Eintrag[]; anhang: Pdf | null }> {
  const g = "Belege";
  let anhang: Pdf | null = null;
  const pdf = (b: Buffer) => {
    if (b.subarray(0, 5).toString("latin1") !== "%PDF-") throw new Error("Das Ergebnis ist kein PDF.");
    return `${Math.round(b.length / 1024)} KB`;
  };
  const eintraege = await Promise.all([
    pruefen(g, "Rechnung als PDF mit E-Rechnung", async () => {
      const id = await neueste("rechnungen", "nummer");
      if (!id) return "Noch keine gestellte Rechnung.";
      const r = await rechnungLaden(id);
      if (!r) throw new Error("Rechnung ließ sich nicht laden.");
      const inhalt = await pdfErzeugen(r);
      anhang = { dateiname: dateiname(r), inhalt, typ: "application/pdf" };
      return `${r.nummer}: ${pdf(inhalt)}`;
    }),
    pruefen(g, "Kostenvoranschlag als PDF", async () => {
      const id = await neueste("kostenvoranschlaege", "nummer");
      if (!id) return "Noch kein abgeschlossener Kostenvoranschlag.";
      const k = await kvLaden(id);
      if (!k) throw new Error("Kostenvoranschlag ließ sich nicht laden.");
      return `${kvDateiname(k)}: ${pdf(await kvPdf(k))}`;
    }),
    pruefen(g, "Werkstattauftrag als PDF", async () => {
      const id = await neueste("termine", "auftrag_nummer");
      if (!id) return "Noch kein Werkstattauftrag.";
      const t = await auftragLaden(id);
      if (!t) throw new Error("Auftrag ließ sich nicht laden.");
      return `${auftragDateiname(t)}: ${pdf(await auftragPdf(t))}`;
    }),
  ]);
  return { eintraege, anhang };
}

/** Mail, Push und Webhooks über die echten Sendewege, aber im Testmodus: Es geht nichts raus. */
function versand(anhang: Pdf | null): Promise<Eintrag>[] {
  const g = "Versand (Testmodus)";
  const ergebnis = (v: { an: string[]; text: string; fehler: string[] } | undefined, leer: string) => {
    if (!v) throw new Error(leer);
    if (v.fehler.length) throw new Error(v.fehler.join(" "));
    return v;
  };
  return [
    pruefen(g, "E-Mail", async () => {
      const { firma } = await einstellungen();
      const an = firma.email || (await standardAbsender()).adresse;
      const inhalt = mail(firma, {
        bausteine: [{ art: "absatz", text: "Probe des Systemchecks. Diese Mail wird nicht gesendet." }],
      });
      const { versuche } = await imTestmodus(() => mailer().senden({ an, betreff: `${firma.name}: Systemcheck`, ...inhalt, anhaenge: anhang ? [anhang] : undefined }));
      const v = ergebnis(versuche[0], "Der Mailversand hat nichts aufgezeichnet.");
      return `Würde senden an ${v.an.join(", ")}: ${v.text}`;
    }),
    pruefen(g, "Push an den Inhaber", async () => {
      if (!KONFIGURIERT.push) throw new Warnung("Push ist nicht eingerichtet (VAPID-Schlüssel fehlen in Vercel).");
      const { versuche } = await imTestmodus(() =>
        pushSenden({ rollen: ["inhaber"] }, { titel: "Systemcheck", text: "Probe", url: "/admin/einstellungen?bereich=fehler", tag: "systemcheck" }),
      );
      const v = ergebnis(versuche[0], "Der Push-Versand hat nichts aufgezeichnet.");
      // Ohne Gerät käme auch die Nachricht über einen roten Nachtlauf nicht an
      if (!v.an.length) throw new Warnung("Kein Gerät des Inhabers für Push angemeldet. Die Nachricht bei rotem Nachtlauf käme nicht an.");
      return `Würde an ${anzahl(v.an.length, "Gerät", "Geräte")} senden.`;
    }),
    pruefen(g, "Webhooks", async () => {
      const { versuche } = await imTestmodus(() => zustellen());
      const kaputt = versuche.filter((v) => v.fehler.length);
      if (kaputt.length) throw new Error(kaputt.map((v) => `${v.text}: ${v.fehler.join(" ")}`).join(" · "));
      return versuche.length ? `Würde an ${anzahl(versuche.length, "Webhook", "Webhooks")} senden: ${versuche.map((v) => v.text).join(", ")}` : "Keine Webhooks eingerichtet.";
    }),
  ];
}

function dienste(): Promise<Eintrag>[] {
  const g = "Dienste";
  // Einmal für beide Prüfungen laden, aber erst, wenn Mail eingerichtet ist (sonst gibt es nichts zu prüfen)
  let einrichtung: ReturnType<typeof einrichtungPruefen> | null = null;
  const ausEinrichtung = (name: string) =>
    pruefen(g, name, async () => {
      if (!KONFIGURIERT.email) throw new Warnung("E-Mail ist nicht eingerichtet.");
      const p = (await (einrichtung ??= einrichtungPruefen())).find((x) => x.name === name);
      if (!p) throw new Warnung("Nicht prüfbar (keine Domain in MAIL_FROM).");
      if (p.ok === false) throw new Error(p.text);
      if (p.ok === null) throw new Warnung(p.text);
      return p.text;
    });
  return [
    pruefen(g, "Supabase-Zugang", async () => {
      if (!KONFIGURIERT.supabaseAdmin) throw new Error("NEXT_PUBLIC_SUPABASE_URL oder SUPABASE_SECRET_KEY fehlt in Vercel.");
      return "Schlüssel gesetzt, Abfragen laufen (siehe Lesen).";
    }),
    pruefen(g, "Resend (nur lesend)", resendPruefen),
    ausEinrichtung("MX-Eintrag"),
    ausEinrichtung("Webhook"),
    pruefen(g, "Push-Schlüssel", async () => {
      if (!KONFIGURIERT.push) throw new Warnung("Push ist nicht eingerichtet (VAPID-Schlüssel fehlen in Vercel).");
      return "VAPID-Schlüssel gesetzt (Gültigkeit prüft der Versand).";
    }),
    pruefen(g, "Zeitsteuerung (CRON_SECRET)", async () => {
      if (!KONFIGURIERT.cron) throw new Error("CRON_SECRET fehlt in Vercel: Der Takt kann nicht laufen.");
      return "Gesetzt.";
    }),
  ];
}

function automatik(): Promise<Eintrag>[] {
  const g = "Automatik";
  return [
    pruefen(g, "Takt läuft", async () => {
      const zuletzt = await letzterTakt();
      if (!zuletzt) throw new Error("Der Takt lief noch nie: Die Zeitsteuerung ist nicht eingerichtet.");
      const vor = Math.round((Date.now() - zuletzt.getTime()) / 60000);
      if (!taktLaeuft(zuletzt, Date.now())) throw new Error(`Der Takt lief zuletzt vor ${anzahl(vor, "Minute", "Minuten")} (sollte jede Minute laufen).`);
      return vor < 1 ? "Zuletzt vor weniger als einer Minute." : `Zuletzt vor ${anzahl(vor, "Minute", "Minuten")}.`;
    }),
    pruefen(g, "Aufrufe abgelehnt", async () => {
      const abgelehnt = await letzteAblehnung();
      if (abgelehnt && Date.now() - abgelehnt.getTime() < 86_400_000) throw new Warnung("In den letzten 24 Stunden wurde ein Aufruf der Zeitsteuerung abgelehnt (CRON_SECRET passt nicht).");
      return "Keine in den letzten 24 Stunden.";
    }),
    pruefen(g, "Tägliche Aufgaben", async () => {
      // Laufen ab 6 Uhr: davor zählt der Vortag
      const tag = berlinUhrzeit(new Date()) >= "06:30" ? berlinDatum() : plusTage(berlinDatum(), -1);
      const { data } = await db().from("automatik_log").select("erstellt_am").eq("art", "taeglich").eq("bezug", tag).maybeSingle();
      if (!data) throw new Error(`Die täglichen Aufgaben (Saison, DATEV, Aufräumen) liefen am ${tag} nicht.`);
      return `Am ${tag} gelaufen.`;
    }),
    pruefen(g, "Fehler im Takt (24 Stunden)", async () => {
      const { data, error } = await dbRoh()
        .from("fehlerprotokoll")
        .select("ort, anzahl")
        .is("erledigt_am", null)
        .ilike("ort", "Takt:%")
        .gte("zuletzt_am", new Date(Date.now() - 86_400_000).toISOString());
      if (error) throw new Warnung("Fehlerprotokoll nicht lesbar (Migration fehlt?).");
      if (data?.length) throw new SchonGemeldet(`Mit Fehler beendet: ${data.map((f) => `${String(f.ort).replace(/^Takt:\s*/, "")} (${f.anzahl}-mal)`).join(", ")}. Details stehen unten im Protokoll.`);
      return "Keine.";
    }),
    pruefen(g, "Webhook-Zustellungen", async () => {
      const woche = new Date(Date.now() - 7 * 86_400_000).toISOString();
      const [{ count: gescheitert }, { count: wiederholt }] = await Promise.all([
        db().from("webhook_zustellungen").select("id", { count: "exact", head: true }).eq("status", "fehler").gte("aktualisiert_am", woche),
        db().from("webhook_zustellungen").select("id", { count: "exact", head: true }).eq("status", "offen").gte("versuche", 3),
      ]);
      if (gescheitert) throw new Warnung(`${anzahl(gescheitert, "Zustellung", "Zustellungen")} in den letzten 7 Tagen endgültig gescheitert.`);
      if (wiederholt) throw new Warnung(`${anzahl(wiederholt, "Zustellung wird", "Zustellungen werden")} schon mehrfach wiederholt.`);
      return "Keine Probleme.";
    }),
  ];
}

/** Winziges, gültiges PNG (1 × 1) und PDF: Die Buckets nehmen nur ihre Dateitypen an. */
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", "base64");
const PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");
const BUCKETS: { name: string; datei: Buffer; typ: string; endung: string }[] = [
  { name: "archiv", datei: PDF, typ: "application/pdf", endung: "pdf" },
  { name: "mail", datei: PDF, typ: "application/pdf", endung: "pdf" },
  { name: "auftragsfotos", datei: PNG, typ: "image/png", endung: "png" },
  { name: "bewerbungen", datei: PDF, typ: "application/pdf", endung: "pdf" },
  { name: "schulung", datei: PNG, typ: "image/png", endung: "png" },
  { name: "website", datei: PNG, typ: "image/png", endung: "png" },
];

function speicher(): Promise<Eintrag>[] {
  return BUCKETS.map((b) =>
    pruefen("Speicher", `Ablage „${b.name}“`, async () => {
      const pfad = `systemcheck/${randomUUID()}.${b.endung}`;
      const ablage = dbRoh().storage.from(b.name);
      const hoch = await ablage.upload(pfad, b.datei, { contentType: b.typ });
      if (hoch.error) throw new Error(`Hochladen gescheitert: ${hoch.error.message}`);
      const weg = await ablage.remove([pfad]);
      if (weg.error) throw new Error(`Hochgeladen, aber Löschen gescheitert (${pfad} liegt noch dort): ${weg.error.message}`);
      return "Testdatei hochgeladen und gelöscht.";
    }),
  );
}

export type Lauf = { id: number; gestartet_am: string; dauer_ms: number; ausgeloest: "knopf" | "nacht"; rot: number; gelb: number; pruefungen: Pruefung[] };

/** Führt alle Prüfungen aus, speichert das Ergebnis und meldet Rotes ins Fehlerprotokoll. */
export async function systemcheck(o: { ausloeser: "knopf" | "nacht"; benutzer?: Benutzer }): Promise<Pruefung[]> {
  const start = Date.now();
  const gestartet = new Date().toISOString();
  const person = await pruefPerson(o.benutzer).catch(() => null);
  // Gruppen nacheinander (die Schreibprobe hält kurz die Terminsperre), Prüfungen einer Gruppe gleichzeitig
  const ergebnisse: Eintrag[] = [];
  ergebnisse.push(...(await Promise.all(dienste())));
  ergebnisse.push(...(await Promise.all(lesen(person))));
  ergebnisse.push(...(await schreiben()));
  const b = await belege();
  ergebnisse.push(...b.eintraege);
  ergebnisse.push(...(await Promise.all(versand(b.anhang))));
  ergebnisse.push(...(await Promise.all(automatik())));
  ergebnisse.push(...(await Promise.all(speicher())));

  await Promise.all(
    ergebnisse
      .filter((p) => p.stand === "fehler" && !(p.ursache instanceof SchonGemeldet))
      .map((p) => fehlerMelden(p.ursache ?? new Error(p.text), `Systemcheck: ${p.gruppe} · ${p.name}`)),
  );

  const pruefungen: Pruefung[] = ergebnisse.map(({ gruppe, name, stand, text, ms }) => ({ gruppe, name, stand, text, ms }));
  const { rot, gelb } = zaehlen(pruefungen);
  // Ohne Migration gibt es die Tabelle nicht: Das zeigt schon die Schreibprobe, hier nichts weiter tun.
  const { error } = await dbRoh()
    .from("systemcheck_laeufe")
    .insert({ gestartet_am: gestartet, dauer_ms: Date.now() - start, ausgeloest: o.ausloeser, von: o.benutzer?.id ?? null, rot, gelb, pruefungen });
  if (!error) await dbRoh().from("systemcheck_laeufe").delete().lt("gestartet_am", new Date(Date.now() - 30 * 86_400_000).toISOString());
  return pruefungen;
}

/** Nachtlauf aus dem Takt: Bei Rot bekommt der Inhaber einen Push, sonst bleibt es still. */
export async function nachtlauf(): Promise<string> {
  const pruefungen = await systemcheck({ ausloeser: "nacht" });
  const { rot, gelb } = zaehlen(pruefungen);
  if (rot) {
    await pushSenden(
      { rollen: ["inhaber"] },
      { titel: `Systemcheck: ${rot} rot`, text: pushText(pruefungen), url: "/admin/einstellungen?bereich=fehler", tag: "systemcheck" },
    );
  }
  return `${rot} rot, ${gelb} gelb`;
}

/** Die letzten Läufe für Einstellungen → Fehler. Ohne Migration: `unmigriert`. */
export async function laeufeLaden(limit = 1): Promise<{ laeufe: Lauf[]; unmigriert: boolean }> {
  const { data, error } = await dbRoh().from("systemcheck_laeufe").select("*").order("gestartet_am", { ascending: false }).limit(limit);
  if (error && ["42P01", "PGRST205"].includes(error.code)) return { laeufe: [], unmigriert: true };
  if (error) throw new DbFehler(error, { tabelle: "systemcheck_laeufe" });
  return { laeufe: (data ?? []) as Lauf[], unmigriert: false };
}
