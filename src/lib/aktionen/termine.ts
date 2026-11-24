"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { benutzerMitRecht } from "../auth";
import { melden, verlauf } from "../ereignisse";
import { type Ergebnis, ja, text, werteAus, zahl } from "../forms";
import { sicher } from "../sicher";
import { auftragAnlegen, nachFertig } from "../auftrag";
import { kvMitTerminVerknuepfen } from "../rechnung/kostenvoranschlaege";
import { entwurfAusTermin } from "../rechnung/rechnungen";
import { db, DbFehler } from "../supabase/admin";
import { datum } from "../format";
import { kalenderHref, kalLesen, mitKal } from "../kalender-ansicht";
import { ablehnen, bestaetigen, erledigen, gegenvorschlag, loeschen, PlanungsWarnung, stornieren, terminEintragen, TerminFehler, umplanen, verschieben } from "../termine";
import { istDatum } from "../zeit";

/** Termin-Aktionen. Admin am Rechner und Handy-App teilen sich diese Funktionen. */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const uuidOderNull = (x: unknown) => (typeof x === "string" && UUID.test(x) ? x : null);

function neuLaden(id?: string) {
  revalidatePath("/admin", "layout");
  revalidatePath("/app", "layout");
  revalidatePath("/team", "layout");
  if (id) revalidatePath(`/admin/termine/${id}`);
}

async function mitFehlertext(fd: FormData | null, fn: () => Promise<Ergebnis>): Promise<Ergebnis> {
  return sicher(fd, async () => {
    try {
      return await fn();
    } catch (error) {
      if (error instanceof PlanungsWarnung) {
        return {
          status: "fehler",
          meldung: error.message,
          daten: { warnungen: error.gruende },
          werte: fd ? werteAus(fd) : undefined,
          versuch: Date.now(),
        };
      }
      if (error instanceof TerminFehler) return { status: "fehler", meldung: error.message };
      throw error;
    }
  });
}

export async function bestaetigenAktion(id: string, _v: Ergebnis, fd: FormData): Promise<Ergebnis> {
  return mitFehlertext(fd, async () => {
    const b = await benutzerMitRecht("termine");
    await bestaetigen(id, b.id, ja(fd, "ueberbuchen"));
    neuLaden(id);
    return { status: "ok", meldung: "Bestätigt. Der Kunde bekommt eine Mail, der Termin steht im Kalender." };
  });
}

export async function ablehnenAktion(id: string, _v: Ergebnis, fd: FormData): Promise<Ergebnis> {
  return mitFehlertext(fd, async () => {
    const b = await benutzerMitRecht("termine");
    await ablehnen(id, text(fd, "grund", 500), b.id);
    neuLaden(id);
    return { status: "ok", meldung: "Abgelehnt. Der Kunde wurde informiert." };
  });
}

export async function absagenAktion(id: string, _v: Ergebnis, fd: FormData): Promise<Ergebnis> {
  return mitFehlertext(fd, async () => {
    const b = await benutzerMitRecht("termine");
    await stornieren(id, { benutzer: b.id }, text(fd, "grund", 500));
    neuLaden(id);
    return { status: "ok", meldung: "Abgesagt." };
  });
}

/**
 * Endgültig löschen, danach zurück zur Liste (die Detailseite gibt es dann nicht mehr). Kam man aus dem Kalender
 * (verstecktes Feld `kal`), geht es in genau diese Ansicht zurück.
 */
export async function loeschenAktion(ziel: "/admin/termine" | "/app", id: string, _v: Ergebnis, fd: FormData): Promise<Ergebnis> {
  return mitFehlertext(fd, async () => {
    const b = await benutzerMitRecht("termine");
    await loeschen(id, b.id);
    neuLaden();
    const kal = ziel === "/admin/termine" ? kalLesen(fd.get("kal")) : null;
    redirect(kal ? kalenderHref(kal) : ziel);
  });
}

export async function verschiebenAktion(id: string, _v: Ergebnis, fd: FormData): Promise<Ergebnis> {
  return mitFehlertext(fd, async () => {
    const b = await benutzerMitRecht("termine");
    const datum = text(fd, "datum", 10);
    const uhrzeit = text(fd, "uhrzeit", 5);
    if (!istDatum(datum) || !/^\d{2}:\d{2}$/.test(uhrzeit)) return { status: "fehler", meldung: "Bitte Datum und Uhrzeit angeben." };
    await verschieben(id, datum, uhrzeit, b.id, ja(fd, "ueberbuchen"));
    neuLaden(id);
    return { status: "ok", meldung: "Verschoben." };
  });
}

/**
 * Gegenvorschlag zu einer Anfrage. Die Zeit kommt aus einem der vorgeschlagenen freien Termine (Knopf mit
 * name="vorschlag", Wert „Datum|Uhrzeit“) oder aus den Feldern Datum und Uhrzeit.
 */
export async function gegenvorschlagAktion(id: string, _v: Ergebnis, fd: FormData): Promise<Ergebnis> {
  return mitFehlertext(fd, async () => {
    const b = await benutzerMitRecht("termine");
    const [vDatum, vUhr] = text(fd, "vorschlag", 20).split("|");
    const datum = vDatum || text(fd, "datum", 10);
    const uhrzeit = vUhr || text(fd, "uhrzeit", 5);
    if (!istDatum(datum) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(uhrzeit)) return { status: "fehler", meldung: "Bitte einen Termin wählen oder Datum und Uhrzeit angeben." };
    await gegenvorschlag(id, datum, uhrzeit, text(fd, "nachricht", 1000), b.id, ja(fd, "ueberbuchen"));
    neuLaden(id);
    return { status: "ok", meldung: "Vorschlag ist an den Kunden raus. Er kann über seinen Link annehmen oder ablehnen." };
  });
}

export async function erledigtAktion(id: string, _v: Ergebnis, fd: FormData): Promise<Ergebnis> {
  return mitFehlertext(fd, async () => {
    const b = await benutzerMitRecht("termine");
    const art = fd.get("art") === "nicht_erschienen" ? "nicht_erschienen" : "erledigt";
    await erledigen(id, b.id, art);
    // Erledigt heißt fertig: Der Rechnungsentwurf liegt danach bereit (wie bei „fertig“ aus der Werkstatt).
    const rechnung = art === "erledigt" ? await nachFertig(id, b.id, b.name || "Büro", false) : null;
    neuLaden(id);
    revalidatePath("/admin/rechnungen", "layout");
    return { status: "ok", meldung: rechnung ? "Erledigt. Der Rechnungsentwurf liegt bereit." : "Gespeichert." };
  });
}

export async function detailsSpeichern(id: string, _v: Ergebnis, fd: FormData): Promise<Ergebnis> {
  return mitFehlertext(fd, async () => {
    const b = await benutzerMitRecht("termine");
    const mitarbeiter = uuidOderNull(fd.get("zugewiesen_an"));
    // Der Kilometerstand steht bei der Fahrzeugannahme; fehlt das Feld, bleibt er, wie er ist.
    const km = fd.has("km_stand") ? zahl(fd, "km_stand") : undefined;
    // Die Person geht über termine.ts (Prüfung, Push, Ereignis); bei erledigten Terminen nur noch nachtragen.
    const { data: t } = await db().from("termine").select("status, zugewiesen_an").eq("id", id).single();
    if (t && t.zugewiesen_an !== mitarbeiter) {
      if (["angefragt", "bestaetigt"].includes(t.status)) await umplanen(id, { mitarbeiter }, b.id, ja(fd, "ueberbuchen"));
      else await db().from("termine").update({ zugewiesen_an: mitarbeiter }).eq("id", id);
    }
    await db()
      .from("termine")
      .update({ notiz_intern: text(fd, "notiz_intern", 3000), ...(km !== undefined && { km_stand: km === null ? null : Math.round(km) }) })
      .eq("id", id);
    if (km != null) {
      const { data } = await db().from("termine").select("fahrzeug_id").eq("id", id).single();
      if (data?.fahrzeug_id) await db().from("fahrzeuge").update({ km_stand: Math.round(km) }).eq("id", data.fahrzeug_id);
    }
    await verlauf("termin", id, "Details geändert", b.id);
    neuLaden(id);
    return { status: "ok", meldung: "Gespeichert." };
  });
}

/**
 * Ziehen und Auswahl im Kalender: Uhrzeit und/oder Mitarbeiter ändern. Gibt bei einer Warnung die Gründe in
 * `daten.warnungen` zurück; der Kalender fragt nach und ruft mit `trotzdem` noch einmal auf.
 */
export async function umplanenAktion(id: string, ziel: { datum?: string; uhrzeit?: string; mitarbeiter?: string | null }, trotzdem = false): Promise<Ergebnis> {
  return mitFehlertext(null, async () => {
    const b = await benutzerMitRecht("termine");
    if (!UUID.test(id)) return { status: "fehler", meldung: "Termin nicht gefunden." };
    if (ziel.datum !== undefined && !istDatum(ziel.datum)) return { status: "fehler", meldung: "Ungültiges Datum." };
    if (ziel.uhrzeit !== undefined && !/^([01]\d|2[0-3]):[0-5]\d$/.test(ziel.uhrzeit)) return { status: "fehler", meldung: "Ungültige Uhrzeit." };
    const mitarbeiter = ziel.mitarbeiter === undefined ? undefined : uuidOderNull(ziel.mitarbeiter);
    await umplanen(id, { datum: ziel.datum, uhrzeit: ziel.uhrzeit, mitarbeiter }, b.id, Boolean(trotzdem));
    neuLaden(id);
    return { status: "ok", meldung: "Gespeichert." };
  });
}

export async function eintragenAktion(basis: "/admin/termine" | "/app/termine", _v: Ergebnis, fd: FormData): Promise<Ergebnis> {
  let ziel = "";
  const ergebnis = await mitFehlertext(fd, async () => {
    const b = await benutzerMitRecht("termine");
    const datum = text(fd, "datum", 10);
    const uhrzeit = text(fd, "uhrzeit", 5);
    const name = text(fd, "name", 120);
    if (!istDatum(datum) || !/^\d{2}:\d{2}$/.test(uhrzeit)) return { status: "fehler", meldung: "Bitte Datum und Uhrzeit angeben." };
    if (!name) return { status: "fehler", meldung: "Bitte einen Namen angeben." };
    const dauer = zahl(fd, "dauer");
    // Sonst scheitert es erst an der Prüfung in der Datenbank (ende > beginn), mit deren Fehlertext
    if (dauer !== null && Math.round(dauer) < 1) return { status: "fehler", meldung: "Die Dauer muss mindestens eine Minute sein." };
    const t = await terminEintragen(
      {
        leistungIds: fd.getAll("leistung").filter((x): x is string => typeof x === "string").map((x) => x.slice(0, 40)),
        // Ein Werkstattauftrag ohne Leistung heißt im Kalender so, nicht „Termin“
        leistungName: text(fd, "leistung_frei", 120) || (ja(fd, "auftrag") && !fd.getAll("leistung").length ? "Werkstattauftrag" : undefined),
        dauerMin: dauer ? Math.round(dauer) : undefined,
        datum,
        uhrzeit,
        name,
        telefon: text(fd, "telefon", 40),
        email: text(fd, "email", 160).toLowerCase(),
        kennzeichen: text(fd, "kennzeichen", 16),
        fahrzeug: text(fd, "fahrzeug", 120),
        notiz: text(fd, "notiz", 1500),
        ueberbuchen: ja(fd, "ueberbuchen"),
        // leer = automatisch (wer frei ist), „-“ = bewusst niemand
        mitarbeiter: text(fd, "zugewiesen_an", 40) === "-" ? null : (uuidOderNull(fd.get("zugewiesen_an")) ?? "auto"),
        kundeId: uuidOderNull(fd.get("kunde_id")),
        fahrzeugId: uuidOderNull(fd.get("fahrzeug_id")),
      },
      b.id,
    );
    // Aus „Neuer Werkstattauftrag“ (auftrag=1) oder vom Kostenvoranschlag (kv=…): gleich weiter verknüpfen.
    const kv = uuidOderNull(fd.get("kv"));
    if (kv) await kvMitTerminVerknuepfen(kv, t.id, b.id);
    if (ja(fd, "auftrag")) await auftragAnlegen(t.id, b.id);
    neuLaden();
    revalidatePath("/admin/kostenvoranschlaege", "layout");
    // Aus „Neuer Werkstattauftrag“: gleich in die Positionen des Auftrags
    // Aus dem Kalender eingetragen: `kal` mitnehmen, damit „Zurück“ und das Menü beim Kalender bleiben
    const kal = basis === "/admin/termine" ? kalLesen(fd.get("kal")) : null;
    ziel = mitKal(ja(fd, "auftrag") && text(fd, "weiter", 10) === "auftrag" ? `${basis}/${t.id}/auftrag` : `${basis}/${t.id}`, kal);
    return { status: "ok" };
  });
  if (ziel) redirect(ziel);
  return ergebnis;
}

export async function rechnungAusTermin(id: string, basis: "/admin/rechnungen" | "/app/rechnungen"): Promise<void> {
  const b = await benutzerMitRecht("rechnungen");
  const rechnungId = await entwurfAusTermin(id, b.id);
  redirect(`${basis}/${rechnungId}`);
}

/**
 * Bestehenden Termin an einen Kunden aus der Kartei hängen (falsch zugeordnet, Kunde doppelt angelegt,
 * Anfrage ohne Kunde). Fahrzeug nur, wenn es diesem Kunden gehört; sonst bleibt der Termin ohne Fahrzeug.
 */
export async function kundeVerknuepfen(id: string, kundeId: string, fahrzeugId: string | null): Promise<Ergebnis> {
  return mitFehlertext(null, async () => {
    const b = await benutzerMitRecht("termine");
    if (!uuidOderNull(kundeId)) return { status: "fehler", meldung: "Bitte einen Kunden wählen." };
    const { data: k } = await db().from("kunden").select("id, name").eq("id", kundeId).maybeSingle();
    if (!k) return { status: "fehler", meldung: "Der Kunde ist nicht mehr in der Kartei." };
    const { data: fz } = uuidOderNull(fahrzeugId)
      ? await db().from("fahrzeuge").select("id, kennzeichen").eq("id", fahrzeugId!).eq("kunde_id", kundeId).maybeSingle()
      : { data: null };
    const { data: vorher } = await db().from("termine").select("kunde_id").eq("id", id).maybeSingle();
    if (!vorher) return { status: "fehler", meldung: "Termin nicht gefunden." };
    const { error } = await db().from("termine").update({ kunde_id: k.id, fahrzeug_id: fz?.id ?? null }).eq("id", id);
    if (error) throw new DbFehler(error);
    await verlauf("termin", id, `Kunde verknüpft: ${k.name}${fz ? ` (${fz.kennzeichen})` : ""}`, b.id);
    await melden("termin.kunde_verknuepft", { termin_id: id, kunde_id: k.id, vorher_kunde_id: vorher.kunde_id, fahrzeug_id: fz?.id ?? null });
    neuLaden(id);
    revalidatePath(`/admin/kunden/${k.id}`);
    if (vorher.kunde_id) revalidatePath(`/admin/kunden/${vorher.kunde_id}`);
    return { status: "ok", meldung: `Mit ${k.name} verknüpft.` };
  });
}

/**
 * Vorhandene Rechnung an den Termin hängen (z. B. „Rechnung ohne Termin“, später zugeordnet). Ihre
 * Stornorechnungen gehen mit. Auch gestellte Rechnungen: Der Verweis auf den Termin gehört nicht zum
 * unveränderlichen Inhalt.
 */
export async function rechnungVerknuepfen(id: string, _v: Ergebnis, fd: FormData): Promise<Ergebnis> {
  return mitFehlertext(fd, async () => {
    const b = await benutzerMitRecht("rechnungen");
    const rechnungId = uuidOderNull(fd.get("rechnung"));
    if (!rechnungId) return { status: "fehler", meldung: "Bitte eine Rechnung wählen." };
    const { data: r } = await db().from("rechnungen").select("id, nummer, termin_id, storno_zu").eq("id", rechnungId).maybeSingle();
    if (!r || r.storno_zu) return { status: "fehler", meldung: "Diese Rechnung lässt sich nicht verknüpfen." };
    if (r.termin_id === id) return { status: "ok", meldung: "Ist schon verknüpft." };
    if (r.termin_id) return { status: "fehler", meldung: "Diese Rechnung gehört schon zu einem anderen Termin. Bitte dort zuerst lösen." };
    const { data: t } = await db().from("termine").select("id, beginn, leistung_name").eq("id", id).maybeSingle();
    if (!t) return { status: "fehler", meldung: "Termin nicht gefunden." };
    const { error } = await db().from("rechnungen").update({ termin_id: id }).or(`id.eq.${r.id},storno_zu.eq.${r.id}`);
    if (error) throw new DbFehler(error);
    const name = r.nummer ?? "Rechnungsentwurf";
    await verlauf("termin", id, `${name} verknüpft`, b.id);
    await verlauf("rechnung", r.id, `Mit Termin vom ${datum(t.beginn)} (${t.leistung_name}) verknüpft`, b.id);
    await melden("rechnung.termin_verknuepft", { rechnung_id: r.id, nummer: r.nummer, termin_id: id, verknuepft: true });
    neuLaden(id);
    revalidatePath("/admin/rechnungen", "layout");
    return { status: "ok", meldung: `${name} ist jetzt mit dem Termin verknüpft.` };
  });
}

/** Rechnung vom Termin lösen (falsch zugeordnet). Die Rechnung selbst bleibt, wie sie ist. */
export async function rechnungLoesen(id: string, rechnungId: string): Promise<void> {
  const b = await benutzerMitRecht("rechnungen");
  if (!uuidOderNull(rechnungId)) return;
  const { data: r } = await db().from("rechnungen").select("id, nummer, storno_zu").eq("id", rechnungId).eq("termin_id", id).maybeSingle();
  if (!r || r.storno_zu) return;
  const { error } = await db().from("rechnungen").update({ termin_id: null }).or(`id.eq.${r.id},storno_zu.eq.${r.id}`).eq("termin_id", id);
  if (error) throw new DbFehler(error);
  const { data: t } = await db().from("termine").select("beginn, leistung_name").eq("id", id).maybeSingle();
  await verlauf("termin", id, `${r.nummer ?? "Rechnungsentwurf"} gelöst`, b.id);
  await verlauf("rechnung", r.id, `Vom Termin${t ? ` vom ${datum(t.beginn)} (${t.leistung_name})` : ""} gelöst`, b.id);
  await melden("rechnung.termin_verknuepft", { rechnung_id: r.id, nummer: r.nummer, termin_id: id, verknuepft: false });
  neuLaden(id);
  revalidatePath("/admin/rechnungen", "layout");
}
