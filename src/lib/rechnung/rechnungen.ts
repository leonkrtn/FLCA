import "server-only";
import { einstellungen, type Einstellungen } from "../einstellungen";
import { ENV } from "../env";
import { melden, verlauf } from "../ereignisse";
import { datum, euro } from "../format";
import { mail } from "../email/vorlagen";
import { mailer } from "../services/email";
import { db, DbFehler, dbRoh, pruefe } from "../supabase/admin";
import { berlinDatum, plusTage } from "../zeit";
import { laufendeAngebote } from "../angebote/daten";
import { angeboteAnwenden, type GebuchterAngebotsPreis } from "../angebote/preise";
import { berechne, type Position, vorzeichenWechseln } from "./berechnung";
import { arbeitsMinuten, lohnEinsetzen, positionenAusLeistungen } from "../auftrag-regeln";
import { kundeAusBeleg, markeUndModell } from "../kunden";
import { merken, type PaketWunsch } from "./preisgedaechtnis";
import { rechnungPdf } from "./pdf";
import { alsZugferd, eRechnungPruefen, istXRechnung, zugferdXml } from "./zugferd";
import { bereitsBezahlt, durchZahlungErledigt, fassungsNummer, grundPruefen, offenerBetrag } from "./korrektur";
import { fehlerMelden, weich } from "../fehler";

export type Empfaenger = {
  name: string;
  firma?: string;
  strasse?: string;
  plz?: string;
  ort?: string;
  email?: string;
  ust_id?: string;
  leitweg_id?: string;
};

export type Rechnung = {
  id: string;
  nummer: string | null;
  status: "entwurf" | "gestellt" | "bezahlt" | "storniert";
  storno_zu: string | null;
  /**
   * Korrektur: das Original, das diese Fassung ersetzt (Nummer des Originals mit Fassung, RE-2026-0001.1).
   * Optional, weil die Spalten vor der Migration „rechnung_korrigieren“ fehlen.
   */
  korrektur_zu?: string | null;
  korrektur_grund?: string;
  /** Auf das Original schon gezahlt, die Korrektur verrechnet es (siehe korrektur.ts). */
  bereits_bezahlt_cent?: number;
  termin_id: string | null;
  kunde_id: string | null;
  empfaenger: Empfaenger;
  /** Bei Belegen vor der Trennung steht in modell der ganze Text („VW Golf“) und marke fehlt. */
  fahrzeug: { kennzeichen?: string; marke?: string; modell?: string; km?: number | null };
  positionen: Position[];
  rechnungsdatum: string | null;
  leistungsdatum: string | null;
  faellig_am: string | null;
  hinweis: string;
  summe_netto_cent: number;
  summe_mwst_cent: number;
  summe_brutto_cent: number;
  firma: Einstellungen["firma"] | null;
  token: string;
  gesendet_am: string | null;
  gesendet_an: string | null;
  bezahlt_am: string | null;
  zahlungsart: "bar" | "ueberweisung" | null;
  erstellt_am: string;
  gestellt_am: string | null;
  kunde?: { nummer: number } | null;
};

export const RECHNUNG_STATUS: Record<Rechnung["status"], string> = {
  entwurf: "Entwurf",
  gestellt: "Offen",
  bezahlt: "Bezahlt",
  storniert: "Storniert",
};

export type PreislistenPosition = {
  id: string;
  name: string;
  einheit: string;
  /** Geltender Preis: während eines Angebots der Angebotspreis. */
  preis_brutto_cent: number;
  mwst_satz: number;
  sprachnamen: string[];
  /** Titel des laufenden Angebots, sonst null. Ein Angebotspreis hat Vorrang vor gemerkten Preisen. */
  angebot: string | null;
  listen_brutto_cent: number;
};

/**
 * Auswahl „Aus der Preisliste“ im Rechnungseditor: alles Aktive, Leistungen und Teile, in der Reihenfolge der
 * Preisliste. Laufende Angebote sind schon eingerechnet (Stichtag: heute, der Tag, an dem der Beleg entsteht).
 */
export async function preislisteFuerBelege(): Promise<PreislistenPosition[]> {
  const [{ data }, angebote] = await Promise.all([db().from("leistungen").select("*").order("sortierung"), laufendeAngebote()]);
  const aktiv = (data ?? []).filter((l) => l.aktiv !== false);
  return angeboteAnwenden(aktiv, angebote, berlinDatum()).map((l) => ({
    id: l.id,
    name: l.name,
    einheit: l.einheit ?? "Pauschal",
    preis_brutto_cent: l.preis_cent ?? 0,
    mwst_satz: Number(l.mwst_satz ?? 19),
    // Vor der Migration „sprachnamen“ fehlt die Spalte
    sprachnamen: Array.isArray(l.sprachnamen) ? l.sprachnamen : [],
    angebot: l.angebot && l.preis_cent !== null ? l.angebot.titel : null,
    listen_brutto_cent: l.angebot?.listen_cent ?? l.preis_cent ?? 0,
  }));
}

export async function rechnungLaden(id: string): Promise<Rechnung | null> {
  return pruefe<Rechnung | null>(await db().from("rechnungen").select("*, kunde:kunden(nummer)").eq("id", id).maybeSingle());
}

export async function rechnungPerToken(token: string): Promise<Rechnung | null> {
  if (!/^[a-f0-9]{64}$/.test(token)) return null;
  return pruefe<Rechnung | null>(await db().from("rechnungen").select("*, kunde:kunden(nummer)").eq("token", token).neq("status", "entwurf").maybeSingle());
}

/**
 * Die Rechnung eines Termins (Entwurf, offen oder bezahlt). Stornorechnungen zählen nicht: Sie tragen dieselbe
 * termin_id und stehen auf „gestellt“, sonst führte „Rechnung erstellen“ nach einem Storno immer wieder zur
 * Stornorechnung statt zu einem neuen Entwurf.
 */
export async function rechnungZumTermin(terminId: string): Promise<string | null> {
  const { data } = await db()
    .from("rechnungen")
    .select("id")
    .eq("termin_id", terminId)
    .in("status", ["entwurf", "gestellt", "bezahlt"])
    .is("storno_zu", null)
    .order("erstellt_am")
    .order("id")
    .limit(1)
    .maybeSingle();
  return data?.id ?? null;
}

/**
 * Zwei gleichzeitige Wege zur Rechnung (Doppelklick, „fertig“ in der Werkstatt und „Rechnung erstellen“ im Büro)
 * ergeben nur einen Entwurf: Gibt es am Termin schon einen älteren, fällt der gerade angelegte wieder weg.
 */
export async function einzigerEntwurf(terminId: string, eigene: string): Promise<string> {
  const erste = await rechnungZumTermin(terminId);
  if (!erste || erste === eigene) return eigene;
  await db().from("rechnungen").delete().eq("id", eigene).eq("status", "entwurf");
  await db().from("verlauf").delete().eq("bezug_typ", "rechnung").eq("bezug_id", eigene);
  return erste;
}

/**
 * Rechnungsentwurf zu einem Termin. Es gibt immer nur eine Rechnung je Termin, egal auf welchem Weg man kommt:
 * 1. Hat der Termin schon eine, ist es diese.
 * 2. Ist aus einem Kostenvoranschlag des Termins schon eine Rechnung entstanden, wird sie die des Termins.
 * 3. Sonst ein neuer Entwurf mit Kunde und Fahrzeug, die Positionen aus dem Werkstattauftrag, sonst aus dem
 *    angenommenen Kostenvoranschlag, sonst jede Leistung des Termins mit ihrem Festpreis.
 */
export async function entwurfAusTermin(terminId: string, vonBenutzer: string): Promise<string> {
  const vorhanden = await rechnungZumTermin(terminId);
  if (vorhanden) return vorhanden;

  const { data: kvs } = await db()
    .from("kostenvoranschlaege")
    .select("id, nummer, status, positionen, hinweis, rechnung_id")
    .eq("termin_id", terminId)
    .in("status", ["offen", "angenommen"])
    .order("erstellt_am", { ascending: false });
  const angebote = (kvs ?? []) as { id: string; nummer: string; status: string; positionen: Position[]; hinweis: string; rechnung_id: string | null }[];
  for (const k of angebote.filter((x) => x.rechnung_id)) {
    const { data: r } = await db().from("rechnungen").select("id, termin_id, status, storno_zu").eq("id", k.rechnung_id!).maybeSingle();
    if (!r || r.termin_id || r.storno_zu || r.status === "storniert") continue;
    await db().from("rechnungen").update({ termin_id: terminId }).or(`id.eq.${r.id},storno_zu.eq.${r.id}`).is("termin_id", null);
    await verlauf("rechnung", r.id, `Mit dem Termin verknüpft (über Kostenvoranschlag ${k.nummer})`, vonBenutzer);
    return einzigerEntwurf(terminId, r.id);
  }

  // „*“ statt einzelner Spalten: leistung_ids gibt es erst nach der Migration „mehrere_leistungen“.
  const { data: t } = await db()
    .from("termine")
    .select("*, kunde:kunden(*), fahrzeug:fahrzeuge(kennzeichen, marke_modell, marke, modell, km_stand)")
    .eq("id", terminId)
    .single();
  if (!t) throw new Error("Termin nicht gefunden.");
  const kunde = t.kunde as unknown as Record<string, string> | null;
  const fahrzeug = t.fahrzeug as unknown as { kennzeichen: string; marke_modell: string; marke: string; modell: string; km_stand: number | null } | null;
  const angenommen = angebote.find((k) => k.status === "angenommen" && !k.rechnung_id);
  const auftrag = (t.auftrag_positionen as Position[] | undefined) ?? [];

  let positionen: Position[];
  let hinweis = "";
  let herkunft = "";
  if (t.auftrag_nummer && auftrag.length) {
    positionen = auftrag;
    herkunft = `Aus Werkstattauftrag ${t.auftrag_nummer} übernommen`;
  } else if (angenommen?.positionen.length) {
    positionen = angenommen.positionen;
    hinweis = angenommen.hinweis ?? "";
    herkunft = `Aus Kostenvoranschlag ${angenommen.nummer} übernommen`;
  } else {
    const ids: string[] = (t.leistung_ids as string[] | undefined)?.length ? t.leistung_ids : t.leistung_id ? [t.leistung_id] : [];
    // Reihenfolge wie im Termin. Bei „ab“-Preisen steht der Startwert drin und wird in der Rechnung angepasst.
    const { data: gefunden } = ids.length ? await db().from("leistungen").select("*").in("id", ids) : { data: [] };
    // Wurde die Leistung während eines Angebots angefragt, gilt der damals festgehaltene Angebotspreis.
    positionen = positionenAusLeistungen(
      ids.map((id) => (gefunden ?? []).find((l) => l.id === id)).filter(Boolean),
      String(t.leistung_name ?? ""),
      (t.angebot_preise ?? {}) as Record<string, GebuchterAngebotsPreis>,
    );
  }

  // In der Team-App erfasste Arbeitszeit: füllt leere Lohnpositionen, sonst nur als Vermerk im Verlauf.
  // weich: auftrag_zeiten gibt es erst seit der Migration „team_werkstatt“.
  const minuten = await weich(
    async () => arbeitsMinuten(pruefe<{ beginn: string; ende: string | null }[]>(await db().from("auftrag_zeiten").select("beginn, ende").eq("termin_id", terminId))),
    0,
    "Arbeitszeit für den Rechnungsentwurf lesen",
  );
  const ausKv = Boolean(angenommen && positionen === angenommen.positionen);
  const lohn = lohnEinsetzen(positionen, minuten);
  positionen = lohn.positionen;

  const id = await entwurfAnlegen(
    {
      termin_id: t.id,
      kunde_id: kunde?.id ?? null,
      empfaenger: kunde
        ? { name: kunde.name, firma: kunde.firma, strasse: kunde.strasse, plz: kunde.plz, ort: kunde.ort, email: kunde.email, ust_id: kunde.ust_id, leitweg_id: kunde.leitweg_id }
        : { name: "" },
      fahrzeug: { kennzeichen: fahrzeug?.kennzeichen, ...(fahrzeug ? markeUndModell(fahrzeug) : {}), km: t.km_stand ?? fahrzeug?.km_stand ?? null },
      positionen,
      hinweis,
      leistungsdatum: berlinDatum(new Date(t.beginn)),
    },
    vonBenutzer,
  );
  if (herkunft) await verlauf("rechnung", id, herkunft, vonBenutzer);
  if (minuten) {
    const h = `${Math.floor(minuten / 60)}:${String(minuten % 60).padStart(2, "0")} h`;
    await verlauf("rechnung", id, lohn.eingesetzt ? `Erfasste Arbeitszeit ${h} als Lohnstunden eingesetzt` : `In der Werkstatt erfasste Arbeitszeit: ${h}`, vonBenutzer);
  }
  if (angenommen && ausKv) {
    await db().from("kostenvoranschlaege").update({ rechnung_id: id }).eq("id", angenommen.id).is("rechnung_id", null);
  }
  return einzigerEntwurf(terminId, id);
}

export async function entwurfAnlegen(
  r: Partial<Pick<Rechnung, "termin_id" | "kunde_id" | "empfaenger" | "fahrzeug" | "positionen" | "leistungsdatum" | "hinweis" | "korrektur_zu" | "korrektur_grund">>,
  vonBenutzer: string,
): Promise<string> {
  const summen = berechne(r.positionen ?? []);
  const neu = pruefe(
    await db()
      .from("rechnungen")
      .insert({
        ...r,
        summe_netto_cent: summen.netto,
        summe_mwst_cent: summen.steuer,
        summe_brutto_cent: summen.brutto,
        erstellt_von: vonBenutzer,
      })
      .select("id")
      .single(),
  );
  await verlauf("rechnung", neu.id, "Entwurf angelegt", vonBenutzer);
  return neu.id;
}

export async function entwurfSpeichern(
  id: string,
  r: Pick<Rechnung, "empfaenger" | "fahrzeug" | "positionen" | "leistungsdatum" | "hinweis"> & { kunde_id?: string | null },
): Promise<void> {
  const summen = berechne(r.positionen);
  const { data, error } = await db()
    .from("rechnungen")
    .update({ ...r, summe_netto_cent: summen.netto, summe_mwst_cent: summen.steuer, summe_brutto_cent: summen.brutto })
    .eq("id", id)
    .eq("status", "entwurf")
    .select("id");
  if (error) throw new DbFehler(error);
  if (!data?.length) throw new Error("Nur Entwürfe lassen sich ändern. Eine gestellte Rechnung bitte über „Rechnung korrigieren“ berichtigen.");
}

/**
 * Vergibt die Nummer und friert die Rechnung ein. Danach ist sie unveränderlich. Anschließend merken sich die
 * Positionen ihren Preis für Marke + Modell des Fahrzeugs, dazu die benannten Pakete.
 *
 * Eine Korrektur (korrektur_zu) storniert vorher ihr Original und bekommt dessen Nummer mit Fassung
 * (`rechnung_korrektur_stellen`). Was auf das Original schon gezahlt ist, wird verrechnet; deckt es den neuen
 * Betrag, ist die Korrektur gleich bezahlt.
 */
export async function stellen(id: string, vonBenutzer: string, pakete: PaketWunsch[] = []): Promise<string> {
  const r = await rechnungLaden(id);
  if (!r) throw new Error("Rechnung nicht gefunden.");
  if (r.status !== "entwurf") throw new Error("Die Rechnung ist schon gestellt.");
  if (!r.empfaenger?.name?.trim()) throw new Error("Bitte einen Rechnungsempfänger eintragen.");
  // Vor dem Anlegen des Kunden: sonst entstünde er auch, wenn das Stellen gleich danach scheitert
  if (!r.positionen?.length) throw new Error("Die Rechnung hat keine Positionen.");
  const { firma, rechnung } = await einstellungen();
  // Pflichtangaben der E-Rechnung jetzt prüfen: Nach dem Stellen ist die Rechnung unveränderlich.
  const fehlt = eRechnungPruefen({ empfaenger: r.empfaenger, firma, positionen: r.positionen });
  if (fehlt.length) {
    const art = istXRechnung(r) ? "XRechnung (Behörde, Leitweg-ID)" : "E-Rechnung";
    throw new Error(`Für eine gültige ${art} fehlt noch: ${fehlt.join("; ")}.`);
  }
  // Alles, woran eine Korrektur scheitern kann, vor dem Storno prüfen: Das Storno lässt sich nicht zurücknehmen.
  const original = r.korrektur_zu ? await rechnungLaden(r.korrektur_zu) : null;
  const grund = original ? grundPruefen(r.korrektur_grund ?? "") : "";
  if (r.korrektur_zu && (!original?.nummer || !["gestellt", "bezahlt", "storniert"].includes(original.status))) {
    throw new Error("Die Rechnung, die korrigiert werden soll, gibt es nicht mehr oder sie ist nicht gestellt.");
  }
  const heute = berlinDatum();
  // Empfänger ohne Kunden: jetzt in die Kartei (gefunden oder neu). Stornos übernehmen den Kunden des Originals.
  const kundeId = r.kunde_id ?? (r.storno_zu ? null : await kundeAusBeleg(r.empfaenger, r.fahrzeug));
  await db()
    .from("rechnungen")
    .update({
      rechnungsdatum: heute,
      faellig_am: plusTage(heute, rechnung.zahlungszielTage),
      leistungsdatum: r.leistungsdatum ?? heute,
      kunde_id: kundeId,
      ...(original ? { bereits_bezahlt_cent: bereitsBezahlt(original) } : {}),
    })
    .eq("id", id)
    .eq("status", "entwurf");

  let nummer: string;
  if (original) {
    // Erst gilt das Original nicht mehr, dann die neue Fassung. Scheitert das Stellen danach, bleibt der
    // Entwurf stehen, und der nächste Versuch überspringt das schon erledigte Storno.
    if (original.status !== "storniert") await stornieren(original.id, vonBenutzer, grund);
    const { data, error } = await dbRoh().rpc("rechnung_korrektur_stellen", { p_id: id, p_firma: firma });
    if (error) {
      if (error.message.includes("KEINE_POSITIONEN")) throw new Error("Die Rechnung hat keine Positionen.");
      if (error.message.includes("KEIN_GRUND")) throw new Error("Bitte den Grund der Korrektur angeben.");
      throw new DbFehler(error, { funktion: "rechnung_korrektur_stellen" });
    }
    nummer = data as string;
  } else {
    const { data, error } = await dbRoh().rpc("rechnung_stellen", { p_id: id, p_firma: firma });
    if (error) {
      if (error.message.includes("KEINE_POSITIONEN")) throw new Error("Die Rechnung hat keine Positionen.");
      throw new DbFehler(error);
    }
    nummer = data as string;
  }

  await verlauf("rechnung", id, original ? `Gestellt als ${nummer}, berichtigt ${original.nummer}. Grund: ${grund}` : `Gestellt als ${nummer}`, vonBenutzer);
  let neu = (await rechnungLaden(id))!;
  if (original) {
    await verlauf("rechnung", original.id, `Ersetzt durch die berichtigte Rechnung ${nummer}. Grund: ${grund}`, vonBenutzer);
    const offen = offenerBetrag(neu);
    if (durchZahlungErledigt(neu)) {
      await db()
        .from("rechnungen")
        .update({ status: "bezahlt", bezahlt_am: original.bezahlt_am ?? heute, zahlungsart: original.zahlungsart ?? "ueberweisung" })
        .eq("id", id)
        .eq("status", "gestellt");
      await verlauf("rechnung", id, `Bezahlt durch die Zahlung auf ${original.nummer}${offen < 0 ? `, zu erstatten: ${euro(-offen)}` : ""}`, vonBenutzer);
      neu = (await rechnungLaden(id))!;
    } else if (neu.bereits_bezahlt_cent) {
      await verlauf("rechnung", id, `Auf ${original.nummer} schon bezahlt: ${euro(neu.bereits_bezahlt_cent)}, noch offen: ${euro(offen)}`, vonBenutzer);
    }
  }
  await melden("rechnung.gestellt", ereignisDaten(neu));
  if (original) {
    await melden("rechnung.korrigiert", {
      ...ereignisDaten(neu),
      original_id: original.id,
      original_nummer: original.nummer,
      grund,
      bereits_bezahlt_cent: neu.bereits_bezahlt_cent ?? 0,
    });
  }
  try {
    await merken(neu, pakete);
  } catch (e) {
    await fehlerMelden(e, "Preise der gestellten Rechnung merken");
  }
  return nummer;
}

/**
 * Beginnt die Korrektur einer gestellten Rechnung: ein Entwurf mit allen Angaben des Originals, der sich wie
 * jeder Entwurf bearbeiten lässt. Das Original bleibt bis zum Stellen der Korrektur gültig. Gibt es schon einen
 * Korrekturentwurf, ist es dieser (mit dem neuen Grund).
 */
export async function korrekturAnlegen(id: string, grundEingabe: string, vonBenutzer: string): Promise<string> {
  const grund = grundPruefen(grundEingabe);
  const r = await rechnungLaden(id);
  if (!r || !["gestellt", "bezahlt"].includes(r.status) || r.storno_zu) {
    throw new Error("Korrigieren lassen sich nur offene oder bezahlte Rechnungen, keine Stornorechnungen und keine schon stornierten.");
  }
  if (!("korrektur_zu" in r)) {
    throw new Error("Für Korrekturen fehlt die Migration 20261126100000_rechnung_korrigieren.sql. Bitte im SQL-Editor von Supabase ausführen.");
  }
  const vorhanden = async () => (await db().from("rechnungen").select("id, status, korrektur_grund").eq("korrektur_zu", id).maybeSingle()).data;
  const da = await vorhanden();
  if (da) {
    if (da.status !== "entwurf") throw new Error("Diese Rechnung ist schon korrigiert.");
    if (da.korrektur_grund !== grund) {
      await db().from("rechnungen").update({ korrektur_grund: grund }).eq("id", da.id).eq("status", "entwurf");
      await verlauf("rechnung", da.id, `Grund der Korrektur geändert: ${grund}`, vonBenutzer);
    }
    return da.id;
  }
  let neuId: string;
  try {
    neuId = await entwurfAnlegen(
      {
        kunde_id: r.kunde_id,
        termin_id: r.termin_id,
        empfaenger: r.empfaenger,
        fahrzeug: r.fahrzeug,
        positionen: r.positionen,
        leistungsdatum: r.leistungsdatum,
        hinweis: r.hinweis,
        korrektur_zu: id,
        korrektur_grund: grund,
      },
      vonBenutzer,
    );
  } catch (e) {
    // Doppelklick: Der eindeutige Index lässt nur einen Korrekturentwurf je Original zu.
    const doppelt = e instanceof DbFehler && e.code === "23505" ? await vorhanden() : null;
    if (doppelt) return doppelt.id;
    throw e;
  }
  await verlauf("rechnung", neuId, `Korrektur zu ${r.nummer}. Grund: ${grund}`, vonBenutzer);
  await verlauf("rechnung", id, `Korrektur begonnen. Grund: ${grund}`, vonBenutzer);
  return neuId;
}

export type KorrekturStand = { id: string; original: string; datum: string | null; fassung: string; gesendet: boolean; grund: string; bereits: number };

/** Für den Korrekturentwurf: welches Original, welche Nummer die Fassung voraussichtlich bekommt, was verrechnet wird. */
export async function korrekturStand(r: Rechnung): Promise<KorrekturStand | null> {
  if (!r.korrektur_zu) return null;
  const o = await rechnungLaden(r.korrektur_zu);
  if (!o?.nummer) return null;
  const wurzel = o.korrektur_zu ? o.nummer.replace(/\.[0-9]+$/, "") : o.nummer;
  const { data } = await db().from("rechnungen").select("nummer").like("nummer", `${wurzel}.%`);
  return {
    id: o.id,
    original: o.nummer,
    datum: o.rechnungsdatum,
    fassung: fassungsNummer(o.nummer, Boolean(o.korrektur_zu), (data ?? []).map((x) => String(x.nummer))),
    gesendet: Boolean(o.gesendet_am),
    grund: r.korrektur_grund ?? "",
    bereits: bereitsBezahlt(o),
  };
}

export type Bezug = { id: string; nummer: string | null; rechnungsdatum: string | null; status: Rechnung["status"] };

/**
 * Die Belege, auf die eine Rechnung verweist oder die auf sie verweisen. Für Ansicht, PDF und Mail.
 * - original: bei einer Korrektur die ersetzte, bei einer Stornorechnung die stornierte Rechnung
 * - stornoDesOriginals: bei einer Korrektur die Stornorechnung ihres Originals
 * - storno: die Stornorechnung dieser Rechnung
 * - korrektur: die Korrektur dieser Rechnung (Entwurf oder gestellt)
 */
export async function bezuegeLaden(r: Rechnung): Promise<{ original: Bezug | null; stornoDesOriginals: Bezug | null; storno: Bezug | null; korrektur: Bezug | null }> {
  const felder = "id, nummer, rechnungsdatum, status";
  const eins = async (spalte: "id" | "storno_zu" | "korrektur_zu", wert: string) =>
    ((await db().from("rechnungen").select(felder).eq(spalte, wert).order("erstellt_am", { ascending: false }).limit(1).maybeSingle()).data as Bezug | null) ?? null;
  // Vor der Migration gibt es korrektur_zu nicht; dann auch nicht danach filtern.
  const mitKorrektur = "korrektur_zu" in r;
  const bezugId = r.korrektur_zu ?? r.storno_zu;
  const [original, stornoDesOriginals, storno, korrektur] = await Promise.all([
    bezugId ? eins("id", bezugId) : null,
    r.korrektur_zu ? eins("storno_zu", r.korrektur_zu) : null,
    r.storno_zu || r.status === "entwurf" ? null : eins("storno_zu", r.id),
    mitKorrektur && !r.storno_zu && r.status !== "entwurf" ? eins("korrektur_zu", r.id) : null,
  ]);
  return { original, stornoDesOriginals, storno, korrektur };
}

const ereignisDaten = (r: Rechnung) => ({
  rechnung_id: r.id,
  nummer: r.nummer,
  status: r.status,
  brutto_cent: r.summe_brutto_cent,
  netto_cent: r.summe_netto_cent,
  rechnungsdatum: r.rechnungsdatum,
  kunde_id: r.kunde_id,
  termin_id: r.termin_id,
  empfaenger: r.empfaenger?.firma || r.empfaenger?.name,
  korrektur_zu: r.korrektur_zu ?? null,
});

/** Die gespeicherten Daten einer gestellten Rechnung, so wie PDF und E-Rechnung sie brauchen. */
async function gestellteDaten(r: Rechnung) {
  if (!r.nummer || !r.firma || !r.rechnungsdatum) throw new Error("Nur gestellte Rechnungen haben ein PDF. Für Entwürfe gibt es die Vorschau.");
  const b = await bezuegeLaden(r);
  return {
    nummer: r.nummer,
    storno: Boolean(r.storno_zu),
    storno_zu_nummer: r.storno_zu ? (b.original?.nummer ?? null) : null,
    korrektur_zu: r.korrektur_zu && b.original?.nummer ? { nummer: b.original.nummer, datum: b.original.rechnungsdatum } : null,
    korrektur_grund: r.korrektur_grund ?? "",
    storno_des_originals: b.stornoDesOriginals?.nummer ?? null,
    bereits_bezahlt_cent: r.bereits_bezahlt_cent ?? 0,
    // Storniertes Original: Vermerk statt Zahlungsaufforderung, wie „bezahlt“ aus dem Status, nicht aus dem Beleg
    storniert: r.status === "storniert" ? { durch: b.storno?.nummer ?? null, ersetzt: b.korrektur?.nummer ?? null } : null,
    rechnungsdatum: r.rechnungsdatum,
    leistungsdatum: r.leistungsdatum,
    faellig_am: r.faellig_am,
    hinweis: r.hinweis,
    positionen: r.positionen,
    empfaenger: r.empfaenger,
    firma: r.firma,
  };
}

/** Die E-Rechnung als reine XML-Datei (für Behördenportale, die keine PDFs annehmen). */
export async function xmlErzeugen(r: Rechnung): Promise<string> {
  return zugferdXml(await gestellteDaten(r));
}

/** Das PDF zu einer gestellten Rechnung, mit eingebetteter E-Rechnung (ZUGFeRD, bei Behörden XRechnung). */
export async function pdfErzeugen(r: Rechnung): Promise<Buffer> {
  const { rechnung } = await einstellungen();
  const daten = await gestellteDaten(r);
  const pdf = await rechnungPdf({
    ...daten,
    kundennummer: r.kunde?.nummer ?? null,
    fahrzeug: r.fahrzeug ?? {},
    einleitung: `Sehr geehrte Damen und Herren,\n${rechnung.einleitung}`,
    fusstext: rechnung.fusstext,
    bezahlt: r.status === "bezahlt",
  });
  return Buffer.from(await alsZugferd(new Uint8Array(pdf), zugferdXml(daten), daten.nummer));
}

/** Vorschau eines Entwurfs (ohne Nummer, ohne E-Rechnung). */
export async function vorschauPdf(r: Rechnung): Promise<Buffer> {
  const { firma, rechnung } = await einstellungen();
  // Korrekturentwurf: Vermerk und Verrechnung schon in der Vorschau, so wie sie nach dem Stellen aussehen
  const original = r.korrektur_zu ? await rechnungLaden(r.korrektur_zu) : null;
  return rechnungPdf({
    nummer: "ENTWURF",
    storno: false,
    korrektur_zu: original?.nummer ? { nummer: original.nummer, datum: original.rechnungsdatum } : null,
    korrektur_grund: r.korrektur_grund ?? "",
    bereits_bezahlt_cent: original ? bereitsBezahlt(original) : 0,
    rechnungsdatum: berlinDatum(),
    leistungsdatum: r.leistungsdatum,
    faellig_am: plusTage(berlinDatum(), rechnung.zahlungszielTage),
    hinweis: r.hinweis,
    positionen: r.positionen,
    empfaenger: r.empfaenger,
    firma,
    kundennummer: r.kunde?.nummer ?? null,
    fahrzeug: r.fahrzeug ?? {},
    einleitung: `Sehr geehrte Damen und Herren,\n${rechnung.einleitung}`,
    fusstext: rechnung.fusstext,
    bezahlt: false,
  });
}

export function dateiname(r: Pick<Rechnung, "nummer" | "storno_zu">, endung: "pdf" | "xml" = "pdf"): string {
  // Punkt erlaubt: Die Fassung einer Korrektur (RE-2026-0001.1) soll im Dateinamen erkennbar bleiben.
  return `${r.storno_zu ? "Stornorechnung" : "Rechnung"}-${(r.nummer ?? "Entwurf").replace(/[^A-Za-z0-9.-]/g, "_")}.${endung}`;
}

/**
 * Sendet eine gestellte Rechnung per Mail. Eine Korrektur geht mit der Stornorechnung ihres Originals im
 * Anhang: Wer das Original bekommen hat, braucht beide, um es auszubuchen.
 */
export async function versenden(id: string, an: string, vonBenutzer: string): Promise<void> {
  const r = await rechnungLaden(id);
  if (!r || r.status === "entwurf") throw new Error("Bitte die Rechnung zuerst stellen.");
  const { firma } = await einstellungen();
  const pdf = await pdfErzeugen(r);
  const xrechnung = istXRechnung(r);
  const link = `${ENV.siteUrl}/r/${r.token}`;
  const storno = Boolean(r.storno_zu);
  const b = await bezuegeLaden(r);
  const korrektur = r.korrektur_zu && b.original?.nummer ? b.original : null;
  const stornoDazu = korrektur && b.stornoDesOriginals ? await rechnungLaden(b.stornoDesOriginals.id) : null;
  const bereits = r.bereits_bezahlt_cent ?? 0;
  const offen = offenerBetrag(r);
  // Nur zur Zahlung auffordern, solange etwas offen ist: nicht bei Storno, bezahlt, storniert oder verrechnet.
  const zahlen = !storno && r.status === "gestellt" && offen > 0;
  const ueberschrift = storno ? `Stornorechnung ${r.nummer}` : korrektur ? `Ihre berichtigte Rechnung ${r.nummer}` : `Ihre Rechnung ${r.nummer}`;
  const einleitung = storno
    ? "anbei die Stornorechnung."
    : korrektur
      ? `anbei die berichtigte Rechnung. Sie ersetzt unsere Rechnung ${korrektur.nummer}${korrektur.rechnungsdatum ? ` vom ${datum(korrektur.rechnungsdatum)}` : ""}${
          stornoDazu ? `, die wir mit der ebenfalls angehängten Stornorechnung ${stornoDazu.nummer} storniert haben` : ""
        }.${r.korrektur_grund ? ` Grund: ${r.korrektur_grund}.` : ""}`
      : "vielen Dank für Ihren Auftrag. Ihre Rechnung hängt als PDF an dieser Mail.";
  const { html, text } = mail(firma, {
    ueberschrift,
    bausteine: [
      { art: "absatz", text: `Hallo ${r.empfaenger.name},\n${einleitung}` },
      {
        art: "fakten",
        zeilen: [
          ["Rechnungsnummer", r.nummer!],
          ["Betrag", euro(r.summe_brutto_cent)],
          ...(bereits ? ([["Bereits bezahlt", euro(bereits)], [offen < 0 ? "Wird erstattet" : "Noch offen", euro(Math.abs(offen))]] as [string, string][]) : []),
          ...(zahlen && r.faellig_am ? ([["Zahlbar bis", datum(r.faellig_am)]] as [string, string][]) : []),
          ...(r.fahrzeug?.kennzeichen ? ([["Fahrzeug", r.fahrzeug.kennzeichen]] as [string, string][]) : []),
        ],
      },
      ...(zahlen && firma.iban
        ? [{ art: "absatz" as const, text: `Bitte überweisen Sie ${bereits ? `${euro(offen)} ` : ""}auf ${firma.iban} mit dem Verwendungszweck ${r.nummer}. Auf dem PDF ist ein QR-Code für Ihre Banking-App.` }]
        : []),
      { art: "knopf", text: "Rechnung online ansehen", url: link },
      {
        art: "absatz",
        text: xrechnung
          ? "Die Rechnung liegt zusätzlich als XRechnung (XML, Version 3.0) bei; dieselbe XML ist auch im PDF eingebettet."
          : "Geschäftskunden: Das PDF enthält die Rechnung zusätzlich als E-Rechnung (ZUGFeRD, EN 16931).",
      },
    ],
  });
  const ergebnis = await mailer().senden({
    an,
    betreff: `${storno ? "Stornorechnung" : korrektur ? "Berichtigte Rechnung" : "Rechnung"} ${r.nummer} von ${firma.name}`,
    html,
    text,
    antwortAn: firma.email,
    anhaenge: [
      { dateiname: dateiname(r), inhalt: pdf, typ: "application/pdf" },
      ...(xrechnung ? [{ dateiname: dateiname(r, "xml"), inhalt: Buffer.from(await xmlErzeugen(r), "utf8"), typ: "application/xml" }] : []),
      ...(stornoDazu ? [{ dateiname: dateiname(stornoDazu), inhalt: await pdfErzeugen(stornoDazu), typ: "application/pdf" }] : []),
      ...(stornoDazu && xrechnung ? [{ dateiname: dateiname(stornoDazu, "xml"), inhalt: Buffer.from(await xmlErzeugen(stornoDazu), "utf8"), typ: "application/xml" }] : []),
    ],
  });
  if (!ergebnis.ok) throw new Error(`Die Mail wurde nicht versendet: ${ergebnis.fehler}`);
  await db().from("rechnungen").update({ gesendet_am: new Date().toISOString(), gesendet_an: an }).eq("id", id);
  await verlauf("rechnung", id, `Per E-Mail an ${an} gesendet${stornoDazu ? ` (mit Stornorechnung ${stornoDazu.nummer})` : ""}`, vonBenutzer);
  if (stornoDazu) {
    await db().from("rechnungen").update({ gesendet_am: new Date().toISOString(), gesendet_an: an }).eq("id", stornoDazu.id);
    await verlauf("rechnung", stornoDazu.id, `Mit der berichtigten Rechnung ${r.nummer} an ${an} gesendet`, vonBenutzer);
  }
  await melden("rechnung.versendet", { ...ereignisDaten(r), an });
}

export async function alsBezahlt(id: string, zahlungsart: "bar" | "ueberweisung", am: string, vonBenutzer: string): Promise<void> {
  const { data, error } = await db()
    .from("rechnungen")
    .update({ status: "bezahlt", zahlungsart, bezahlt_am: am })
    .eq("id", id)
    .eq("status", "gestellt")
    .select("id");
  if (error) throw new DbFehler(error);
  if (!data?.length) throw new Error("Nur offene Rechnungen lassen sich als bezahlt markieren.");
  await verlauf("rechnung", id, `Bezahlt (${zahlungsart === "bar" ? "bar" : "Überweisung"}) am ${datum(am)}`, vonBenutzer);
  const r = (await rechnungLaden(id))!;
  await melden("rechnung.bezahlt", { ...ereignisDaten(r), zahlungsart, bezahlt_am: am });
}

/**
 * Nimmt eine versehentlich vermerkte Zahlung zurück. Die Rechnung selbst bleibt unverändert, nur Status,
 * Zahlungsart und Datum gehen auf offen zurück. Der Verlauf behält beide Einträge, damit nachvollziehbar
 * bleibt, dass die Rechnung zwischendurch als bezahlt galt.
 */
export async function alsUnbezahlt(id: string, vonBenutzer: string): Promise<void> {
  const { data, error } = await db()
    .from("rechnungen")
    .update({ status: "gestellt", zahlungsart: null, bezahlt_am: null })
    .eq("id", id)
    .eq("status", "bezahlt")
    .select("id");
  if (error) throw new DbFehler(error);
  if (!data?.length) throw new Error("Nur bezahlte Rechnungen lassen sich als nicht bezahlt markieren.");
  await verlauf("rechnung", id, "Zahlung zurückgenommen, wieder offen", vonBenutzer);
  const r = (await rechnungLaden(id))!;
  await melden("rechnung.unbezahlt", ereignisDaten(r));
}

/**
 * Storno: eine eigene Rechnung mit negativen Beträgen und eigener Nummer, die auf das Original verweist.
 * Das Original bleibt unverändert erhalten (GoBD) und bekommt nur den Status „storniert“.
 * `korrekturGrund`: Das Storno gehört zu einer Korrektur und nennt deren Grund.
 */
export async function stornieren(id: string, vonBenutzer: string, korrekturGrund = ""): Promise<string> {
  const r = await rechnungLaden(id);
  if (!r || !["gestellt", "bezahlt"].includes(r.status) || r.storno_zu) throw new Error("Diese Rechnung kann nicht storniert werden.");
  const stornoId = await entwurfAnlegen(
    {
      kunde_id: r.kunde_id,
      termin_id: r.termin_id,
      empfaenger: r.empfaenger,
      fahrzeug: r.fahrzeug,
      leistungsdatum: r.leistungsdatum,
      positionen: vorzeichenWechseln(r.positionen),
      hinweis: korrekturGrund ? `Storno zu Rechnung ${r.nummer}. Grund: ${korrekturGrund}. Eine berichtigte Rechnung folgt.` : `Storno zu Rechnung ${r.nummer}`,
    },
    vonBenutzer,
  );
  await db().from("rechnungen").update({ storno_zu: id }).eq("id", stornoId);
  const nummer = await stellen(stornoId, vonBenutzer);
  await db().from("rechnungen").update({ status: "storniert" }).eq("id", id);
  await verlauf("rechnung", id, `Storniert durch ${nummer}`, vonBenutzer);
  await melden("rechnung.storniert", { ...ereignisDaten(r), storno_nummer: nummer });
  return stornoId;
}
