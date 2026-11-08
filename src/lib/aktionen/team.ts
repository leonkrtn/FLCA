"use server";

import { revalidatePath } from "next/cache";
import { benutzerMitRecht } from "../auth";
import { ENV } from "../env";
import { melden } from "../ereignisse";
import { type Ergebnis, ja, sicher, text, zahl } from "../forms";
import { mail } from "../email/vorlagen";
import { einstellungen } from "../einstellungen";
import { mailer } from "../services/email";
import { pushSenden } from "../services/push";
import type { Rolle } from "../rollen";
import { db } from "../supabase/admin";
import { berlin, istDatum } from "../zeit";

const ROLLEN: Rolle[] = ["inhaber", "buero", "mitarbeiter"];

function neu() {
  revalidatePath("/admin/team", "layout");
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
    await db().from("profile").update({ name, rolle, zeiterfassung: ja(fd, "zeiterfassung") }).eq("id", data.user.id);
    neu();
    return { status: "ok", meldung: `Einladung an ${email} ist unterwegs.` };
  });
}

export async function profilSpeichern(id: string, _v: Ergebnis, fd: FormData): Promise<Ergebnis> {
  return sicher(fd, async () => {
    const b = await benutzerMitRecht("team");
    const rolle = text(fd, "rolle") as Rolle;
    if (!ROLLEN.includes(rolle)) return { status: "fehler", meldung: "Ungültige Rolle." };
    if (id === b.id && (rolle !== "inhaber" || !ja(fd, "aktiv"))) return { status: "fehler", meldung: "Sie können sich nicht selbst die Inhaber-Rolle nehmen." };
    await db()
      .from("profile")
      .update({ name: text(fd, "name", 120), telefon: text(fd, "telefon", 40), rolle, aktiv: ja(fd, "aktiv"), zeiterfassung: ja(fd, "zeiterfassung"), urlaubstage: Math.round(zahl(fd, "urlaubstage") ?? 0) })
      .eq("id", id);
    neu();
    return { status: "ok", meldung: "Gespeichert." };
  });
}

/** Arbeitszeiten einer Person als Wochenplan (je Tag bis zu zwei Zeitfenster). */
export async function arbeitszeitenSpeichern(id: string, _v: Ergebnis, fd: FormData): Promise<Ergebnis> {
  return sicher(fd, async () => {
    await benutzerMitRecht("team");
    const zeilen: { profil_id: string; wochentag: number; beginn: string; ende: string }[] = [];
    for (let t = 1; t <= 7; t++) {
      for (const n of [1, 2]) {
        const a = text(fd, `t${t}_${n}_von`, 5);
        const e = text(fd, `t${t}_${n}_bis`, 5);
        if (/^\d{2}:\d{2}$/.test(a) && /^\d{2}:\d{2}$/.test(e)) {
          if (e <= a) return { status: "fehler", meldung: "Ein Zeitfenster endet vor seinem Beginn." };
          zeilen.push({ profil_id: id, wochentag: t, beginn: a, ende: e });
        }
      }
    }
    await db().from("arbeitszeiten").delete().eq("profil_id", id);
    if (zeilen.length) await db().from("arbeitszeiten").insert(zeilen);
    neu();
    return { status: "ok", meldung: "Arbeitszeiten gespeichert." };
  });
}

export async function abwesenheitEntscheiden(id: string, _v: Ergebnis, fd: FormData): Promise<Ergebnis> {
  return sicher(fd, async () => {
    const b = await benutzerMitRecht("team");
    const status = fd.get("entscheidung") === "genehmigt" ? "genehmigt" : "abgelehnt";
    const { data } = await db().from("abwesenheiten").update({ status, entschieden_von: b.id }).eq("id", id).select("profil_id, von, bis").single();
    if (data) await pushSenden({ profile: [data.profil_id] }, { titel: status === "genehmigt" ? "Urlaub genehmigt" : "Urlaub abgelehnt", text: `${data.von} bis ${data.bis}`, url: "/team/abwesenheit" });
    neu();
    return { status: "ok", meldung: status === "genehmigt" ? "Genehmigt." : "Abgelehnt." };
  });
}

/** Abwesenheit beantragen (Team-App) oder durch den Inhaber eintragen (für eine andere Person). */
export async function abwesenheitMelden(fuer: string | null, _v: Ergebnis, fd: FormData): Promise<Ergebnis> {
  return sicher(fd, async () => {
    const b = await benutzerMitRecht(fuer ? "team" : "werkstatt");
    const art = (["urlaub", "krank", "sonstiges"].includes(text(fd, "art")) ? text(fd, "art") : "urlaub") as "urlaub" | "krank" | "sonstiges";
    const von = text(fd, "von", 10);
    const bis = text(fd, "bis", 10) || von;
    if (!istDatum(von) || !istDatum(bis) || bis < von) return { status: "fehler", meldung: "Bitte einen gültigen Zeitraum angeben." };
    const profil = fuer ?? b.id;
    const status = fuer || art === "krank" ? "genehmigt" : "beantragt";
    await db().from("abwesenheiten").insert({ profil_id: profil, art, von, bis, status, notiz: text(fd, "notiz", 500), entschieden_von: fuer ? b.id : null });
    if (!fuer) {
      const { firma } = await einstellungen();
      const titel = art === "krank" ? `${b.name || b.email} ist krank gemeldet` : `${b.name || b.email} beantragt ${art === "urlaub" ? "Urlaub" : "frei"}`;
      await Promise.all([
        pushSenden({ rollen: ["inhaber"] }, { titel, text: `${von} bis ${bis}`, url: "/admin/team" }),
        mailer().senden({ an: firma.email, betreff: titel, ...mail(firma, { ueberschrift: titel, gruss: false, bausteine: [{ art: "fakten", zeilen: [["Von", von], ["Bis", bis], ["Notiz", text(fd, "notiz", 500) || "–"]] }, { art: "knopf", text: "Im Team-Bereich ansehen", url: `${ENV.siteUrl}/admin/team` }] }) }),
        melden("abwesenheit.beantragt", { profil_id: profil, art, von, bis }),
      ]);
    }
    neu();
    return { status: "ok", meldung: art === "krank" ? "Gute Besserung. Die Meldung ist raus." : fuer ? "Eingetragen." : "Beantragt. Sie bekommen Bescheid." };
  });
}

/** Stempeln: kommt/geht. Nur für Personen mit eingeschalteter Zeiterfassung. */
export async function stempeln(_v: Ergebnis, fd: FormData): Promise<Ergebnis> {
  return sicher(fd, async () => {
    const b = await benutzerMitRecht("werkstatt");
    if (!b.zeiterfassung) return { status: "fehler", meldung: "Für Sie ist keine Zeiterfassung eingeschaltet." };
    const { data: offen } = await db().from("zeiteintraege").select("id, beginn").eq("profil_id", b.id).is("ende", null).maybeSingle();
    if (offen) {
      await db().from("zeiteintraege").update({ ende: new Date().toISOString() }).eq("id", offen.id);
      await melden("zeit.gestempelt", { profil_id: b.id, art: "geht" });
      neu();
      return { status: "ok", meldung: "Ausgestempelt. Schönen Feierabend." };
    }
    const { error } = await db().from("zeiteintraege").insert({ profil_id: b.id, beginn: new Date().toISOString() });
    if (error) return { status: "fehler", meldung: "Sie sind schon eingestempelt." };
    await melden("zeit.gestempelt", { profil_id: b.id, art: "kommt" });
    neu();
    return { status: "ok", meldung: "Eingestempelt." };
  });
}

/** Zeiteintrag nachtragen oder korrigieren (Inhaber). */
export async function zeitNachtragen(profilId: string, _v: Ergebnis, fd: FormData): Promise<Ergebnis> {
  return sicher(fd, async () => {
    const b = await benutzerMitRecht("team");
    const datum = text(fd, "datum", 10);
    const von = text(fd, "von", 5);
    const bis = text(fd, "bis", 5);
    if (!istDatum(datum) || !/^\d{2}:\d{2}$/.test(von) || !/^\d{2}:\d{2}$/.test(bis) || bis <= von) return { status: "fehler", meldung: "Bitte Datum, Beginn und Ende prüfen." };
    await db().from("zeiteintraege").insert({ profil_id: profilId, beginn: berlin(datum, von).toISOString(), ende: berlin(datum, bis).toISOString(), notiz: text(fd, "notiz", 300) || "nachgetragen", korrigiert_von: b.id });
    neu();
    return { status: "ok", meldung: "Nachgetragen." };
  });
}

export async function zeitLoeschen(id: string, _v: Ergebnis): Promise<Ergebnis> {
  return sicher(null, async () => {
    await benutzerMitRecht("team");
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
    await q;
    if (status === "fertig") await pushSenden({ rollen: ["inhaber", "buero"] }, { titel: "Auftrag fertig", text: `${b.name}: Auftrag abgeschlossen`, url: `/app/termine/${terminId}` });
    neu();
    revalidatePath("/app", "layout");
    return { status: "ok" };
  });
}

/** Foto zu einem Auftrag (Pfad kommt aus dem direkten Upload in den privaten Speicher). */
export async function fotoHinzufuegen(terminId: string, pfad: string): Promise<Ergebnis> {
  return sicher(null, async () => {
    const b = await benutzerMitRecht("werkstatt");
    if (!/^[a-z0-9-]+\/[0-9a-f-]{36}\.(jpg|png|webp|heic)$/.test(pfad)) return { status: "fehler", meldung: "Ungültige Datei." };
    if (b.rolle === "mitarbeiter") {
      const { data } = await db().from("termine").select("id").eq("id", terminId).eq("zugewiesen_an", b.id).maybeSingle();
      if (!data) return { status: "fehler", meldung: "Das ist nicht Ihr Auftrag." };
    }
    await db().from("termin_fotos").insert({ termin_id: terminId, pfad, erstellt_von: b.id });
    revalidatePath("/team", "layout");
    revalidatePath(`/admin/termine/${terminId}`);
    return { status: "ok", meldung: "Foto gespeichert." };
  });
}
