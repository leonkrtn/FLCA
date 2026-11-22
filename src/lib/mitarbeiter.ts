import "server-only";
import { einstellungen, type Fenster } from "./einstellungen";
import { neueLeistungGesperrt, type PersonBelegung, type PlanAbwesenheit, type PlanPerson, sollMinuten, urlaubstage, type Woche } from "./planung";
import { db, pruefe } from "./supabase/admin";
import { berlin, berlinDatum, plusTage } from "./zeit";
import { fehlerMelden } from "./fehler";
import { nettoMinuten, type Zeiteintrag } from "./zeiterfassung";

/**
 * Daten der Mitarbeiterplanung aus der Datenbank. Gerechnet wird in planung.ts (ohne Datenbank, getestet).
 */

type Profil = { id: string; name: string; email: string; nimmt_auftraege: boolean; aktiv: boolean; erstellt_am: string };

/**
 * Personen für die Planung im Datumsbereich [von, bis]. `nurAuftraege`: nur wer planbar ist (Website,
 * automatische Zuteilung). Planbar sind alle mit der Rolle Mitarbeiter und wen die Werkstatt dazu schaltet
 * (Spalte nimmt_auftraege, gesetzt nur von Inhaber und Büro). `nur`: nur diese Personen laden. Die Farbe hängt an der Reihenfolge der Anlage, damit sie sich nicht verschiebt,
 * wenn jemand umbenannt wird.
 */
export async function planPersonen(von: string, bis: string, nurAuftraege = true, nur?: string[]): Promise<PlanPerson[]> {
  let q = db().from("profile").select("id, name, email, nimmt_auftraege, aktiv, erstellt_am").eq("aktiv", true).not("rolle", "is", null).order("erstellt_am");
  if (nurAuftraege) q = q.eq("nimmt_auftraege", true);
  if (nur) q = q.in("id", nur);
  const profile = pruefe<Profil[]>(await q);
  if (!profile.length) return [];
  const ids = profile.map((p) => p.id);
  const [zeiten, ausnahmen, abw, sperren, reihenfolge, { oeffnungszeiten }] = await Promise.all([
    db().from("arbeitszeiten").select("profil_id, wochentag, beginn, ende, woche").in("profil_id", ids),
    db().from("arbeitszeit_ausnahmen").select("profil_id, datum, fenster").in("profil_id", ids).gte("datum", von).lte("datum", bis),
    db().from("abwesenheiten").select("profil_id, art, von, bis, von_zeit, bis_zeit").in("profil_id", ids).eq("status", "genehmigt").lte("von", bis).gte("bis", von),
    db().from("leistung_sperren").select("profil_id, leistung_id").in("profil_id", ids),
    farbReihenfolge(),
    einstellungen(),
  ]);
  // Wer noch keinen eigenen Plan hat, arbeitet zu den Öffnungszeiten. Sonst nähme das Häkchen „nimmt Aufträge
  // an“ ohne eingetragene Zeiten der Website alle freien Termine weg.
  const ausOeffnung = Object.entries(oeffnungszeiten).flatMap(([tag, fenster]) => fenster.map(([beginn, ende]) => ({ wochentag: Number(tag), beginn, ende, woche: "jede" as Woche })));
  return profile.map((p) => {
    const eigen = (zeiten.data ?? [])
      .filter((z) => z.profil_id === p.id)
      .map((z) => ({ wochentag: z.wochentag as number, beginn: z.beginn as string, ende: z.ende as string, woche: (z.woche as Woche | undefined) ?? "jede" }));
    return {
      id: p.id,
      name: p.name || p.email,
      farbe: reihenfolge.indexOf(p.id),
      nimmtAuftraege: p.nimmt_auftraege,
      planAusOeffnung: !eigen.length,
      wochenplan: eigen.length ? eigen : ausOeffnung,
      ausnahmen: Object.fromEntries((ausnahmen.data ?? []).filter((a) => a.profil_id === p.id).map((a) => [a.datum as string, a.fenster as Fenster[]])),
      abwesenheiten: (abw.data ?? []).filter((a) => a.profil_id === p.id) as unknown as PlanAbwesenheit[],
      gesperrt: (sperren.data ?? []).filter((s) => s.profil_id === p.id).map((s) => s.leistung_id as string),
    };
  });
}

/** Reihenfolge für die Farben: alle Planbaren, nach Anlage. */
async function farbReihenfolge(): Promise<string[]> {
  const { data } = await db().from("profile").select("id").eq("nimmt_auftraege", true).order("erstellt_am");
  return (data ?? []).map((p) => p.id as string);
}

/** Ist überhaupt jemand planbar? Sonst gilt wie früher nur die Zahl der Arbeitsplätze. */
export async function planungAktiv(): Promise<boolean> {
  const { count } = await db().from("profile").select("id", { count: "exact", head: true }).eq("nimmt_auftraege", true).eq("aktiv", true);
  return (count ?? 0) > 0;
}

/**
 * Belegte Zeiten mit Person: bestätigte Termine und Anfragen, deren Haltezeit noch läuft (wie belegung_max und
 * person_belegt in der Datenbank).
 */
export async function belegungenMitPerson(von: Date, bis: Date): Promise<(PersonBelegung & { id: string; titel: string })[]> {
  const termine = await db()
    .from("termine")
    .select("id, beginn, belegt_bis, status, halten_bis, zugewiesen_an, leistung_name")
    .in("status", ["angefragt", "bestaetigt"])
    .lt("beginn", bis.toISOString())
    .gt("belegt_bis", von.toISOString());
  const jetzt = Date.now();
  type Zeile = { id: string; beginn: string; belegt_bis: string; status: string; halten_bis: string | null; zugewiesen_an: string | null; leistung_name: string };
  return pruefe<Zeile[]>(termine)
    .filter((t) => t.status === "bestaetigt" || !t.halten_bis || new Date(t.halten_bis).getTime() > jetzt)
    .map((t) => ({ id: t.id, beginn: new Date(t.beginn).getTime(), bis: new Date(t.belegt_bis).getTime(), gewicht: 1, profil: t.zugewiesen_an, titel: t.leistung_name }));
}

/** Belegungen eines ganzen Tages (Berliner Datum). */
export const belegungenAm = (datum: string) => belegungenMitPerson(berlin(datum), berlin(plusTage(datum, 1)));

/** Namen der Leistungen nach ID (für lesbare Warnungen). */
export async function leistungNamen(ids: string[]): Promise<Record<string, string>> {
  if (!ids.length) return {};
  const { data } = await db().from("leistungen").select("id, name").in("id", ids);
  return Object.fromEntries((data ?? []).map((l) => [l.id as string, l.name as string]));
}

/**
 * Bestätigte künftige Termine ohne Mitarbeiter (Zähler „Kalender“ in der Verwaltung). Nur, wenn die Planung läuft:
 * Sonst hätte jeder Termin keinen und der Zähler wäre nur Lärm.
 */
export async function ohneMitarbeiterAnzahl(): Promise<number> {
  try {
    if (!(await planungAktiv())) return 0;
    const { count } = await db()
      .from("termine")
      .select("id", { count: "exact", head: true })
      .is("zugewiesen_an", null)
      // Nur bestätigte: Anfragen bekommen beim Annehmen automatisch jemanden und zählen schon unter „Termine“.
      .eq("status", "bestaetigt")
      .gte("beginn", new Date().toISOString());
    return count ?? 0;
  } catch (fehler) {
    await fehlerMelden(fehler, "Menü-Zähler Termine ohne Mitarbeiter");
    return 0;
  }
}

/** Planbar: Mitarbeiter immer, Inhaber und Büro nur, wenn die Werkstatt sie dazu schaltet. */
export const istPlanbar = (rolle: string | null, zugeschaltet: boolean) => rolle === "mitarbeiter" || zugeschaltet;

export type Zeitkonto = {
  /** Soll des ganzen Monats laut Wochenplan; null ohne eigenen Plan */
  sollMonat: number | null;
  /** Gearbeitet im Monat (ohne Pausen, laufend bis jetzt) */
  istMonat: number;
  /** Ist minus Soll im Monat bis gestern; null ohne Plan */
  saldoMonat: number | null;
  /** Ist minus Soll seit dem ersten Zeiteintrag bis gestern; null ohne Plan */
  saldoGesamt: number | null;
  seit: string | null;
};

/**
 * Zeitkonto einer Person: Soll aus dem Wochenplan (Urlaub, krank und Ausnahmen eingerechnet), Ist aus der
 * Zeiterfassung. Der Saldo zählt bis gestern, damit ein angefangener Tag nicht als Minus erscheint.
 */
export async function zeitkonto(profilId: string, monat: string): Promise<Zeitkonto> {
  const heute = berlinDatum();
  const gestern = plusTage(heute, -1);
  const monatsbeginn = `${monat}-01`;
  const [j, m] = monat.split("-").map(Number);
  const monatsende = plusTage(new Date(Date.UTC(j, m, 1)).toISOString().slice(0, 10), -1);
  const { data: erster } = await db().from("zeiteintraege").select("beginn").eq("profil_id", profilId).order("beginn").limit(1).maybeSingle();
  const seit = erster ? berlinDatum(new Date(erster.beginn)) : null;
  const von = seit && seit < monatsbeginn ? seit : monatsbeginn;
  const [[plan], { data }] = await Promise.all([
    planPersonen(von, monatsende > heute ? monatsende : heute, false, [profilId]),
    db().from("zeiteintraege").select("*").eq("profil_id", profilId).gte("beginn", berlin(von).toISOString()).lt("beginn", berlin(plusTage(monatsende, 1)).toISOString()),
  ]);
  const eintraege = (data ?? []) as Zeiteintrag[];
  const tag = (e: Zeiteintrag) => berlinDatum(new Date(e.beginn));
  const ist = (von: string, bis: string) => eintraege.filter((e) => tag(e) >= von && tag(e) <= bis).reduce((s, e) => s + nettoMinuten(e), 0);
  const soll = (von: string, bis: string) => (!plan ? null : bis < von ? 0 : sollMinuten(plan, von, bis));
  const bisMonat = monatsende < gestern ? monatsende : gestern;
  const sollBis = soll(monatsbeginn, bisMonat);
  const sollGesamt = seit ? soll(seit, gestern) : null;
  return {
    sollMonat: soll(monatsbeginn, monatsende),
    istMonat: Math.round(ist(monatsbeginn, monatsende)),
    saldoMonat: sollBis === null ? null : Math.round(ist(monatsbeginn, bisMonat) - sollBis),
    saldoGesamt: sollGesamt === null || !seit ? null : Math.round(ist(seit, gestern) - sollGesamt),
    seit,
  };
}

export type Urlaubskonto = { anspruch: number; genehmigt: number; beantragt: number; rest: number; krank: number };

/** Urlaubskonto je Person für ein Jahr: gezählt werden Arbeitstage laut Wochenplan, halbe Tage zu 0,5. */
export async function urlaubKonten(jahr: string, nur?: string[]): Promise<Map<string, Urlaubskonto>> {
  let pq = db().from("profile").select("id, urlaubstage").eq("aktiv", true).not("rolle", "is", null);
  let aq = db().from("abwesenheiten").select("profil_id, art, von, bis, von_zeit, status").neq("status", "abgelehnt").lte("von", `${jahr}-12-31`).gte("bis", `${jahr}-01-01`);
  if (nur) {
    pq = pq.in("id", nur);
    aq = aq.in("profil_id", nur);
  }
  const [plan, { data: profile }, { data: abw }] = await Promise.all([planPersonen(`${jahr}-01-01`, `${jahr}-12-31`, false, nur), pq, aq]);
  const konten = new Map<string, Urlaubskonto>();
  for (const p of (profile ?? []) as { id: string; urlaubstage: number }[]) {
    const pp = plan.find((x) => x.id === p.id) ?? { wochenplan: [], ausnahmen: {} };
    const eigene = ((abw ?? []) as (Pick<PlanAbwesenheit, "art" | "von" | "bis" | "von_zeit"> & { profil_id: string; status: string })[]).filter((a) => a.profil_id === p.id);
    const summe = (art: string, status: string) => eigene.filter((a) => a.art === art && a.status === status).reduce((s, a) => s + urlaubstage(pp, a, jahr), 0);
    const genehmigt = summe("urlaub", "genehmigt");
    const beantragt = summe("urlaub", "beantragt");
    konten.set(p.id, { anspruch: p.urlaubstage ?? 0, genehmigt, beantragt, rest: (p.urlaubstage ?? 0) - genehmigt - beantragt, krank: summe("krank", "genehmigt") });
  }
  return konten;
}

/**
 * Neue Leistung in der Preisliste: Sie gilt wie ihre Kategorie (siehe neueLeistungGesperrt). Wer die meisten
 * Leistungen der Kategorie nicht darf, bekommt auch die neue gesperrt.
 */
export async function sperrenFuerNeueLeistung(leistungId: string, kategorie: string): Promise<void> {
  const [{ data: geschwister }, { data: sperren }] = await Promise.all([
    db().from("leistungen").select("id").eq("kategorie", kategorie).neq("id", leistungId),
    db().from("leistung_sperren").select("profil_id, leistung_id"),
  ]);
  const ids = (geschwister ?? []).map((l) => l.id as string);
  if (!ids.length) return;
  const jePerson = new Map<string, string[]>();
  for (const s of sperren ?? []) jePerson.set(s.profil_id as string, [...(jePerson.get(s.profil_id as string) ?? []), s.leistung_id as string]);
  const neu = [...jePerson.entries()].filter(([, g]) => neueLeistungGesperrt(ids, g)).map(([profil_id]) => ({ profil_id, leistung_id: leistungId }));
  if (neu.length) await db().from("leistung_sperren").upsert(neu, { onConflict: "profil_id,leistung_id" });
}
