"use server";

import { redirect } from "next/navigation";
import { benutzerMitRecht } from "../auth";
import { einstellungen } from "../einstellungen";
import { type Ergebnis, sicher, text } from "../forms";
import { alsBelegFahrzeug, alsEmpfaenger, fahrzeugTypen, type KundenFahrzeug, type KundenTreffer, kundenSuchen, markeUndModell } from "../kunden";
import { notizTeam } from "../notizen-seiten";
import { fahrzeugText, modellNorm } from "../rechnung/aehnlich";
import { gemerktFuer } from "../rechnung/preisgedaechtnis";
import { entwurfAnlegen, preislisteFuerBelege, type Rechnung } from "../rechnung/rechnungen";
import { leistungenFuerSprache } from "../sprache/daten";
import type { Fahrzeug } from "../sprache/merkmale";
import { positionenBauen } from "../sprache/positionen";
import { klein } from "../sprache/text";
import { absichtErkennen, type Art, notizVerstehen, rechnungVerstehen, terminVerstehen } from "../sprache/verstehen";
import { notizAdresse, terminAdresse } from "../sprache/vorgabe";
import { berlinDatum } from "../zeit";

/**
 * Gesprochenen Text übernehmen (Werkstatt-App → Sprechen). Notiz und Termin landen vorausgefüllt im
 * gewohnten Formular und werden erst dort gespeichert. Eine Rechnung wird ein Entwurf im Editor; gestellt
 * wird hier nie etwas.
 */
export async function spracheUebernehmen(_v: Ergebnis, fd: FormData): Promise<Ergebnis> {
  let ziel = "";
  const e = await sicher(fd, async () => {
    // Begrenzt, weil Notiz und Termin über die Adresse des Formulars vorausgefüllt werden
    const satz = text(fd, "text", 1500);
    if (!satz) return { status: "fehler", meldung: "Bitte erst etwas sagen oder eintippen." };
    const gewaehlt = text(fd, "art", 10);
    const art: Art | null = gewaehlt === "notiz" || gewaehlt === "termin" || gewaehlt === "rechnung" ? gewaehlt : absichtErkennen(satz);
    if (!art) return { status: "fehler", meldung: "Bitte oben wählen: Notiz, Termin oder Rechnung." };
    const heute = berlinDatum();

    if (art === "notiz") {
      const b = await benutzerMitRecht("notizen");
      const v = notizVerstehen(satz, { heute, jetzt: new Date(), team: await notizTeam() });
      ziel = notizAdresse({
        titel: v.titel || (v.text ? "" : satz.slice(0, 200)),
        text: v.text,
        datum: v.datum ?? "",
        uhrzeit: v.uhrzeit ?? "",
        wiederholung: v.wiederholung,
        sichtbar: v.sichtbar ?? "",
        erinnernAn: v.erinnernAn && v.erinnernAn.id !== b.id ? v.erinnernAn.id : "",
      });
      return { status: "ok" };
    }

    if (art === "termin") {
      await benutzerMitRecht("termine");
      // Frisch aus der Datenbank: neue und umbenannte Leistungen gelten sofort
      const [leistungen, team, typen] = await Promise.all([leistungenFuerSprache(), notizTeam(), fahrzeugTypen()]);
      const v = terminVerstehen(satz, { heute, leistungen, team, typen });
      const k = await kundeFinden(v);
      ziel = terminAdresse({
        leistungIds: v.leistungen.map((x) => x.id),
        leistungFrei: v.leistungFrei,
        dauer: v.dauerMin ? String(v.dauerMin) : "",
        datum: v.datum ?? "",
        uhrzeit: v.uhrzeit ?? "",
        // Aus der Kartei, damit der Termin am selben Kunden hängt (gefunden wird er über E-Mail oder Telefon)
        name: k?.kunde.name || v.name,
        telefon: v.telefon || k?.kunde.telefon || "",
        email: v.email || k?.kunde.email || "",
        kennzeichen: v.kennzeichen || k?.fahrzeug?.kennzeichen || "",
        fahrzeug: v.fahrzeug ? fahrzeugText(v.fahrzeug) : k?.fahrzeug ? fahrzeugText(markeUndModell(k.fahrzeug)) : "",
        notiz: v.notiz,
        mitarbeiter: v.mitarbeiter?.id ?? "",
      });
      return { status: "ok" };
    }

    const b = await benutzerMitRecht("rechnungen");
    const [preisliste, einst, typen] = await Promise.all([preislisteFuerBelege(), einstellungen(), fahrzeugTypen()]);
    const { stundensaetze, aufschlagProzent } = einst.rechnung;
    const v = rechnungVerstehen(satz, { heute, preisliste, lohnarten: stundensaetze.map((s) => s.name), typen });
    if (!v.positionen.length && !v.name && !v.kennzeichen) {
      return { status: "fehler", meldung: "Darin habe ich weder Kunde noch Positionen erkannt. Bitte etwas genauer sagen." };
    }
    const k = await kundeFinden(v);
    // Fahrzeug aus der Kartei; Gesprochenes ergänzt, was dort fehlt
    const ausKartei: Rechnung["fahrzeug"] = k?.fahrzeug ? alsBelegFahrzeug(k.fahrzeug) : {};
    const fahrzeug = {
      ...ausKartei,
      kennzeichen: ausKartei.kennzeichen || v.kennzeichen || undefined,
      marke: ausKartei.marke || v.fahrzeug?.marke || undefined,
      modell: ausKartei.modell || v.fahrzeug?.modell || undefined,
    };
    const gemerkt = await gemerktFuer(fahrzeug.marke ?? "", fahrzeug.modell ?? "");
    const positionen = positionenBauen(v.positionen, { preisliste, gemerkt, stundensaetze, aufschlagProzent }).map((p) => p.position);
    const id = await entwurfAnlegen(
      {
        kunde_id: k?.kunde.id ?? null,
        empfaenger: k ? alsEmpfaenger(k.kunde) : { name: v.name },
        fahrzeug,
        positionen,
        leistungsdatum: v.leistungsdatum ?? heute,
      },
      b.id,
    );
    ziel = `/app/rechnungen/${id}`;
    return { status: "ok" };
  });
  if (ziel) redirect(ziel);
  return e;
}

/**
 * Kunde zum Gesprochenen. Kennzeichen ist eindeutig; ein Name nur, wenn genau ein Kunde so heißt (oder
 * genau einer davon das genannte Modell fährt). Lieber keinen als den falschen.
 */
async function kundeFinden(v: { name: string; kennzeichen: string; telefon: string; fahrzeug: Fahrzeug | null }): Promise<{ kunde: KundenTreffer; fahrzeug: KundenFahrzeug | null } | null> {
  const mitFahrzeug = (k: KundenTreffer, passend?: (f: KundenFahrzeug) => boolean) => ({
    kunde: k,
    fahrzeug: (passend && k.fahrzeuge.find(passend)) ?? (k.fahrzeuge.length === 1 ? k.fahrzeuge[0] : null),
  });
  const gleichesModell = (f: KundenFahrzeug) => Boolean(v.fahrzeug?.modell) && modellNorm(markeUndModell(f).modell) === modellNorm(v.fahrzeug?.modell ?? "");

  if (v.kennzeichen) {
    const k = (await kundenSuchen(v.kennzeichen, 5)).find((x) => x.passend?.length);
    if (k) return mitFahrzeug(k, (f) => k.passend!.includes(f.id));
  }
  if (v.telefon) {
    const t = await kundenSuchen(v.telefon, 3);
    if (t.length === 1) return mitFahrzeug(t[0], gleichesModell);
  }
  if (v.name) {
    // Jedes gesprochene Wort muss ein ganzes Wort im Namen sein: „Müller“ findet nicht „Müllermann“
    const teile = v.name.split(/\s+/).map(klein).filter(Boolean);
    const treffer = (await kundenSuchen(v.name, 20)).filter((k) => {
      const w = `${k.name} ${k.firma}`.split(/[^\p{L}\p{N}]+/u).map(klein);
      return teile.every((t) => w.includes(t));
    });
    if (treffer.length === 1) return mitFahrzeug(treffer[0], gleichesModell);
    const mitModell = treffer.filter((k) => k.fahrzeuge.some(gleichesModell));
    if (mitModell.length === 1) return mitFahrzeug(mitModell[0], gleichesModell);
  }
  return null;
}
