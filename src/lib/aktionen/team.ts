"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { benutzerMitRecht } from "../auth";
import { ENV } from "../env";
import { melden } from "../ereignisse";
import { type Ergebnis, ja, text, zahl } from "../forms";
import { sicher } from "../sicher";
import { mail } from "../email/vorlagen";
import { einstellungen, einstellungenSpeichern, type Fenster } from "../einstellungen";
import { mailer } from "../services/email";
import { pushSenden } from "../services/push";
import type { Rolle } from "../rollen";
import { abstandM, abstandText, vorOrt } from "../standort";
import { db, DbFehler, dbRoh } from "../supabase/admin";
import { nachAbwesenheitUmverteilen, PlanungsWarnung, terminLaden, uebernehmen } from "../termine";
import { weich } from "../fehler";
import { istPlanbar } from "../mitarbeiter";
import { mailNamePruefen } from "../mail/postfach";
import { zeitStarten, zeitStoppen } from "../werkstatt";
import { nachFertig } from "../auftrag";
import { berlin, berlinUhrzeit, istDatum, plusTage } from "../zeit";

const ROLLEN: Rolle[] = ["inhaber", "buero", "mitarbeiter"];
const UHR = /^([01]\d|2[0-3]):[0-5]\d$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Koordinate als Dezimalzahl: Punkt oder Komma, nie Tausendertrennung („8.789“ ist 8,789 und nicht 8789). */
function koordinate(fd: FormData, name: string): number | null {
  const t = text(fd, name, 30).replace(",", ".");
  const n = t ? Number(t) : NaN;
  return Number.isFinite(n) ? n : null;
}

function neu() {
  revalidatePath("/admin/mitarbeiter", "layout");
  revalidatePath("/admin/kalender");
  revalidatePath("/team", "layout");
}

/** Neue Person einladen: Supabase schickt die Einladung, das Profil bekommt die Rolle sofort. */
export async function einladen(_v: Ergebnis, fd: FormData): Promise<Ergebnis> {
  return sicher(fd, async () => {
    await benutzerMitRecht("benutzer");
    const email = text(fd, "email", 160).toLowerCase();
    const name = text(fd, "name", 120);
    const rolle = text(fd, "rolle") as Rolle;
    if (!email || !name || !ROLLEN.includes(rolle)) return { status: "fehler", meldung: "Bitte Name, E-Mail und Rolle angeben." };
    const { data, error } = await db().auth.admin.inviteUserByEmail(email, { data: { name }, redirectTo: `${ENV.siteUrl}/login/passwort-setzen` });
    if (error) return { status: "fehler", meldung: error.message.includes("already") ? "Diese Adresse hat schon ein Konto." : error.message };
    const { error: fehler } = await db()
      .from("profile")
      .update({ name, rolle, zeiterfassung: ja(fd, "zeiterfassung"), nimmt_auftraege: istPlanbar(rolle, ja(fd, "nimmt_auftraege")) })
      .eq("id", data.user.id);
    if (fehler) throw new DbFehler(fehler);
    neu();
    return { status: "ok", meldung: `Einladung an ${email} ist unterwegs.` };
  });
}

/** Personalsachen (Rolle, Konto, Urlaubsanspruch, Zeiterfassung): nur der Inhaber. */
export async function profilSpeichern(id: string, _v: Ergebnis, fd: FormData): Promise<Ergebnis> {
  return sicher(fd, async () => {
    const b = await benutzerMitRecht("personal");
    const rolle = text(fd, "rolle") as Rolle;
    if (!ROLLEN.includes(rolle)) return { status: "fehler", meldung: "Ungültige Rolle." };
    if (id === b.id && (rolle !== "inhaber" || !ja(fd, "aktiv"))) return { status: "fehler", meldung: "Sie können sich nicht selbst die Inhaber-Rolle nehmen." };
    const name = text(fd, "name", 120);
    // Leer = vorname.nachname aus dem Namen
    const mailName = text(fd, "mail_name", 64).toLowerCase().replace(/@.*$/, "") || null;
    const mailFehler = await mailNamePruefen(id, name, mailName);
    if (mailFehler) return { status: "fehler", meldung: mailFehler, fehler: { mail_name: mailFehler } };
    const { error } = await db()
      .from("profile")
      .update({
        name,
        mail_name: mailName,
        telefon: text(fd, "telefon", 40),
        rolle,
        aktiv: ja(fd, "aktiv"),
        zeiterfassung: ja(fd, "zeiterfassung"),
        // Mitarbeiter sind immer planbar; das entscheidet die Werkstatt, nicht die Person
        nimmt_auftraege: istPlanbar(rolle, ja(fd, "nimmt_auftraege")),
        urlaubstage: Math.round(zahl(fd, "urlaubstage") ?? 0),
      })
      .eq("id", id);
    if (error) throw new DbFehler(error);
    neu();
    return { status: "ok", meldung: "Gespeichert." };
  });
}

/** Inhaber oder Büro in der Werkstatt einplanen (Mitarbeiter sind es immer). Darf auch das Büro. */
export async function einplanenSpeichern(id: string, _v: Ergebnis, fd: FormData): Promise<Ergebnis> {
  return sicher(fd, async () => {
    await benutzerMitRecht("team");
    const { data: p } = await db().from("profile").select("rolle").eq("id", id).maybeSingle();
    if (!p) return { status: "fehler", meldung: "Person nicht gefunden." };
    const an = istPlanbar(p.rolle, ja(fd, "nimmt_auftraege"));
    await db().from("profile").update({ nimmt_auftraege: an }).eq("id", id);
    neu();
    return { status: "ok", meldung: an ? "Wird in der Werkstatt eingeplant." : "Wird nicht mehr eingeplant." };
  });
}

/**
 * Arbeitszeiten als Wochenplan (je Tag bis zu zwei Zeitfenster). Mit „wechselnde Wochen“ gibt es zwei Pläne:
 * einen für gerade und einen für ungerade Kalenderwochen (z. B. jeder zweite Samstag).
 */
export async function arbeitszeitenSpeichern(id: string, _v: Ergebnis, fd: FormData): Promise<Ergebnis> {
  return sicher(fd, async () => {
    await benutzerMitRecht("team");
    const wechsel = ja(fd, "wechsel");
    const plaene: [string, "jede" | "gerade" | "ungerade"][] = wechsel ? [["a", "gerade"], ["b", "ungerade"]] : [["a", "jede"]];
    const zeilen: { profil_id: string; wochentag: number; beginn: string; ende: string; woche: string }[] = [];
    for (const [plan, woche] of plaene) {
      for (let t = 1; t <= 7; t++) {
        for (const n of [1, 2]) {
          const a = text(fd, `${plan}_t${t}_${n}_von`, 5);
          const e = text(fd, `${plan}_t${t}_${n}_bis`, 5);
          if (!a && !e) continue;
          if (!UHR.test(a) || !UHR.test(e)) return { status: "fehler", meldung: "Bitte bei jedem Zeitfenster Beginn und Ende angeben." };
          if (e <= a) return { status: "fehler", meldung: "Ein Zeitfenster endet vor seinem Beginn." };
          zeilen.push({ profil_id: id, wochentag: t, beginn: a, ende: e, woche });
        }
      }
    }
    await db().from("arbeitszeiten").delete().eq("profil_id", id);
    if (zeilen.length) {
      const { error } = await db().from("arbeitszeiten").insert(zeilen);
      if (error) throw new DbFehler(error);
    }
    neu();
    return { status: "ok", meldung: "Arbeitszeiten gespeichert. Freie Termine auf der Website richten sich sofort danach." };
  });
}

/** Zeitfenster aus Feldern „von_1/bis_1/von_2/bis_2“; null bei Fehler. */
function fensterAus(fd: FormData): Fenster[] | null {
  const f: Fenster[] = [];
  for (const n of [1, 2]) {
    const a = text(fd, `von_${n}`, 5);
    const e = text(fd, `bis_${n}`, 5);
    if (!a && !e) continue;
    if (!UHR.test(a) || !UHR.test(e) || e <= a) return null;
    f.push([a, e]);
  }
  return f.sort((x, y) => x[0].localeCompare(y[0]));
}

/** Abweichende Arbeitszeit an einem Datum; ohne Zeiten = an dem Tag frei. */
export async function ausnahmeSpeichern(id: string, _v: Ergebnis, fd: FormData): Promise<Ergebnis> {
  return sicher(fd, async () => {
    await benutzerMitRecht("team");
    const datum = text(fd, "datum", 10);
    const bis = text(fd, "datum_bis", 10) || datum;
    if (!istDatum(datum) || !istDatum(bis) || bis < datum) return { status: "fehler", meldung: "Bitte ein gültiges Datum angeben." };
    const fenster = fensterAus(fd);
    if (!fenster) return { status: "fehler", meldung: "Bitte die Zeiten prüfen (Beginn vor Ende)." };
    const tage: string[] = [];
    // Ein Zeitraum (z. B. eine Woche nur vormittags) wird zu einer Ausnahme je Tag, höchstens zwei Monate.
    for (let d = datum; d <= bis && tage.length < 62; d = plusTage(d, 1)) tage.push(d);
    const { error } = await db()
      .from("arbeitszeit_ausnahmen")
      .upsert(tage.map((d) => ({ profil_id: id, datum: d, fenster, notiz: text(fd, "notiz", 200) })), { onConflict: "profil_id,datum" });
    if (error) throw new DbFehler(error);
    neu();
    return { status: "ok", meldung: fenster.length ? "Abweichende Zeit gespeichert." : "Als frei eingetragen." };
  });
}

export async function ausnahmeLoeschen(id: string, _v: Ergebnis): Promise<Ergebnis> {
  return sicher(null, async () => {
    await benutzerMitRecht("team");
    await db().from("arbeitszeit_ausnahmen").delete().eq("id", id);
    neu();
    return { status: "ok", meldung: "Gelöscht. Es gilt wieder der Wochenplan." };
  });
}

/**
 * Was eine Person machen darf: Häkchen = darf. Gespeichert wird, was sie NICHT darf, damit neue Leistungen
 * automatisch für alle gelten. `profil` = eine Person (Personenseite), sonst die ganze Matrix (Übersicht).
 */
export async function faehigkeitenSpeichern(profil: string | null, _v: Ergebnis, fd: FormData): Promise<Ergebnis> {
  return sicher(fd, async () => {
    await benutzerMitRecht("team");
    const leistungen = fd.getAll("leistungen").filter((x): x is string => typeof x === "string" && UUID.test(x));
    const personen = profil ? [profil] : fd.getAll("personen").filter((x): x is string => typeof x === "string" && UUID.test(x));
    if (!leistungen.length || !personen.length) return { status: "fehler", meldung: "Nichts zu speichern." };
    const gesperrt = personen.flatMap((p) => leistungen.filter((l) => !ja(fd, `darf_${p}_${l}`)).map((l) => ({ profil_id: p, leistung_id: l })));
    await db().from("leistung_sperren").delete().in("profil_id", personen).in("leistung_id", leistungen);
    if (gesperrt.length) {
      const { error } = await db().from("leistung_sperren").insert(gesperrt);
      if (error) throw new DbFehler(error);
    }
    neu();
    return { status: "ok", meldung: "Fähigkeiten gespeichert." };
  });
}

/**
 * Gilt eine Abwesenheit, gehen die Termine der Person an andere (siehe termine.ts). `vorgaben`: auf der
 * Antragsseite gewählt, wer welchen Termin übernimmt.
 */
async function abwesenheitWirkt(
  a: { profil_id: string; art: string; von: string; bis: string; von_zeit: string | null; bis_zeit: string | null },
  von: string | null,
  vorgaben?: Map<string, string | null>,
) {
  const { umverteilt, offen, abweichend } = await nachAbwesenheitUmverteilen(a.profil_id, a, von, vorgaben);
  after(() => melden("abwesenheit.eingetragen", { ...a, termine_umverteilt: umverteilt, termine_ohne_mitarbeiter: offen }));
  if (!umverteilt && !offen) return "";
  return [
    umverteilt ? ` ${umverteilt} ${umverteilt === 1 ? "Termin" : "Termine"} an Kollegen gegeben.` : "",
    offen ? ` ${offen} ${offen === 1 ? "Termin braucht" : "Termine brauchen"} jemand Neues (Kalender).` : "",
    abweichend ? ` ${abweichend === 1 ? "Eine Wahl passte" : `${abweichend} Wahlen passten`} inzwischen nicht mehr und ${abweichend === 1 ? "wurde" : "wurden"} automatisch vergeben.` : "",
  ].join("");
}

/**
 * Wer welchen Termin übernimmt, aus der Antragsseite: Feld `person_<Termin>` mit einer Person oder leer (ohne
 * Mitarbeiter lassen). Nur wer eingeplant wird und aktiv ist; alles andere fällt weg und wird automatisch verteilt.
 */
async function vorgabenAus(fd: FormData, ausser: string): Promise<Map<string, string | null>> {
  const roh = [...fd.entries()].flatMap(([k, v]) => {
    const id = k.startsWith("person_") ? k.slice(7) : "";
    return UUID.test(id) && typeof v === "string" && (v === "" || UUID.test(v)) ? [[id, v || null] as const] : [];
  });
  if (!roh.length) return new Map();
  const { data } = await db().from("profile").select("id").eq("aktiv", true).eq("nimmt_auftraege", true);
  const planbar = new Set((data ?? []).map((p) => p.id as string));
  return new Map(roh.filter(([, p]) => p === null || (p !== ausser && planbar.has(p))));
}

export async function abwesenheitEntscheiden(id: string, _v: Ergebnis, fd: FormData): Promise<Ergebnis> {
  return sicher(fd, async () => {
    const b = await benutzerMitRecht("team");
    const status = fd.get("entscheidung") === "genehmigt" ? "genehmigt" : "abgelehnt";
    const { data } = await db()
      .from("abwesenheiten")
      .update({ status, entschieden_von: b.id })
      .eq("id", id)
      .eq("status", "beantragt")
      .select("profil_id, art, von, bis, von_zeit, bis_zeit")
      .maybeSingle();
    if (!data) return { status: "fehler", meldung: "Der Antrag wurde schon entschieden." };
    await pushSenden({ profile: [data.profil_id] }, { titel: status === "genehmigt" ? "Urlaub genehmigt" : "Urlaub abgelehnt", text: `${data.von} bis ${data.bis}`, url: "/team/abwesenheit" });
    const zusatz = status === "genehmigt" ? await abwesenheitWirkt(data, b.id, await vorgabenAus(fd, data.profil_id)) : "";
    neu();
    return { status: "ok", meldung: (status === "genehmigt" ? "Genehmigt." : "Abgelehnt.") + zusatz };
  });
}

/**
 * Abwesenheit beantragen (Team-App) oder durch den Inhaber eintragen (für eine andere Person). Mit Uhrzeit nur
 * für einen einzelnen Tag (halber Tag, Arzttermin).
 */
export async function abwesenheitMelden(fuer: string | null, _v: Ergebnis, fd: FormData): Promise<Ergebnis> {
  return sicher(fd, async () => {
    const b = await benutzerMitRecht(fuer ? "team" : "werkstatt");
    const art = (["urlaub", "krank", "sonstiges"].includes(text(fd, "art")) ? text(fd, "art") : "urlaub") as "urlaub" | "krank" | "sonstiges";
    const von = text(fd, "von", 10);
    const bis = text(fd, "bis", 10) || von;
    if (!istDatum(von) || !istDatum(bis) || bis < von) return { status: "fehler", meldung: "Bitte einen gültigen Zeitraum angeben." };
    const vonZeit = text(fd, "von_zeit", 5);
    const bisZeit = text(fd, "bis_zeit", 5);
    const stunden = Boolean(vonZeit || bisZeit);
    if (stunden && (!UHR.test(vonZeit) || !UHR.test(bisZeit) || bisZeit <= vonZeit)) return { status: "fehler", meldung: "Bitte bei einem halben Tag Beginn und Ende angeben." };
    if (stunden && bis !== von) return { status: "fehler", meldung: "Mit Uhrzeit geht es nur für einen einzelnen Tag." };
    const profil = fuer ?? b.id;
    const status = fuer || art === "krank" ? "genehmigt" : "beantragt";
    const zeile = { profil_id: profil, art, von, bis, von_zeit: stunden ? vonZeit : null, bis_zeit: stunden ? bisZeit : null };
    const notiz = text(fd, "notiz", 500);
    const { data: angelegt, error } = await db().from("abwesenheiten").insert({ ...zeile, status, notiz, entschieden_von: fuer ? b.id : null }).select("id").single();
    if (error) throw new DbFehler(error);
    // Ein Antrag öffnet sich mit Kollegen und Aufträgen im Zeitraum; eine Krankmeldung gilt schon und gehört in die Übersicht.
    const ansehen = status === "beantragt" ? `/admin/mitarbeiter/antrag/${angelegt.id}` : "/admin/mitarbeiter?ansicht=urlaub";
    const zeitraum = `${von}${bis !== von ? ` bis ${bis}` : ""}${stunden ? `, ${vonZeit}–${bisZeit} Uhr` : ""}`;
    // Krank gilt sofort: Termine gehen an Kollegen, bevor das Büro Bescheid bekommt, damit der Push sagt, was offen ist.
    const zusatz = status === "genehmigt" ? await abwesenheitWirkt(zeile, fuer ? b.id : null) : "";
    if (!fuer) {
      const { firma } = await einstellungen();
      const titel = art === "krank" ? `${b.name || b.email} ist krank gemeldet` : `${b.name || b.email} beantragt ${art === "urlaub" ? "Urlaub" : "frei"}`;
      await Promise.all([
        pushSenden({ rollen: ["inhaber", "buero"] }, { titel, text: `${zeitraum}${zusatz}`, url: zusatz.includes("jemand Neues") ? "/admin/kalender" : ansehen }),
        mailer().senden({
          an: firma.email,
          betreff: titel,
          ...mail(firma, {
            ueberschrift: titel,
            gruss: false,
            bausteine: [
              { art: "fakten", zeilen: [["Wann", zeitraum], ["Notiz", notiz || "–"], ...(zusatz ? [["Termine", zusatz.trim()] as [string, string]] : [])] },
              { art: "knopf", text: status === "beantragt" ? "Antrag ansehen" : "Bei den Mitarbeitern ansehen", url: `${ENV.siteUrl}${ansehen}` },
            ],
          }),
        }),
        melden("abwesenheit.beantragt", { profil_id: profil, art, von, bis, von_zeit: zeile.von_zeit, bis_zeit: zeile.bis_zeit }),
      ]);
    }
    neu();
    return { status: "ok", meldung: (art === "krank" ? "Gute Besserung. Die Meldung ist raus." : fuer ? "Eingetragen." : "Beantragt. Sie bekommen Bescheid.") + (fuer ? zusatz : "") };
  });
}

/** Eigenen, noch nicht entschiedenen Antrag zurückziehen (Team-App). */
export async function abwesenheitZurueckziehen(id: string, _v: Ergebnis): Promise<Ergebnis> {
  return sicher(null, async () => {
    const b = await benutzerMitRecht("werkstatt");
    const { data } = await db().from("abwesenheiten").delete().eq("id", id).eq("profil_id", b.id).eq("status", "beantragt").select("art, von, bis");
    if (!data?.length) return { status: "fehler", meldung: "Der Antrag ist schon entschieden. Bitte im Büro melden." };
    after(() =>
      pushSenden({ rollen: ["inhaber", "buero"] }, { titel: `${b.name || b.email} zieht den Antrag zurück`, text: `${data[0].von} bis ${data[0].bis}`, url: "/admin/mitarbeiter?ansicht=urlaub" }),
    );
    neu();
    return { status: "ok", meldung: "Zurückgezogen." };
  });
}

export async function abwesenheitLoeschen(id: string, _v: Ergebnis): Promise<Ergebnis> {
  return sicher(null, async () => {
    await benutzerMitRecht("team");
    await db().from("abwesenheiten").delete().eq("id", id);
    neu();
    return { status: "ok", meldung: "Gelöscht." };
  });
}

/** Standort der Werkstatt für „Einstempeln nur vor Ort“. */
export async function standortSpeichern(_v: Ergebnis, fd: FormData): Promise<Ergebnis> {
  return sicher(fd, async () => {
    await benutzerMitRecht("einstellungen");
    const lat = koordinate(fd, "lat");
    const lng = koordinate(fd, "lng");
    const nurVorOrt = ja(fd, "nurVorOrt");
    const gueltig = lat !== null && lng !== null && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
    if (nurVorOrt && !gueltig) return { status: "fehler", meldung: "Bitte zuerst den Standort der Werkstatt angeben (Breite und Länge)." };
    await einstellungenSpeichern("standort", {
      nurVorOrt,
      lat: gueltig ? lat : null,
      lng: gueltig ? lng : null,
      radiusM: Math.min(Math.max(Math.round(zahl(fd, "radiusM") ?? 150), 30), 2000),
    });
    neu();
    return { status: "ok", meldung: "Gespeichert." };
  });
}

/**
 * Stempeln: kommt/geht. Nur für Personen mit eingeschalteter Zeiterfassung. Ist „nur vor Ort“ eingeschaltet,
 * schickt das Handy beim Einstempeln seinen Standort mit; Ausstempeln geht immer (wer es vergisst, soll es
 * auch von unterwegs nachholen können).
 */
export async function stempeln(_v: Ergebnis, fd: FormData): Promise<Ergebnis> {
  return sicher(fd, async () => {
    const b = await benutzerMitRecht("werkstatt");
    if (!b.zeiterfassung) return { status: "fehler", meldung: "Für Sie ist keine Zeiterfassung eingeschaltet." };
    const { data: offen } = await db().from("zeiteintraege").select("*").eq("profil_id", b.id).is("ende", null).maybeSingle();
    if (offen) {
      const jetzt = new Date();
      // Läuft noch eine Pause, endet sie mit dem Ausstempeln; eine laufende Auftragszeit auch.
      const pause = offen.pause_seit ? { pause_minuten: (offen.pause_minuten ?? 0) + pausenMinuten(offen.pause_seit, jetzt), pause_seit: null } : {};
      await db().from("zeiteintraege").update({ ende: jetzt.toISOString(), ...pause }).eq("id", offen.id);
      await weich(zeitStoppen(b.id), undefined, "Auftragszeit beim Ausstempeln stoppen");
      await melden("zeit.gestempelt", { profil_id: b.id, art: "geht" });
      neu();
      return { status: "ok", meldung: "Ausgestempelt. Schönen Feierabend." };
    }
    const { standort } = await einstellungen();
    let abstand: number | null = null;
    if (standort.nurVorOrt && standort.lat !== null && standort.lng !== null) {
      const lat = koordinate(fd, "lat");
      const lng = koordinate(fd, "lng");
      if (lat === null || lng === null) {
        return { status: "fehler", meldung: text(fd, "ortfehler", 200) || "Ohne Standort geht Einstempeln nur in der Werkstatt. Bitte die Ortung für diese App erlauben." };
      }
      abstand = abstandM({ lat, lng }, { lat: standort.lat, lng: standort.lng });
      if (!vorOrt(abstand, koordinate(fd, "genauigkeit") ?? 0, standort.radiusM)) {
        // Der Inhaber soll Versuche von außerhalb mitbekommen. Nach der Antwort, damit die Meldung am Handy nicht
        // auf den Push wartet; gleicher tag je Person, damit mehrfaches Tippen nur eine Mitteilung hinterlässt.
        const entfernt = abstand;
        after(() =>
          weich(
            Promise.all([
              pushSenden(
                { rollen: ["inhaber"] },
                {
                  titel: `${b.name || b.email} will außerhalb einstempeln`,
                  text: `Etwa ${abstandText(entfernt)} von der Werkstatt entfernt, ${berlinUhrzeit(new Date())} Uhr. Einstempeln wurde gesperrt.`,
                  url: "/admin/mitarbeiter?ansicht=personen",
                  tag: `stempeln-ausserhalb-${b.id}`,
                },
              ),
              melden("zeit.ausserhalb", { profil_id: b.id, abstand_m: entfernt }),
            ]),
            undefined,
            "Einstempeln außerhalb melden",
          ),
        );
        return { status: "fehler", meldung: `Einstempeln geht nur in der Werkstatt. Du bist etwa ${abstandText(abstand)} entfernt.` };
      }
    }
    const { error } = await dbRoh().from("zeiteintraege").insert({ profil_id: b.id, beginn: new Date().toISOString(), ...(abstand !== null && { abstand_m: abstand }) });
    if (error) return { status: "fehler", meldung: "Sie sind schon eingestempelt." };
    await melden("zeit.gestempelt", { profil_id: b.id, art: "kommt", abstand_m: abstand });
    neu();
    return { status: "ok", meldung: "Eingestempelt." };
  });
}

/** Pause beginnen oder beenden (nur eingestempelt). */
export async function pauseUmschalten(_v: Ergebnis): Promise<Ergebnis> {
  return sicher(null, async () => {
    const b = await benutzerMitRecht("werkstatt");
    const { data: offen } = await db().from("zeiteintraege").select("*").eq("profil_id", b.id).is("ende", null).maybeSingle();
    if (!offen) return { status: "fehler", meldung: "Erst einstempeln." };
    const jetzt = new Date();
    if (offen.pause_seit) {
      await db().from("zeiteintraege").update({ pause_minuten: (offen.pause_minuten ?? 0) + pausenMinuten(offen.pause_seit, jetzt), pause_seit: null }).eq("id", offen.id);
      await melden("zeit.pause", { profil_id: b.id, art: "ende" });
      neu();
      return { status: "ok", meldung: "Weiter geht's." };
    }
    await db().from("zeiteintraege").update({ pause_seit: jetzt.toISOString() }).eq("id", offen.id);
    // In der Pause läuft keine Zeit am Auftrag weiter
    await zeitStoppen(b.id);
    await melden("zeit.pause", { profil_id: b.id, art: "beginn" });
    neu();
    return { status: "ok", meldung: "Pause." };
  });
}

const pausenMinuten = (seit: string, jetzt: Date) => Math.max(0, Math.round((jetzt.getTime() - new Date(seit).getTime()) / 60000));

/** Zeiteintrag nachtragen oder korrigieren (Inhaber). */
export async function zeitNachtragen(profilId: string, _v: Ergebnis, fd: FormData): Promise<Ergebnis> {
  return sicher(fd, async () => {
    const b = await benutzerMitRecht("personal");
    const datum = text(fd, "datum", 10);
    const von = text(fd, "von", 5);
    const bis = text(fd, "bis", 5);
    if (!istDatum(datum) || !/^\d{2}:\d{2}$/.test(von) || !/^\d{2}:\d{2}$/.test(bis) || bis <= von) return { status: "fehler", meldung: "Bitte Datum, Beginn und Ende prüfen." };
    const pause = Math.max(0, Math.round(zahl(fd, "pause") ?? 0));
    await db().from("zeiteintraege").insert({ profil_id: profilId, beginn: berlin(datum, von).toISOString(), ende: berlin(datum, bis).toISOString(), notiz: text(fd, "notiz", 300) || "nachgetragen", korrigiert_von: b.id, ...(pause && { pause_minuten: pause }) });
    neu();
    return { status: "ok", meldung: "Nachgetragen." };
  });
}

export async function zeitLoeschen(id: string, _v: Ergebnis): Promise<Ergebnis> {
  return sicher(null, async () => {
    await benutzerMitRecht("personal");
    await db().from("zeiteintraege").delete().eq("id", id);
    neu();
    return { status: "ok", meldung: "Gelöscht." };
  });
}

/** Status eines zugewiesenen Auftrags (Team-App). */
export async function auftragStatus(terminId: string, _v: Ergebnis, fd: FormData): Promise<Ergebnis> {
  return sicher(fd, async () => {
    const b = await benutzerMitRecht("werkstatt");
    const status = text(fd, "status");
    if (!["offen", "in_arbeit", "fertig"].includes(status)) return { status: "fehler", meldung: "Ungültig." };
    let q = db().from("termine").update({ auftrag_status: status }).eq("id", terminId);
    if (b.rolle === "mitarbeiter") q = q.eq("zugewiesen_an", b.id);
    // Ohne geänderte Zeile (fremder Auftrag, falsche ID) keine Meldung „Auftrag fertig“ an das Büro
    const { data, error } = await q.select("id, auftrag_erteilt_am");
    if (error) throw new DbFehler(error);
    if (!data?.length) return { status: "fehler", meldung: "Das ist nicht Ihr Auftrag." };
    // Anfangen startet die Uhr am Auftrag, Fertig stoppt sie (vor dem Rechnungsentwurf, damit die Zeit drin ist).
    if (status === "in_arbeit") await weich(zeitStarten(terminId, b.id), undefined, "Auftragszeit starten");
    else await weich(zeitStoppen(b.id, terminId), undefined, "Auftragszeit stoppen");
    // Fertig: Der Rechnungsentwurf entsteht sofort, das Büro bekommt einen Push dorthin.
    if (status === "fertig") await nachFertig(terminId, b.id, b.name || "Werkstatt");
    neu();
    revalidatePath("/app", "layout");
    // Anfangen geht auch ohne erteilten Auftrag, aber nicht unbemerkt.
    if (status === "in_arbeit" && !data[0].auftrag_erteilt_am) return { status: "fehler", meldung: "In Arbeit. Achtung: Der Kunde hat den Auftrag noch nicht erteilt." };
    return { status: "ok" };
  });
}

/** Foto zu einem Auftrag (Pfad kommt aus dem direkten Upload in den privaten Speicher). */
export async function fotoHinzufuegen(terminId: string, pfad: string, art: "arbeit" | "vorschaden" = "arbeit"): Promise<Ergebnis> {
  return sicher(null, async () => {
    const b = await benutzerMitRecht("werkstatt");
    if (!/^[a-z0-9-]+\/[0-9a-f-]{36}\.(jpg|png|webp|heic)$/.test(pfad)) return { status: "fehler", meldung: "Ungültige Datei." };
    if (b.rolle === "mitarbeiter") {
      const { data } = await db().from("termine").select("id").eq("id", terminId).eq("zugewiesen_an", b.id).maybeSingle();
      if (!data) return { status: "fehler", meldung: "Das ist nicht Ihr Auftrag." };
    }
    // Vorschäden gehören zur Annahme und kommen von Büro oder Inhaber (Handy-App), nicht aus der Team-App.
    if (art === "vorschaden" && b.rolle === "mitarbeiter") return { status: "fehler", meldung: "Keine Berechtigung." };
    await db().from("termin_fotos").insert({ termin_id: terminId, pfad, erstellt_von: b.id, ...(art === "vorschaden" && { art }) });
    revalidatePath("/team", "layout");
    revalidatePath(`/admin/termine/${terminId}`);
    revalidatePath(`/app/termine/${terminId}`);
    return { status: "ok", meldung: "Foto gespeichert." };
  });
}

/** Mitarbeiter dürfen nur an eigenen Aufträgen arbeiten; Inhaber und Büro überall. */
async function eigenerAuftrag(terminId: string, b: { id: string; rolle: string | null }): Promise<boolean> {
  if (b.rolle !== "mitarbeiter") return true;
  const { data } = await db().from("termine").select("id").eq("id", terminId).eq("zugewiesen_an", b.id).maybeSingle();
  return Boolean(data);
}

/** Uhr am Auftrag: Start (stoppt einen anderen laufenden) oder Stopp. Status geht beim Start auf „in Arbeit“. */
export async function auftragZeit(terminId: string, _v: Ergebnis, fd: FormData): Promise<Ergebnis> {
  return sicher(fd, async () => {
    const b = await benutzerMitRecht("werkstatt");
    if (!(await eigenerAuftrag(terminId, b))) return { status: "fehler", meldung: "Das ist nicht Ihr Auftrag." };
    if (text(fd, "aktion") === "stopp") {
      await zeitStoppen(b.id, terminId);
      neu();
      return { status: "ok", meldung: "Unterbrochen." };
    }
    const { data: z } = await db().from("zeiteintraege").select("pause_seit").eq("profil_id", b.id).is("ende", null).maybeSingle();
    if (z?.pause_seit) return { status: "fehler", meldung: "Du bist in der Pause. Erst die Pause beenden." };
    await zeitStarten(terminId, b.id);
    await db().from("termine").update({ auftrag_status: "in_arbeit" }).eq("id", terminId).eq("auftrag_status", "offen");
    neu();
    revalidatePath("/app", "layout");
    return { status: "ok", meldung: "Läuft." };
  });
}

/** Befund oder Teil aus der Werkstatt ans Büro (Team-App). Das Büro bekommt einen Push. */
export async function meldungAnlegen(terminId: string, _v: Ergebnis, fd: FormData): Promise<Ergebnis> {
  return sicher(fd, async () => {
    const b = await benutzerMitRecht("werkstatt");
    if (!(await eigenerAuftrag(terminId, b))) return { status: "fehler", meldung: "Das ist nicht Ihr Auftrag." };
    const art = text(fd, "art") === "teil" ? "teil" : "befund";
    const inhalt = text(fd, "text", 500);
    if (!inhalt) return { status: "fehler", meldung: art === "teil" ? "Welches Teil wird gebraucht?" : "Was ist aufgefallen?" };
    const menge = art === "teil" ? Math.min(Math.max(zahl(fd, "menge") ?? 1, 0.01), 9999) : 1;
    const dringend = ja(fd, "dringend");
    const { error } = await dbRoh().from("auftrag_meldungen").insert({ termin_id: terminId, profil_id: b.id, art, text: inhalt, menge, dringend });
    if (error) throw new DbFehler(error, { tabelle: "auftrag_meldungen" });
    const t = await terminLaden(terminId);
    const wer = b.name || b.email;
    await Promise.all([
      pushSenden(
        { rollen: ["inhaber", "buero"] },
        {
          titel: `${dringend ? "Dringend: " : ""}${art === "teil" ? "Teil angefordert" : "Befund"} von ${wer}`,
          text: `${art === "teil" ? `${String(menge).replace(".", ",")} × ` : ""}${inhalt}${t?.fahrzeug ? ` · ${t.fahrzeug.kennzeichen}` : ""}`,
          url: `/app/termine/${terminId}`,
        },
      ),
      melden("auftrag.meldung", { termin_id: terminId, profil_id: b.id, art, text: inhalt, menge, dringend }),
    ]);
    neu();
    revalidatePath(`/admin/termine/${terminId}`);
    revalidatePath("/admin/auftraege");
    return { status: "ok", meldung: art === "teil" ? "Angefordert. Das Büro kümmert sich." : "Gemeldet." };
  });
}

/** Büro: Meldung als bestellt oder erledigt markieren (oder wieder öffnen). */
export async function meldungStatus(id: string, _v: Ergebnis, fd: FormData): Promise<Ergebnis> {
  return sicher(fd, async () => {
    const b = await benutzerMitRecht("termine");
    const status = text(fd, "status");
    if (!["offen", "bestellt", "erledigt"].includes(status)) return { status: "fehler", meldung: "Ungültig." };
    const { data } = await db()
      .from("auftrag_meldungen")
      .update({ status, erledigt_von: status === "offen" ? null : b.id, erledigt_am: status === "erledigt" ? new Date().toISOString() : null })
      .eq("id", id)
      .select("termin_id, profil_id, art, text")
      .maybeSingle();
    if (!data) return { status: "fehler", meldung: "Meldung nicht gefunden." };
    // Wer ein Teil angefordert hat, erfährt, dass es bestellt oder da ist.
    if (data.art === "teil" && data.profil_id && data.profil_id !== b.id && status !== "offen") {
      await pushSenden({ profile: [data.profil_id] }, { titel: status === "bestellt" ? "Teil bestellt" : "Teil ist da", text: data.text, url: `/team/auftrag/${data.termin_id}` });
    }
    neu();
    revalidatePath(`/admin/termine/${data.termin_id}`);
    revalidatePath(`/app/termine/${data.termin_id}`);
    revalidatePath("/admin/auftraege");
    return { status: "ok" };
  });
}

/**
 * Freien Auftrag selbst übernehmen (Team-App). Geht nur, wenn die Person planbar ist, alle Leistungen darf, zu
 * der Zeit arbeitet und frei ist; die Prüfung macht uebernehmen() in termine.ts wie beim Zuteilen in der
 * Verwaltung, die Datenbank verhindert dazu, dass zwei denselben Auftrag oder dieselbe Zeit bekommen.
 */
export async function auftragUebernehmen(terminId: string, _v: Ergebnis): Promise<Ergebnis> {
  return sicher(null, async () => {
    const b = await benutzerMitRecht("werkstatt");
    const { data: p } = await db().from("profile").select("nimmt_auftraege").eq("id", b.id).maybeSingle();
    if (!p?.nimmt_auftraege) return { status: "fehler", meldung: "Du wirst nicht in der Werkstatt eingeplant. Bitte im Büro melden." };
    const t = await terminLaden(terminId);
    if (!t || t.status !== "bestaetigt") return { status: "fehler", meldung: "Diesen Auftrag gibt es nicht mehr." };
    try {
      await uebernehmen(terminId, b.id);
    } catch (e) {
      if (e instanceof PlanungsWarnung) return { status: "fehler", meldung: `Geht nicht: ${e.gruende.join(" ")}` };
      throw e;
    }
    await pushSenden({ rollen: ["inhaber", "buero"] }, { titel: `${b.name || b.email} übernimmt`, text: `${t.leistung_name}${t.fahrzeug ? ` · ${t.fahrzeug.kennzeichen}` : ""}`, url: `/app/termine/${terminId}` });
    neu();
    revalidatePath("/admin/termine", "layout");
    return { status: "ok", meldung: "Gehört jetzt dir." };
  });
}
