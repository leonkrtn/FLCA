import "server-only";
import { einstellungen } from "./einstellungen";
import { ENV } from "./env";
import { zustellen } from "./ereignisse";
import { mail } from "./email/vorlagen";
import { monatsexport } from "./rechnung/datev";
import { mailer } from "./services/email";
import { abgleichWennAlt, kalender } from "./services/kalender";
import { db } from "./supabase/admin";
import { erinnerungSenden, TERMIN_FELDER, type Termin } from "./termine";
import { berlinDatum, berlinUhrzeit, plusTage } from "./zeit";

/** Trägt eine erledigte Aufgabe ein. false = gab es schon (dann nichts tun). */
async function einmalig(art: string, bezug: string): Promise<boolean> {
  const { error } = await db().from("automatik_log").insert({ art, bezug });
  return !error;
}

type Bericht = Record<string, number | string>;

/**
 * Ein Takt (alle 10 Minuten aus Supabase pg_cron, einmal täglich zusätzlich aus Vercel Cron). Jede
 * Aufgabe ist idempotent und für sich abgesichert: Scheitert eine, laufen die anderen weiter.
 */
export async function takt(): Promise<Bericht> {
  const bericht: Bericht = {};
  const e = await einstellungen();
  const jetzt = Date.now();
  const schritt = async (name: string, fn: () => Promise<number | string>) => {
    try {
      bericht[name] = await fn();
    } catch (error) {
      console.error(`Takt: ${name} fehlgeschlagen`, error);
      bericht[name] = `Fehler: ${error instanceof Error ? error.message : error}`;
    }
  };

  await schritt("kalender", async () => {
    await abgleichWennAlt(9);
    await kalender().beobachten();
    return "ok";
  });

  await schritt("erinnerungen", async () => {
    if (!e.automatik.erinnerung.aktiv) return 0;
    const { data } = await db()
      .from("termine")
      .select(TERMIN_FELDER)
      .eq("status", "bestaetigt")
      .is("erinnerung_am", null)
      .gte("beginn", new Date(jetzt + 20 * 3600000).toISOString())
      .lte("beginn", new Date(jetzt + 26 * 3600000).toISOString());
    for (const t of (data ?? []) as Termin[]) {
      if (await einmalig("erinnerung", t.id)) await erinnerungSenden(t);
    }
    return data?.length ?? 0;
  });

  await schritt("bewertungen", async () => {
    const b = e.automatik.bewertung;
    if (!b.aktiv || !e.firma.googleBewertungLink) return 0;
    const { data } = await db()
      .from("termine")
      .select(TERMIN_FELDER)
      .eq("status", "erledigt")
      .is("bewertung_am", null)
      .lte("ende", new Date(jetzt - b.stundenNach * 3600000).toISOString())
      .gte("ende", new Date(jetzt - 7 * 86400000).toISOString());
    let gesendet = 0;
    for (const t of (data ?? []) as Termin[]) {
      await db().from("termine").update({ bewertung_am: new Date().toISOString() }).eq("id", t.id);
      if (!t.kunde?.email || !(await einmalig("bewertung", `${t.kunde.id}:${berlinDatum().slice(0, 4)}`))) continue;
      const inhalt = mail(e.firma, {
        ueberschrift: "Danke für Ihren Besuch.",
        bausteine: [
          { art: "absatz", text: `Hallo ${t.kunde.name},\nwir hoffen, mit ${t.leistung_name} ist alles in Ordnung. Wenn Sie zufrieden waren, hilft uns eine kurze Bewertung bei Google sehr. Das dauert eine Minute.` },
          { art: "knopf", text: "Bei Google bewerten", url: e.firma.googleBewertungLink },
          { art: "absatz", text: "Und falls etwas nicht gepasst hat: Antworten Sie einfach auf diese Mail, dann kümmern wir uns." },
        ],
      });
      await mailer().senden({ an: t.kunde.email, betreff: `Wie war's bei ${e.firma.name}?`, antwortAn: e.firma.email, ...inhalt });
      gesendet++;
    }
    return gesendet;
  });

  await schritt("webhooks", () => zustellen(50));

  // Einmal am Tag, ab 6 Uhr Berliner Zeit
  const heute = berlinDatum();
  if (berlinUhrzeit(new Date()) >= "06:00" && (await einmalig("taeglich", heute))) {
    await schritt("saison", async () => {
      const s = e.automatik.saison;
      if (!s.aktiv || !e.module.einlagerung) return 0;
      const jahr = heute.slice(0, 4);
      const faellig = (["fruehjahr", "herbst"] as const).find((k) => {
        const start = `${jahr}-${s[k]}`;
        return heute >= start && heute <= plusTage(start, 3);
      });
      if (!faellig) return 0;
      const { data } = await db().from("einlagerungen").select("saison, kunde:kunden(id, name, email), fahrzeug:fahrzeuge(kennzeichen)").is("ausgelagert_am", null);
      let gesendet = 0;
      for (const z of (data ?? []) as unknown as { saison: string; kunde: { id: string; name: string; email: string } | null; fahrzeug: { kennzeichen: string } | null }[]) {
        if (!z.kunde?.email || !(await einmalig("saison", `${jahr}-${faellig}:${z.kunde.id}`))) continue;
        const raeder = z.saison === "winter" ? "Winterräder" : z.saison === "sommer" ? "Sommerräder" : "Räder";
        const inhalt = mail(e.firma, {
          ueberschrift: faellig === "herbst" ? "Zeit für die Winterreifen." : "Zeit für die Sommerreifen.",
          bausteine: [
            { art: "absatz", text: `Hallo ${z.kunde.name},\nIhre ${raeder}${z.fahrzeug ? ` für ${z.fahrzeug.kennzeichen}` : ""} liegen bei uns bereit. Suchen Sie sich einen freien Termin aus, der Wechsel dauert rund 30 Minuten.` },
            { art: "knopf", text: "Termin für den Radwechsel wählen", url: `${ENV.siteUrl}/termin?leistung=radwechsel` },
          ],
        });
        await mailer().senden({ an: z.kunde.email, betreff: `Radwechsel bei ${e.firma.name}`, antwortAn: e.firma.email, ...inhalt });
        gesendet++;
      }
      return gesendet;
    });

    await schritt("datev", async () => {
      const d = e.automatik.datev;
      if (!d.aktiv || !d.email || heute.slice(8) !== "01") return "nicht fällig";
      const vormonat = plusTage(heute, -1).slice(0, 7);
      if (!(await einmalig("datev", vormonat))) return "schon gesendet";
      const { zip, anzahl } = await monatsexport(vormonat, d);
      const inhalt = mail(e.firma, {
        ueberschrift: `Rechnungen ${vormonat.slice(5)}/${vormonat.slice(0, 4)}`,
        bausteine: [{ art: "absatz", text: `Guten Tag,\nanbei der DATEV-Buchungsstapel und ${anzahl} Rechnungen von ${e.firma.name} für ${vormonat.slice(5)}/${vormonat.slice(0, 4)}.` }],
      });
      const r = await mailer().senden({ an: d.email, betreff: `${e.firma.name}: Rechnungen ${vormonat}`, antwortAn: e.firma.email, ...inhalt, anhaenge: [{ dateiname: `${e.firma.name.replace(/\W+/g, "-")}-${vormonat}.zip`, inhalt: zip, typ: "application/zip" }] });
      return r.ok ? `${anzahl} Rechnungen gesendet` : `nicht gesendet: ${r.fehler}`;
    });

    await schritt("aufraeumen", async () => {
      const tag = new Date(jetzt - 86400000).toISOString();
      const halbesJahr = new Date(jetzt - 183 * 86400000).toISOString();
      await db().from("formular_versuche").delete().lt("erstellt_am", tag);
      // Bewerbungen 6 Monate nach Zusage/Absage löschen, samt Lebenslauf
      const { data: alt } = await db().from("bewerbungen").select("id, lebenslauf_pfad").lt("abgeschlossen_am", halbesJahr);
      const dateien = (alt ?? []).map((b) => b.lebenslauf_pfad).filter(Boolean) as string[];
      if (dateien.length) await db().storage.from("bewerbungen").remove(dateien);
      if (alt?.length) await db().from("bewerbungen").delete().in("id", alt.map((b) => b.id));
      await db().from("webhook_zustellungen").delete().eq("status", "ok").lt("aktualisiert_am", new Date(jetzt - 30 * 86400000).toISOString());
      await db().from("ereignisse").delete().lt("erstellt_am", halbesJahr);
      return `${alt?.length ?? 0} Bewerbungen gelöscht`;
    });
  }
  return bericht;
}

