"use server";

import { revalidatePath } from "next/cache";
import { benutzerMitRecht } from "../auth";
import { weich } from "../fehler";
import { type Ergebnis, istEmail, istTelefon, ja, text, werteAus, zahl } from "../forms";
import {
  amBildschirmUnterschreiben,
  auftragSchicken,
  BildschirmFehler,
  bildschirmAuftrag,
  type BildschirmAuftrag,
  eingabenGesehen,
  type FahrzeugEingabe,
  geraetAnlegen,
  geraetGesehen,
  geraetPerSchluessel,
  geraetPruefen,
  geraetSperren,
  geschicktZuruecknehmen,
  heutigeAuftraege,
  kundenFinden,
  kundeSpeichern,
} from "../kundenbildschirm/daten";
import { type Sprache, spracheAus, type TextSchluessel, tx } from "../kundenbildschirm/texte";
import { imLimit } from "../limit";
import { sicher } from "../sicher";
import { TerminFehler } from "../termine";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Rahmen für die Aktionen des Kundenbildschirms: Meldungen in der Sprache des Bildschirms. Fehler für den Kunden
 * kommen als BildschirmFehler; alles andere landet über sicher() im Fehlerprotokoll und der Kunde sieht nur
 * „hat nicht geklappt, bitte im Büro fragen“.
 */
async function amBildschirm(fd: FormData | null, sprache: Sprache, aktion: () => Promise<Ergebnis>): Promise<Ergebnis> {
  const fehler = (schluessel: TextSchluessel): Ergebnis => ({ status: "fehler", meldung: tx(sprache, schluessel), versuch: Date.now(), daten: { eigen: true } });
  const e = await sicher(
    fd,
    async () => {
      try {
        if ((await imLimit("kundenbildschirm")) === "limit") return fehler("fehlerZuViele");
        return await aktion();
      } catch (error) {
        if (error instanceof BildschirmFehler) return fehler(error.schluessel);
        throw error;
      }
    },
    true,
  );
  if (e.status !== "fehler") return e;
  // Eingaben zurückgeben, damit der Kunde nach einem Hinweis nichts neu tippen muss (ohne das Unterschriftsbild)
  const werte = fd ? Object.fromEntries(Object.entries(werteAus(fd)).filter(([k]) => k !== "bild")) : undefined;
  return { ...e, werte, meldung: e.daten?.eigen ? e.meldung : tx(sprache, "fehlerAllgemein") };
}

/** Bestandskunde über Kennzeichen oder Telefonnummer. */
export async function bildschirmSuchen(schluessel: string, _v: Ergebnis, fd: FormData): Promise<Ergebnis> {
  const sprache = spracheAus(fd.get("sprache"));
  return amBildschirm(fd, sprache, async () => {
    await geraetPruefen(schluessel);
    const q = text(fd, "q", 40);
    const kunden = q ? await kundenFinden(q) : [];
    if (!kunden.length) return { status: "fehler", meldung: tx(sprache, "nichtGefunden"), versuch: Date.now(), daten: { eigen: true } };
    return { status: "ok", daten: { kunden }, versuch: Date.now() };
  });
}

/** Neue Fahrzeuge: bis zu drei Blöcke neu_0 … neu_2; bekannte über fz_ids. */
function fahrzeugeAus(fd: FormData): FahrzeugEingabe[] {
  const km = (name: string) => {
    const n = zahl(fd, name);
    return n === null || n < 0 ? null : Math.min(Math.round(n), 9_999_999);
  };
  const bekannt = fd
    .getAll("fz_ids")
    .filter((id): id is string => typeof id === "string" && UUID.test(id))
    .map((id) => ({ id, kennzeichen: "", marke: text(fd, `fz_${id}_marke`, 60), modell: text(fd, `fz_${id}_modell`, 60), km: km(`fz_${id}_km`) }));
  const neu = [0, 1, 2]
    .map((i) => ({ kennzeichen: text(fd, `neu_${i}_kennzeichen`, 16), marke: text(fd, `neu_${i}_marke`, 60), modell: text(fd, `neu_${i}_modell`, 60), km: km(`neu_${i}_km`) }))
    .filter((f) => f.kennzeichen);
  return [...bekannt, ...neu];
}

/** Daten speichern (neu oder geändert), danach die heutigen Aufträge zum Unterschreiben. */
export async function bildschirmSpeichern(schluessel: string, kundeId: string | null, _v: Ergebnis, fd: FormData): Promise<Ergebnis> {
  const sprache = spracheAus(fd.get("sprache"));
  return amBildschirm(fd, sprache, async () => {
    await geraetPruefen(schluessel);
    if (kundeId && !UUID.test(kundeId)) throw new BildschirmFehler("fehlerAllgemein");
    const fehler = (s: TextSchluessel): Ergebnis => ({ status: "fehler", meldung: tx(sprache, s), versuch: Date.now(), daten: { eigen: true } });
    const eingabe = {
      name: text(fd, "name", 120),
      firma: text(fd, "firma", 120),
      ust_id: text(fd, "ust_id", 20).toUpperCase(),
      telefon: text(fd, "telefon", 40),
      email: text(fd, "email", 160).toLowerCase(),
      strasse: text(fd, "strasse", 120),
      plz: text(fd, "plz", 10),
      ort: text(fd, "ort", 80),
      whatsapp: ja(fd, "whatsapp"),
      erinnerung: ja(fd, "erinnerung"),
      fahrzeuge: fahrzeugeAus(fd),
    };
    if (!eingabe.name) return fehler("fehlerName");
    if (!eingabe.telefon && !eingabe.email) return fehler("fehlerKontakt");
    if (eingabe.email && !istEmail(eingabe.email)) return fehler("fehlerEmail");
    if (eingabe.telefon && !istTelefon(eingabe.telefon)) return fehler("fehlerTelefon");
    if (!ja(fd, "datenschutz")) return fehler("fehlerDatenschutz");
    const id = await kundeSpeichern(kundeId, eingabe);
    const auftraege = await heutigeAuftraege(id);
    revalidatePath("/admin", "layout");
    return { status: "ok", meldung: tx(sprache, "gespeichert"), daten: { kundeId: id, auftraege }, versuch: Date.now() };
  });
}

/** Unterschrift mit der Maus, Name und AGB-Häkchen. */
export async function bildschirmUnterschreiben(schluessel: string, terminId: string, kundeId: string | null, _v: Ergebnis, fd: FormData): Promise<Ergebnis> {
  const sprache = spracheAus(fd.get("sprache"));
  return amBildschirm(fd, sprache, async () => {
    const g = await geraetPruefen(schluessel);
    const fehler = (s: TextSchluessel): Ergebnis => ({ status: "fehler", meldung: tx(sprache, s), versuch: Date.now(), daten: { eigen: true } });
    if (!UUID.test(terminId) || (kundeId && !UUID.test(kundeId))) return fehler("fehlerAuftrag");
    const name = text(fd, "name", 120);
    const bild = text(fd, "bild", 400_000);
    if (!name) return fehler("fehlerName");
    if (!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(bild)) return fehler("fehlerUnterschrift");
    if (!ja(fd, "agb")) return fehler("fehlerAgb");
    await amBildschirmUnterschreiben(g, terminId, kundeId, name, bild);
    revalidatePath("/admin", "layout");
    revalidatePath("/app", "layout");
    return { status: "ok", meldung: tx(sprache, "erteilt"), versuch: Date.now() };
  });
}

/**
 * Fragt der Bildschirm alle paar Sekunden: Ist das Gerät noch freigeschaltet, und hat das Büro einen Auftrag
 * geschickt? Ein kaputter Abruf darf den Bildschirm nicht umwerfen, deshalb weich.
 */
export async function bildschirmStand(schluessel: string): Promise<{ gueltig: boolean; auftrag: BildschirmAuftrag | null; geschickt: string | null }> {
  return weich(
    async () => {
      const g = await geraetPerSchluessel(schluessel);
      if (!g) return { gueltig: false, auftrag: null, geschickt: null };
      await geraetGesehen(g);
      if (!g.termin_id) return { gueltig: true, auftrag: null, geschickt: null };
      const auftrag = await bildschirmAuftrag(g.termin_id);
      // Inzwischen anders erteilt oder abgesagt: nicht mehr anbieten
      if (!auftrag) await geschicktZuruecknehmen(g.id);
      return { gueltig: true, auftrag, geschickt: auftrag ? g.geschickt_am : null };
    },
    { gueltig: true, auftrag: null, geschickt: null },
    "Kundenbildschirm abfragen",
  );
}

/** Der Kunde beendet einen geschickten Auftrag ohne Unterschrift: Er erscheint nicht wieder von selbst. */
export async function bildschirmGeschicktVerwerfen(schluessel: string): Promise<void> {
  await weich(
    async () => {
      const g = await geraetPerSchluessel(schluessel);
      if (g) await geschicktZuruecknehmen(g.id);
    },
    undefined,
    "Kundenbildschirm: geschickten Auftrag verwerfen",
  );
}

// ---------------------------------------------------------------------------
// Verwaltung
// ---------------------------------------------------------------------------

export async function geraetAnlegenAktion(_v: Ergebnis, fd: FormData): Promise<Ergebnis> {
  return sicher(fd, async () => {
    await benutzerMitRecht("einstellungen");
    await geraetAnlegen(text(fd, "name", 60));
    revalidatePath("/admin/kundenbildschirm");
    return { status: "ok", meldung: "Gerätelink angelegt." };
  });
}

export async function geraetSperrenAktion(id: string, _v: Ergebnis): Promise<Ergebnis> {
  return sicher(null, async () => {
    await benutzerMitRecht("einstellungen");
    await geraetSperren(id);
    revalidatePath("/admin/kundenbildschirm");
    return { status: "ok", meldung: "Gesperrt. Der Link funktioniert nicht mehr." };
  });
}

export async function auftragAnBildschirmAktion(terminId: string, _v: Ergebnis): Promise<Ergebnis> {
  return sicher(null, async () => {
    const b = await benutzerMitRecht("termine");
    try {
      await auftragSchicken(terminId, b.id);
    } catch (error) {
      if (error instanceof TerminFehler) return { status: "fehler", meldung: error.message };
      throw error;
    }
    revalidatePath("/admin/kundenbildschirm");
    return { status: "ok", meldung: "Geschickt. Der Kunde sieht den Auftrag in wenigen Sekunden am Bildschirm." };
  });
}

export async function geschicktZuruecknehmenAktion(_v: Ergebnis): Promise<Ergebnis> {
  return sicher(null, async () => {
    await benutzerMitRecht("termine");
    await geschicktZuruecknehmen();
    revalidatePath("/admin/kundenbildschirm");
    return { status: "ok", meldung: "Zurückgenommen." };
  });
}

export async function eingabenGesehenAktion(_v: Ergebnis): Promise<Ergebnis> {
  return sicher(null, async () => {
    await benutzerMitRecht("kunden");
    await eingabenGesehen();
    revalidatePath("/admin", "layout");
    return { status: "ok" };
  });
}
