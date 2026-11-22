"use server";

import { createHash, randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { benutzerMitRecht } from "../auth";
import { type Einstellungen, einstellungen, einstellungenSpeichern, type Fenster } from "../einstellungen";
import { EREIGNIS_TYPEN, melden, signatur } from "../ereignisse";
import { centAus, type Ergebnis, ja, text, zahl } from "../forms";
import { sicher } from "../sicher";
import { db, DbFehler, dbRoh } from "../supabase/admin";
import { alsErledigt } from "../fehlerprotokoll";
import { berlinDatum } from "../zeit";
import { eingabeFehler, gleich, type Nummernkreis, nummerText } from "../rechnung/nummernkreis";

const alles = () => revalidatePath("/", "layout");

/** So viele Lohnarten bietet das Formular in den Einstellungen an. */
const LOHNARTEN_MAX = 6;

const zahlIn = (fd: FormData, n: string, min: number, max: number, std: number) => Math.min(Math.max(Math.round(zahl(fd, n) ?? std), min), max);

export async function firmaSpeichern(_v: Ergebnis, fd: FormData): Promise<Ergebnis> {
  return sicher(fd, async () => {
    await benutzerMitRecht("einstellungen");
    const { firma } = await einstellungen();
    const neu = Object.fromEntries(Object.keys(firma).map((k) => [k, text(fd, k, 300)])) as Einstellungen["firma"];
    neu.whatsapp = neu.whatsapp.replace(/\D/g, "");
    neu.iban = neu.iban.replace(/\s/g, "").toUpperCase().replace(/(.{4})/g, "$1 ").trim();
    await einstellungenSpeichern("firma", neu);
    alles();
    return { status: "ok", meldung: "Gespeichert." };
  });
}

export async function zeitenSpeichern(_v: Ergebnis, fd: FormData): Promise<Ergebnis> {
  return sicher(fd, async () => {
    await benutzerMitRecht("einstellungen");
    const o = {} as Einstellungen["oeffnungszeiten"];
    for (const t of ["1", "2", "3", "4", "5", "6", "7"] as const) {
      const f: Fenster[] = [];
      for (const n of [1, 2]) {
        const a = text(fd, `t${t}_${n}_von`, 5);
        const b = text(fd, `t${t}_${n}_bis`, 5);
        if (/^\d{2}:\d{2}$/.test(a) && /^\d{2}:\d{2}$/.test(b)) {
          if (b <= a) return { status: "fehler", meldung: "Ein Zeitfenster endet vor seinem Beginn." };
          f.push([a, b]);
        }
      }
      o[t] = f.sort((x, y) => x[0].localeCompare(y[0]));
    }
    await einstellungenSpeichern("oeffnungszeiten", o);
    alles();
    return { status: "ok", meldung: "Öffnungszeiten gespeichert. Freie Termine richten sich sofort danach." };
  });
}

export async function buchungSpeichern(_v: Ergebnis, fd: FormData): Promise<Ergebnis> {
  return sicher(fd, async () => {
    await benutzerMitRecht("einstellungen");
    await einstellungenSpeichern("buchung", {
      aktiv: ja(fd, "aktiv"),
      kapazitaet: zahlIn(fd, "kapazitaet", 1, 20, 2),
      pufferMin: zahlIn(fd, "pufferMin", 0, 120, 15),
      rasterMin: [15, 30, 60].includes(zahl(fd, "rasterMin") ?? 30) ? (zahl(fd, "rasterMin") as number) : 30,
      vorlaufStd: zahlIn(fd, "vorlaufStd", 0, 168, 2),
      maxTage: zahlIn(fd, "maxTage", 1, 365, 42),
      haltenStd: zahlIn(fd, "haltenStd", 1, 168, 48),
      stornoFristStd: zahlIn(fd, "stornoFristStd", 0, 168, 24),
    });
    alles();
    return { status: "ok", meldung: "Gespeichert." };
  });
}

export async function rechnungEinstellungen(_v: Ergebnis, fd: FormData): Promise<Ergebnis> {
  return sicher(fd, async () => {
    await benutzerMitRecht("einstellungen");
    // Leere Zeilen fallen weg; ein Name ohne Preis gilt als 0 €, damit nichts stillschweigend verschwindet.
    const stundensaetze = Array.from({ length: LOHNARTEN_MAX }, (_, i) => ({
      name: text(fd, `lohn_name_${i}`, 40),
      netto_cent: Math.max(0, centAus(fd, `lohn_preis_${i}`) ?? 0),
    })).filter((l, i, alle) => l.name && alle.findIndex((x) => x.name === l.name) === i);
    await einstellungenSpeichern("rechnung", {
      zahlungszielTage: zahlIn(fd, "zahlungszielTage", 0, 90, 14),
      einleitung: text(fd, "einleitung", 500),
      fusstext: text(fd, "fusstext", 500),
      stundensaetze: stundensaetze.length ? stundensaetze : [{ name: "Arbeitslohn", netto_cent: 0 }],
      aufschlagProzent: Math.min(Math.max(zahl(fd, "aufschlagProzent") ?? 30, 0), 1000),
    });
    await einstellungenSpeichern("kostenvoranschlag", {
      gueltigTage: zahlIn(fd, "kv_gueltigTage", 1, 365, 30),
      einleitung: text(fd, "kv_einleitung", 500),
      fusstext: text(fd, "kv_fusstext", 500),
    });
    await einstellungenSpeichern("auftrag", {
      einleitung: text(fd, "wa_einleitung", 500),
      fusstext: text(fd, "wa_fusstext", 800),
    });
    revalidatePath("/admin/einstellungen");
    return { status: "ok", meldung: "Gespeichert." };
  });
}

/**
 * Nummernkreis der Rechnungen. Jederzeit änderbar, nach der ersten Rechnung aber nur mit Bestätigung im
 * Dialog (`bestaetigt`), der die Folgen nennt (siehe `warnungen`). Doppelte Nummern verhindert die
 * Datenbank. Jede Änderung wird als Ereignis mit Person, vorher und nachher festgehalten.
 */
export async function nummernkreisSpeichern(_v: Ergebnis, fd: FormData): Promise<Ergebnis> {
  return sicher(fd, async () => {
    const b = await benutzerMitRecht("einstellungen");
    const neu: Nummernkreis = {
      praefix: text(fd, "praefix", 20),
      mit_jahr: ja(fd, "mit_jahr"),
      stellen: Math.round(zahl(fd, "stellen") ?? 4),
      naechste: Math.round(zahl(fd, "naechste") ?? 0),
    };
    const falsch = eingabeFehler(neu);
    if (falsch) return { status: "fehler", meldung: falsch, fehler: { naechste: falsch } };
    const [{ data: k }, { count }] = await Promise.all([
      db().from("nummernkreise").select("praefix, mit_jahr, stellen, naechste").eq("art", "rechnung").single(),
      db().from("rechnungen").select("id", { count: "exact", head: true }).not("nummer", "is", null),
    ]);
    const alt = { ...(k as Nummernkreis), naechste: Number(k?.naechste ?? 1) };
    if (gleich(alt, neu)) return { status: "ok", meldung: "Unverändert." };
    // Der Dialog setzt das Feld; ohne ihn (anderer Weg, altes Fenster) wird nichts geändert.
    if (fd.get("bestaetigt") !== "1") return { status: "fehler", meldung: "Bitte die Änderung im Dialog bestätigen." };

    const { error } = await dbRoh().rpc("nummernkreis_einstellen", { p_praefix: neu.praefix, p_mit_jahr: neu.mit_jahr, p_stellen: neu.stellen, p_naechste: neu.naechste });
    if (error) {
      const frei = error.message.match(/NUMMER_VERGEBEN:(\d+)/)?.[1];
      if (frei) return { status: "fehler", meldung: `Nicht gespeichert: Ab ${neu.naechste} ist im gleichen Format schon eine Nummer vergeben. Die nächste freie ist ${frei}.`, fehler: { naechste: `ab ${frei}` } };
      if (error.message.includes("ZU_WENIG_STELLEN")) return { status: "fehler", meldung: "Die Nummer hat mehr Ziffern als Stellen eingestellt sind." };
      if (error.message.includes("GESPERRT")) return { status: "fehler", meldung: "Die Datenbank sperrt den Nummernkreis noch. Bitte die Migration 20261125110000_nummernkreis_aendern.sql im SQL-Editor von Supabase ausführen." };
      throw new DbFehler(error, { funktion: "nummernkreis_einstellen" });
    }
    await melden("nummernkreis.geaendert", { art: "rechnung", vorher: alt, nachher: neu, gestellte_rechnungen: count ?? 0, von: { id: b.id, name: b.name } });
    revalidatePath("/admin/einstellungen");
    return { status: "ok", meldung: `Gespeichert. Die nächste Rechnung bekommt die Nummer ${nummerText(neu, Number(berlinDatum().slice(0, 4)))}.` };
  });
}

export async function benachrichtigungSpeichern(_v: Ergebnis, fd: FormData): Promise<Ergebnis> {
  return sicher(fd, async () => {
    await benutzerMitRecht("einstellungen");
    const emails = text(fd, "emails", 1000).split(/[\s,;]+/).map((e) => e.trim().toLowerCase()).filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)).slice(0, 10);
    await einstellungenSpeichern("benachrichtigung", { emails });
    return { status: "ok", meldung: "Gespeichert." };
  });
}

export async function automatikSpeichern(_v: Ergebnis, fd: FormData): Promise<Ergebnis> {
  return sicher(fd, async () => {
    await benutzerMitRecht("einstellungen");
    const md = (n: string, std: string) => (/^\d{2}-\d{2}$/.test(text(fd, n, 5)) ? text(fd, n, 5) : std);
    await einstellungenSpeichern("automatik", {
      erinnerung: { aktiv: ja(fd, "erinnerung") },
      bewertung: { aktiv: ja(fd, "bewertung"), stundenNach: zahlIn(fd, "stundenNach", 1, 72, 3) },
      saison: { aktiv: ja(fd, "saison"), fruehjahr: md("fruehjahr", "03-15"), herbst: md("herbst", "10-01") },
      datev: {
        aktiv: ja(fd, "datev"),
        email: text(fd, "datev_email", 160),
        beraterNr: text(fd, "beraterNr", 10),
        mandantNr: text(fd, "mandantNr", 10),
        sachkontenlaenge: zahlIn(fd, "sachkontenlaenge", 4, 8, 4),
        erloeskonto19: text(fd, "erloeskonto19", 10) || "8400",
        kasse: text(fd, "kasse", 10) || "1000",
        bank: text(fd, "bank", 10) || "1200",
        debitorSammel: text(fd, "debitorSammel", 10) || "10000",
      },
    });
    return { status: "ok", meldung: "Gespeichert." };
  });
}

export async function moduleSpeichern(_v: Ergebnis, fd: FormData): Promise<Ergebnis> {
  return sicher(fd, async () => {
    await benutzerMitRecht("einstellungen");
    await einstellungenSpeichern("module", {
      karriere: ja(fd, "karriere"),
      galerie: ja(fd, "galerie"),
      einlagerung: ja(fd, "einlagerung"),
      zeiterfassung: ja(fd, "zeiterfassung"),
      bewertungen: ja(fd, "bewertungen"),
    });
    alles();
    return { status: "ok", meldung: "Gespeichert." };
  });
}

export async function rechtstexteSpeichern(_v: Ergebnis, fd: FormData): Promise<Ergebnis> {
  return sicher(fd, async () => {
    await benutzerMitRecht("einstellungen");
    const url = (n: string) => (text(fd, n, 300).startsWith("https://") ? text(fd, n, 300) : "");
    await einstellungenSpeichern("rechtstexte", {
      datenschutzUrl: url("datenschutzUrl"),
      agbUrl: url("agbUrl"),
      datenschutzText: text(fd, "datenschutzText", 60000),
      agbText: text(fd, "agbText", 60000),
    });
    revalidatePath("/datenschutz");
    revalidatePath("/agb");
    return { status: "ok", meldung: "Gespeichert." };
  });
}

// ---------------------------------------------------------------------------
// Schnittstellen
// ---------------------------------------------------------------------------

export async function webhookAnlegen(_v: Ergebnis, fd: FormData): Promise<Ergebnis> {
  return sicher(fd, async () => {
    await benutzerMitRecht("einstellungen");
    const url = text(fd, "url", 500);
    if (!/^https:\/\/[^\s]+$/.test(url)) return { status: "fehler", meldung: "Die Adresse muss mit https:// beginnen." };
    const typen = fd.getAll("typen").filter((t): t is string => typeof t === "string" && (t === "*" || t in EREIGNIS_TYPEN));
    const { data, error } = await db().from("webhooks").insert({ name: text(fd, "name", 80) || url, url, typen: typen.length ? typen : ["*"] }).select("geheimnis").single();
    if (error) throw new DbFehler(error);
    revalidatePath("/admin/einstellungen");
    return { status: "ok", meldung: `Angelegt. Geheimnis zum Prüfen der Signatur: ${data.geheimnis}` };
  });
}

export async function webhookLoeschen(id: string, _v: Ergebnis): Promise<Ergebnis> {
  return sicher(null, async () => {
    await benutzerMitRecht("einstellungen");
    await db().from("webhooks").delete().eq("id", id);
    revalidatePath("/admin/einstellungen");
    return { status: "ok", meldung: "Gelöscht." };
  });
}

export async function webhookTesten(id: string, _v: Ergebnis): Promise<Ergebnis> {
  return sicher(null, async () => {
    await benutzerMitRecht("einstellungen");
    const { data: h } = await db().from("webhooks").select("url, geheimnis").eq("id", id).single();
    const body = JSON.stringify({ id: 0, typ: "test", zeit: new Date().toISOString(), daten: { nachricht: "Test aus dem FLC-System" } });
    const res = await fetch(h!.url, { method: "POST", headers: { "content-type": "application/json", "x-flc-ereignis": "test", "x-flc-signatur": signatur(h!.geheimnis, body) }, body, signal: AbortSignal.timeout(8000) }).catch((e: Error) => e);
    return res instanceof Error ? { status: "fehler", meldung: `Nicht erreichbar: ${res.message}` } : { status: res.ok ? "ok" : "fehler", meldung: `Antwort: HTTP ${res.status}` };
  });
}

export async function apiSchluesselAnlegen(_v: Ergebnis, fd: FormData): Promise<Ergebnis> {
  return sicher(fd, async () => {
    await benutzerMitRecht("einstellungen");
    const schluessel = `flc_${randomBytes(24).toString("hex")}`;
    const rechte = ja(fd, "schreiben") ? ["lesen", "schreiben"] : ["lesen"];
    await db().from("api_schluessel").insert({ name: text(fd, "name", 80) || "Ohne Namen", praefix: schluessel.slice(0, 10), hash: createHash("sha256").update(schluessel).digest("hex"), rechte });
    revalidatePath("/admin/einstellungen");
    return { status: "ok", meldung: `Schlüssel (wird nur jetzt angezeigt): ${schluessel}` };
  });
}

export async function apiSchluesselWiderrufen(id: string, _v: Ergebnis): Promise<Ergebnis> {
  return sicher(null, async () => {
    await benutzerMitRecht("einstellungen");
    await db().from("api_schluessel").update({ widerrufen_am: new Date().toISOString() }).eq("id", id);
    revalidatePath("/admin/einstellungen");
    return { status: "ok", meldung: "Widerrufen." };
  });
}

/** Fehler im Protokoll als erledigt markieren (`id` null = alle offenen). Tritt er wieder auf, ist er wieder offen. */
export async function fehlerErledigt(id: number | null, _v: Ergebnis): Promise<Ergebnis> {
  return sicher(null, async () => {
    await benutzerMitRecht("einstellungen");
    await alsErledigt(id);
    revalidatePath("/admin", "layout");
    return { status: "ok", meldung: id === null ? "Alle als erledigt markiert." : "Erledigt." };
  });
}
