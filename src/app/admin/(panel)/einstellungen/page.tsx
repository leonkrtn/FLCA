import Link from "next/link";
import { Ausblenden, Formular, Senden } from "@/components/admin/formular";
import { Datenuebernahme } from "@/components/admin/datenuebernahme";
import { alleFrueherenRechnungen } from "@/lib/altbestand/daten";
import { FruehereRechnungen, fruehereSumme } from "@/components/admin/fruehere-rechnungen";
import { GemerktePreise } from "@/components/admin/gemerkte-preise";
import { NummernkreisFormular } from "@/components/admin/nummernkreis";
import { TaktStatus } from "@/components/admin/takt-status";
import { Abschnitt, Auswahl, Feld, Kopf, Leer, Marke, Reiter, Schalter, Tabelle, Textfeld } from "@/components/admin/ui";
import {
  apiSchluesselAnlegen,
  apiSchluesselWiderrufen,
  automatikSpeichern,
  benachrichtigungSpeichern,
  buchungSpeichern,
  fehlerErledigt,
  firmaSpeichern,
  moduleSpeichern,
  rechnungEinstellungen,
  rechtstexteSpeichern,
  webhookAnlegen,
  webhookLoeschen,
  webhookTesten,
  zeitenSpeichern,
} from "@/lib/aktionen/einstellungen";
import { benutzerMitRecht } from "@/lib/auth";
import { einstellungen, WOCHENTAGE } from "@/lib/einstellungen";
import { ENV } from "@/lib/env";
import { EREIGNIS_TYPEN } from "@/lib/ereignisse";
import { offeneFehlerAnzahl, protokollLaden } from "@/lib/fehlerprotokoll";
import { datum, datumZeit, euro } from "@/lib/format";
import { darf } from "@/lib/rollen";
import { db, DbFehler, dbRoh } from "@/lib/supabase/admin";
import { berlinDatum } from "@/lib/zeit";

export const metadata = { title: "Einstellungen" };

const BEREICHE = [
  ["firma", "Firma"],
  ["zeiten", "Öffnungszeiten"],
  ["buchung", "Terminvergabe"],
  ["rechnung", "Rechnungen"],
  ["preise", "Gemerkte Preise"],
  ["automatik", "Automatik"],
  ["benachrichtigung", "Benachrichtigungen"],
  ["module", "Module"],
  ["schnittstellen", "Schnittstellen"],
  ["recht", "Rechtstexte"],
  ["uebernahme", "Datenübernahme"],
  ["fehler", "Fehler"],
] as const;

export default async function EinstellungenSeite({ searchParams }: { searchParams: Promise<{ bereich?: string; ansicht?: string; q?: string; code?: string }> }) {
  // Die gemerkten Preise pflegt auch das Büro (Recht „rechnungen“), alles andere hier nur, wer Einstellungen darf.
  const b = await benutzerMitRecht();
  const sp = await searchParams;
  const alles = darf(b.rolle, "einstellungen");
  if (!alles) await benutzerMitRecht("rechnungen");
  const bereich = alles ? (sp.bereich ?? "firma") : "preise";
  const sichtbar = BEREICHE.filter(([k]) => alles || k === "preise");
  const [e, offeneFehler] = await Promise.all([einstellungen(), alles ? offeneFehlerAnzahl() : 0]);
  return (
    <>
      <Kopf titel="Einstellungen" />
      <Reiter
        aktiv={`/admin/einstellungen?bereich=${bereich}`}
        eintraege={sichtbar.map(([k, t]) => ({ href: `/admin/einstellungen?bereich=${k}`, text: t, anzahl: k === "fehler" ? offeneFehler : undefined }))}
      />

      {bereich === "fehler" ? <FehlerBereich erledigte={sp.ansicht === "erledigt"} code={sp.code} /> : null}

      {bereich === "preise" ? <GemerktePreise sp={sp} /> : null}

      {bereich === "firma" ? (
        <Abschnitt titel="Firmendaten" aktion={<span className="text-sm text-grau">Erscheinen auf Website, Impressum, Rechnungen und Mails.</span>}>
          <Formular aktion={firmaSpeichern} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {(
              [
                ["name", "Firmenname"], ["inhaber", "Inhaber"], ["titel", "Berufsbezeichnung"], ["rechtsform", "Rechtsform"], ["kammer", "Zuständige Kammer"],
                ["strasse", "Straße"], ["plz", "PLZ"], ["ort", "Ort"], ["telefon", "Telefon"], ["whatsapp", "WhatsApp-Nummer (nur Ziffern, mit 49)"],
                ["email", "E-Mail"], ["instagram", "Instagram-Name"], ["steuernummer", "Steuernummer"], ["ustId", "USt-IdNr."],
                ["iban", "IBAN"], ["bic", "BIC"], ["bank", "Bank"], ["googleBewertungLink", "Link zu den Google-Bewertungen"], ["googleNote", "Google-Note"], ["googleAnzahl", "Anzahl Google-Bewertungen"],
              ] as const
            ).map(([k, l]) => (
              <Feld key={k} label={l} name={k} wert={e.firma[k]} />
            ))}
            <Textfeld label="Hinweis zur Anfahrt" name="hinweisAnfahrt" wert={e.firma.hinweisAnfahrt} zeilen={2} className="sm:col-span-2 lg:col-span-3" />
            <div><Senden vorab="Gespeichert">Speichern</Senden></div>
          </Formular>
        </Abschnitt>
      ) : null}

      {bereich === "zeiten" ? (
        <Abschnitt titel="Öffnungszeiten" aktion={<span className="text-sm text-grau">Grundlage für freie Termine.</span>}>
          <Formular aktion={zeitenSpeichern} className="grid max-w-2xl gap-2">
            {WOCHENTAGE.map((tag, i) => {
              const f = e.oeffnungszeiten[String(i + 1) as "1"];
              return (
                // Am Handy untereinander (Tag, Vormittag, Nachmittag), sonst passen vier Uhrzeitfelder nicht in eine Zeile.
                <div key={tag} className="grid grid-cols-1 items-center gap-2 border-b border-linie pb-2 sm:grid-cols-[6.5rem_minmax(0,1fr)_minmax(0,1fr)] sm:border-0 sm:pb-0">
                  <span className="text-sm font-semibold">{tag}</span>
                  {[0, 1].map((n) => (
                    <div key={n} className="flex min-w-0 items-center gap-1">
                      <input type="time" name={`t${i + 1}_${n + 1}_von`} defaultValue={f[n]?.[0]} className="feld min-h-10 min-w-0 flex-1 px-2" aria-label={`${tag} von`} />
                      <span className="text-grau">–</span>
                      <input type="time" name={`t${i + 1}_${n + 1}_bis`} defaultValue={f[n]?.[1]} className="feld min-h-10 min-w-0 flex-1 px-2" aria-label={`${tag} bis`} />
                    </div>
                  ))}
                </div>
              );
            })}
            <div className="mt-2"><Senden vorab="Gespeichert">Speichern</Senden></div>
          </Formular>
        </Abschnitt>
      ) : null}

      {bereich === "buchung" ? (
        <Abschnitt titel="Terminvergabe">
          <Formular aktion={buchungSpeichern} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="sm:col-span-2 lg:col-span-3"><Schalter label="Online-Anfragen annehmen" name="aktiv" an={e.buchung.aktiv} hilfe="Aus = die Seite zeigt nur Telefon und WhatsApp." /></div>
            <Feld label="Fahrzeuge gleichzeitig" name="kapazitaet" wert={e.buchung.kapazitaet} inputMode="numeric" hilfe="Hebebühnen und Plätze, die parallel arbeiten" />
            <Feld label="Puffer nach jedem Termin (Min.)" name="pufferMin" wert={e.buchung.pufferMin} inputMode="numeric" />
            <Auswahl label="Raster der Startzeiten" name="rasterMin" wert={String(e.buchung.rasterMin)} optionen={[["15", "alle 15 Minuten"], ["30", "alle 30 Minuten"], ["60", "jede volle Stunde"]]} />
            <Feld label="Frühestens (Stunden vorher)" name="vorlaufStd" wert={e.buchung.vorlaufStd} inputMode="numeric" />
            <Feld label="Höchstens (Tage im Voraus)" name="maxTage" wert={e.buchung.maxTage} inputMode="numeric" />
            <Feld label="Anfrage hält den Termin (Stunden)" name="haltenStd" wert={e.buchung.haltenStd} inputMode="numeric" />
            <Feld label="Kunde kann online absagen bis (Std. vorher)" name="stornoFristStd" wert={e.buchung.stornoFristStd} inputMode="numeric" />
            <div className="sm:col-span-2 lg:col-span-3"><Senden vorab="Gespeichert">Speichern</Senden></div>
          </Formular>
        </Abschnitt>
      ) : null}

      {bereich === "rechnung" ? <RechnungBereich /> : null}

      {bereich === "automatik" ? (
        <Abschnitt titel="Automatik">
          <div className="mb-6">
            <TaktStatus />
          </div>
          <Formular aktion={automatikSpeichern} className="grid gap-6">
            <Schalter label="Erinnerung 24 Stunden vor dem Termin" name="erinnerung" an={e.automatik.erinnerung.aktiv} hilfe="Mail an den Kunden mit Anfahrt und Absagelink" />
            <div className="grid items-end gap-3 sm:grid-cols-[minmax(0,1fr)_12rem]">
              <Schalter label="Nach dem Termin um eine Google-Bewertung bitten" name="bewertung" an={e.automatik.bewertung.aktiv} hilfe="Einmal pro Kunde und Jahr, nur nach „Erledigt“. Link aus Firma → Google-Bewertungen." />
              <Feld label="Stunden nach dem Termin" name="stundenNach" wert={e.automatik.bewertung.stundenNach} inputMode="numeric" />
            </div>
            <div className="grid items-end gap-3 sm:grid-cols-[minmax(0,1fr)_8rem_8rem]">
              <Schalter label="Reifen-Saison-Mail an Kunden mit eingelagerten Rädern" name="saison" an={e.automatik.saison.aktiv} hilfe="Mit Link zur Terminanfrage für den Radwechsel" />
              <Feld label="Frühjahr (MM-TT)" name="fruehjahr" wert={e.automatik.saison.fruehjahr} />
              <Feld label="Herbst (MM-TT)" name="herbst" wert={e.automatik.saison.herbst} />
            </div>
            <fieldset className="grid gap-3 border-t border-linie pt-4 sm:grid-cols-3">
              <div className="sm:col-span-3"><Schalter label="DATEV-Export für den Vormonat am 1. an den Steuerberater senden (fällt der Versand aus, wird er nachgeholt)" name="datev" an={e.automatik.datev.aktiv} /></div>
              <Feld label="E-Mail Steuerberater" name="datev_email" wert={e.automatik.datev.email} typ="email" />
              <Feld label="Beraternummer" name="beraterNr" wert={e.automatik.datev.beraterNr} />
              <Feld label="Mandantennummer" name="mandantNr" wert={e.automatik.datev.mandantNr} />
              <Feld label="Sachkontenlänge" name="sachkontenlaenge" wert={e.automatik.datev.sachkontenlaenge} />
              <Feld label="Erlöskonto 19 %" name="erloeskonto19" wert={e.automatik.datev.erloeskonto19} hilfe="SKR03: 8400, SKR04: 4400" />
              <Feld label="Debitoren-Sammelkonto" name="debitorSammel" wert={e.automatik.datev.debitorSammel} />
              <Feld label="Kasse" name="kasse" wert={e.automatik.datev.kasse} />
              <Feld label="Bank" name="bank" wert={e.automatik.datev.bank} />
            </fieldset>
            <div><Senden vorab="Gespeichert">Speichern</Senden></div>
          </Formular>
        </Abschnitt>
      ) : null}

      {bereich === "benachrichtigung" ? (
        <Abschnitt titel="Benachrichtigungen">
          <Formular aktion={benachrichtigungSpeichern} className="grid max-w-xl gap-4">
            <Textfeld label="E-Mail-Adressen für neue Anfragen und Bewerbungen" name="emails" wert={e.benachrichtigung.emails.join("\n")} zeilen={3} hilfe={`Eine pro Zeile. Leer = ${e.firma.email}. Push-Nachrichten schaltet jede Person in ihrer Handy-App selbst ein.`} />
            <div><Senden vorab="Gespeichert">Speichern</Senden></div>
          </Formular>
        </Abschnitt>
      ) : null}

      {bereich === "module" ? (
        <Abschnitt titel="Module" aktion={<span className="text-sm text-grau">Ausgeschaltete Module verschwinden aus Website und Menü, die Daten bleiben.</span>}>
          <Formular aktion={moduleSpeichern} className="grid gap-4">
            <Schalter label="Karriere" name="karriere" an={e.module.karriere} hilfe="Stellenanzeigen und Bewerbungen" />
            <Schalter label="Vorher/Nachher-Galerie" name="galerie" an={e.module.galerie} />
            <Schalter label="Rädereinlagerung" name="einlagerung" an={e.module.einlagerung} />
            <Schalter label="Zeiterfassung" name="zeiterfassung" an={e.module.zeiterfassung} hilfe="Stempeln in der Team-App (pro Person zusätzlich einschalten)" />
            <Schalter label="Bewertungen auf der Startseite" name="bewertungen" an={e.module.bewertungen} />
            <div><Senden vorab="Gespeichert">Speichern</Senden></div>
          </Formular>
        </Abschnitt>
      ) : null}

      {bereich === "schnittstellen" ? <Schnittstellen /> : null}

      {bereich === "uebernahme" ? <UebernahmeBereich /> : null}

      {bereich === "recht" ? (
        <Abschnitt titel="Rechtstexte">
          <Formular aktion={rechtstexteSpeichern} className="grid gap-4">
            <p className="text-sm text-grau">Am besten von einem Rechtstexte-Dienst (z. B. IT-Recht Kanzlei). Dort die „HTML-Adresse“ bzw. iFrame-URL des Textes eintragen. Die Seite lädt ihn täglich neu. Der Text darunter gilt, wenn der Dienst nicht erreichbar ist.</p>
            <Feld label="Adresse Datenschutzerklärung" name="datenschutzUrl" wert={e.rechtstexte.datenschutzUrl} placeholder="https://…" />
            <Feld label="Adresse AGB" name="agbUrl" wert={e.rechtstexte.agbUrl} placeholder="https://…" />
            <Textfeld label="Datenschutzerklärung (Ersatztext)" name="datenschutzText" wert={e.rechtstexte.datenschutzText} zeilen={8} />
            <Textfeld label="AGB (Ersatztext)" name="agbText" wert={e.rechtstexte.agbText} zeilen={8} />
            <div><Senden vorab="Gespeichert">Speichern</Senden></div>
          </Formular>
        </Abschnitt>
      ) : null}
    </>
  );
}

async function RechnungBereich() {
  const e = await einstellungen();
  const [{ data: k }, { count }, { data: letzte }] = await Promise.all([
    db().from("nummernkreise").select("praefix, mit_jahr, stellen, naechste").eq("art", "rechnung").single(),
    db().from("rechnungen").select("id", { count: "exact", head: true }).not("nummer", "is", null),
    db().from("rechnungen").select("nummer").not("nummer", "is", null).order("gestellt_am", { ascending: false }).limit(1).maybeSingle(),
  ]);
  // Frühere Rechnungen (Datenübernahme): als Liste unten und die höchste Nummer als Anhalt für den Nummernkreis.
  const fruehere = await alleFrueherenRechnungen();
  const zahl = (n: string) => Number(n.split(".")[0].replace(/\D/g, "")) || 0;
  const hoechste = fruehere.reduce<(typeof fruehere)[number] | null>((m, r) => (!m || zahl(r.nummer) > zahl(m.nummer) ? r : m), null);
  const frueher = hoechste ? { nummer: hoechste.nummer.split(".")[0], rechnungsdatum: hoechste.rechnungsdatum } : null;
  const aktuell = { praefix: k?.praefix ?? "", mit_jahr: k?.mit_jahr ?? true, stellen: Number(k?.stellen ?? 4), naechste: Number(k?.naechste ?? 1) };
  return (
    <>
    <Abschnitt titel="Nummernkreis" aktion={<span className="text-sm text-grau">Ändern nur mit Bestätigung</span>}>
      <NummernkreisFormular key={JSON.stringify(aktuell)} aktuell={aktuell} gestellt={count ?? 0} letzte={letzte?.nummer ?? null} frueher={frueher ? { nummer: frueher.nummer, datum: datum(frueher.rechnungsdatum) } : null} jahr={Number(berlinDatum().slice(0, 4))} />
    </Abschnitt>
    <Abschnitt titel="Rechnungen">
      <Formular aktion={rechnungEinstellungen} className="grid gap-6">
        <Feld label="Zahlungsziel (Tage)" name="zahlungszielTage" wert={e.rechnung.zahlungszielTage} inputMode="numeric" className="max-w-xs" />
        <Textfeld label="Einleitungssatz" name="einleitung" wert={e.rechnung.einleitung} zeilen={2} />
        <Textfeld label="Fußtext" name="fusstext" wert={e.rechnung.fusstext} zeilen={2} />
        <fieldset className="grid gap-4 border-t border-linie pt-6">
          <legend className="font-semibold">Stundensätze und Teile</legend>
          <p className="text-sm text-grau">
            Netto je Stunde. Eine Position mit der Einheit „Std“ ist Lohn: Lohnart wählen, Stunden eintragen, der Satz kommt von hier. Der
            erste Satz ist der Standard. Leere Zeilen werden entfernt.
          </p>
          <div className="grid gap-3">
            {Array.from({ length: 6 }, (_, i) => e.rechnung.stundensaetze[i] ?? { name: "", netto_cent: 0 }).map((l, i) => (
              <div key={i} className="grid grid-cols-[minmax(0,1fr)_9rem] gap-3">
                <Feld label={i ? `Lohnart ${i + 1}` : "Lohnart 1 (Standard)"} name={`lohn_name_${i}`} wert={l.name} placeholder={i ? "" : "Mechanik"} />
                <Feld label="€ netto/Std" name={`lohn_preis_${i}`} wert={l.name ? (l.netto_cent / 100).toFixed(2).replace(".", ",") : ""} inputMode="decimal" />
              </div>
            ))}
          </div>
          <Feld
            label="Aufschlag auf Teile-Einkauf (%)"
            name="aufschlagProzent"
            wert={e.rechnung.aufschlagProzent}
            inputMode="decimal"
            className="max-w-xs"
            hilfe="Standard für neue Teile mit Einkaufspreis, in jeder Position änderbar."
          />
        </fieldset>
        <fieldset className="grid gap-4 border-t border-linie pt-6">
          <legend className="font-semibold">Kostenvoranschläge · Nummern mit eigenem Präfix KV-</legend>
          <Feld label="Gültig (Tage)" name="kv_gueltigTage" wert={e.kostenvoranschlag.gueltigTage} inputMode="numeric" className="max-w-xs" />
          <Textfeld label="Einleitungssatz" name="kv_einleitung" wert={e.kostenvoranschlag.einleitung} zeilen={2} />
          <Textfeld label="Fußtext" name="kv_fusstext" wert={e.kostenvoranschlag.fusstext} zeilen={2} />
        </fieldset>
        <fieldset className="grid gap-4 border-t border-linie pt-6">
          <legend className="font-semibold">Werkstattaufträge · Nummern mit eigenem Präfix WA-</legend>
          <Textfeld label="Einleitungssatz" name="wa_einleitung" wert={e.auftrag.einleitung} zeilen={2} />
          <Textfeld label="Bedingungen (Fußtext)" name="wa_fusstext" wert={e.auftrag.fusstext} zeilen={3} hilfe="Steht über der Unterschrift des Kunden." />
        </fieldset>
        <div><Senden vorab="Gespeichert">Speichern</Senden></div>
      </Formular>
    </Abschnitt>
    {fruehere.length ? (
      <Abschnitt titel="Frühere Rechnungen" aktion={<span className="zahlen text-sm text-grau">{fruehere.length} Rechnungen · {euro(fruehereSumme(fruehere))}</span>}>
        <p className="mb-3 max-w-2xl text-sm text-grau">
          Aus den alten PDFs übernommen (Datenübernahme), je Rechnung die letzte Fassung mit Nummer und Datum. Nur zum Nachschlagen: keine
          Nummer aus dem Nummernkreis, nicht im DATEV-Export.
        </p>
        <FruehereRechnungen liste={fruehere} mitKunde />
      </Abschnitt>
    ) : null}
    </>
  );
}

/**
 * Fehlerprotokoll: alles, was auf dem Server schiefging (Seiten, Formulare, Takt, Mails), mit Ursache und
 * Abhilfe. Gleiche Fehler stehen einmal da und werden gezählt. `code` kommt von der Fehlerseite.
 */
async function FehlerBereich({ erledigte, code }: { erledigte: boolean; code?: string }) {
  const { eintraege, unmigriert } = await protokollLaden(erledigte);
  const ansicht = (a: string, t: string, an: boolean) => (
    <Link href={`/admin/einstellungen?bereich=fehler${a ? `&ansicht=${a}` : ""}`} className={`text-sm ${an ? "font-semibold" : "text-grau underline"}`}>{t}</Link>
  );
  return (
    <Abschnitt
      titel={erledigte ? "Erledigte Fehler" : "Offene Fehler"}
      aktion={
        <>
          {ansicht("", "Offen", !erledigte)}
          {ansicht("erledigt", "Erledigt", erledigte)}
          {!erledigte && eintraege.length > 1 ? (
            <Formular aktion={fehlerErledigt.bind(null, null)} bestaetigen="Alle offenen Fehler als erledigt markieren?"><Senden art="rahmen" klein vorab="Erledigt">Alle erledigt</Senden></Formular>
          ) : null}
        </>
      }
    >
      {unmigriert ? (
        <p className="max-w-2xl text-sm">
          Das Fehlerprotokoll ist noch nicht eingerichtet. Bitte die Migration <span className="zahlen">20261124100000_fehlerprotokoll.sql</span> im SQL-Editor von Supabase ausführen. Bis dahin stehen Fehler nur im Server-Log (Vercel → Logs).
        </p>
      ) : eintraege.length ? (
        <>
          <p className="mb-4 max-w-2xl text-sm text-grau">
            Als erledigt markieren, wenn die Ursache behoben ist. Tritt der Fehler wieder auf, steht er wieder hier. Erledigte verschwinden nach 30 Tagen.
          </p>
          <ul className="divide-y divide-linie">
            {eintraege.map((f) => (
              <Ausblenden als="li" key={f.id} className={`grid gap-2 py-4 ${code && f.digest === code ? "-mx-2 rounded-lg bg-flaeche px-2" : ""}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="min-w-0 font-semibold">{f.ort}</span>
                  <span className="flex items-center gap-2">
                    {f.code ? <Marke>{f.code}</Marke> : null}
                    <span className="zahlen text-sm text-grau">{f.anzahl === 1 ? "einmal" : `${f.anzahl}-mal`}</span>
                    {!erledigte ? <Formular aktion={fehlerErledigt.bind(null, f.id)} ausblenden><Senden art="rahmen" klein>Erledigt</Senden></Formular> : null}
                  </span>
                </div>
                <p className="whitespace-pre-wrap break-words text-sm">{f.meldung}</p>
                <p className="zahlen text-xs text-grau">
                  {f.anzahl > 1 ? `zuerst ${datumZeit(f.zuerst_am)} · ` : ""}zuletzt {datumZeit(f.zuletzt_am)}
                  {f.digest ? ` · Fehlercode ${f.digest}` : ""}
                  {f.erledigt_am ? ` · erledigt ${datumZeit(f.erledigt_am)}` : ""}
                </p>
              </Ausblenden>
            ))}
          </ul>
        </>
      ) : (
        <Leer>{erledigte ? "Keine erledigten Fehler." : "Keine offenen Fehler."}</Leer>
      )}
    </Abschnitt>
  );
}

/**
 * Datenübernahme aus den alten Rechnungs-PDFs (als CSV gezogen): Kunden mit Anschrift, Fahrzeuge mit
 * KM-Stand und die früheren Rechnungen mit Positionen. Die Rechnungen landen nicht im Nummernkreis und
 * nicht im DATEV-Export, sondern nur in der Kundenakte (siehe Migration alt_rechnungen).
 */
async function UebernahmeBereich() {
  const { count, error } = await dbRoh().from("alt_rechnungen").select("id", { count: "exact", head: true });
  const unmigriert = Boolean(error && ["42P01", "PGRST205"].includes(error.code));
  if (error && !unmigriert) throw new DbFehler(error, { tabelle: "alt_rechnungen" });
  return (
    <Abschnitt titel="Datenübernahme" aktion={<span className="text-sm text-grau">Kunden, Fahrzeuge und frühere Rechnungen aus CSV-Dateien</span>}>
      {unmigriert ? (
        <p className="max-w-2xl text-sm">
          Die Datenübernahme ist noch nicht eingerichtet. Bitte die Migration <span className="zahlen">20261125100000_alt_rechnungen.sql</span> im SQL-Editor von Supabase ausführen.
        </p>
      ) : (
        <>
          <div className="mb-6 grid max-w-2xl gap-2 text-sm">
            <p>
              Legt die Kunden in der Kartei an, hängt ihre Kennzeichen mit dem letzten KM-Stand an und zeigt die früheren Rechnungen mit allen
              Positionen in der Kundenakte. Wer schon in der Kartei steht (gleicher Name und Anschrift oder gleiches Kennzeichen), wird nur
              ergänzt, nichts wird überschrieben.
            </p>
            <p className="text-grau">
              Die früheren Rechnungen bekommen keine neue Nummer, erscheinen nicht unter Rechnungen und gehen nicht in den DATEV-Export: Sie sind
              längst gestellt, das Original-PDF bleibt der gültige Beleg. Mehrmals einlesen ist unschädlich, jede Datei wird nur einmal übernommen.
            </p>
            {count ? <p className="zahlen">Bisher übernommen: {count} frühere Rechnungen.</p> : null}
          </div>
          <Datenuebernahme />
        </>
      )}
    </Abschnitt>
  );
}

async function Schnittstellen() {
  const [{ data: hooks }, { data: schluessel }, { data: zustellungen }] = await Promise.all([
    db().from("webhooks").select("*").order("erstellt_am"),
    db().from("api_schluessel").select("*").is("widerrufen_am", null).order("erstellt_am"),
    db().from("webhook_zustellungen").select("status, letzte_antwort, aktualisiert_am, webhook_id").order("id", { ascending: false }).limit(10),
  ]);
  return (
    <>
      <Abschnitt titel="Webhooks" aktion={<span className="text-sm text-grau">Für n8n, Make, Zapier oder eigene Dienste</span>}>
        <p className="mb-4 max-w-2xl text-sm">
          Bei jedem Ereignis schickt das System einen POST mit JSON an die Adresse. Der Kopf <code className="zahlen break-all">x-flc-signatur</code> enthält <code className="zahlen break-all">t=Zeit,v1=HMAC-SHA256(geheimnis, &quot;t.body&quot;)</code>. Fehlgeschlagene Zustellungen werden bis zu sechsmal wiederholt.
        </p>
        <Formular aktion={webhookAnlegen} zuruecksetzen className="mb-6 grid gap-4 border-b border-linie pb-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <Feld label="Name" name="name" placeholder="z. B. n8n Bewertungen" />
            <Feld label="Adresse (https://…)" name="url" required />
          </div>
          <fieldset>
            <legend className="label">Ereignisse</legend>
            <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="typen" value="*" className="accent-tinte" /> alle</label>
              {Object.entries(EREIGNIS_TYPEN).map(([k, t]) => (
                <label key={k} className="flex items-center gap-2 text-sm" title={t}><input type="checkbox" name="typen" value={k} className="accent-tinte" /> <span className="zahlen">{k}</span></label>
              ))}
            </div>
          </fieldset>
          <div><Senden vorab="Angelegt">Webhook anlegen</Senden></div>
        </Formular>
        <ul className="divide-y divide-linie">
          {(hooks ?? []).map((h) => (
            <Ausblenden als="li" key={h.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <span className="min-w-0">
                <span className="font-semibold">{h.name}</span>
                <span className="zahlen block text-sm text-grau">{h.url}</span>
                <span className="zahlen block text-xs text-grau">{(h.typen as string[]).join(", ")}</span>
              </span>
              <span className="flex gap-2">
                <Formular aktion={webhookTesten.bind(null, h.id)}><Senden art="rahmen" klein>Testen</Senden></Formular>
                <Formular aktion={webhookLoeschen.bind(null, h.id)} bestaetigen="Webhook löschen?" ausblenden><Senden art="rahmen" klein>Löschen</Senden></Formular>
              </span>
            </Ausblenden>
          ))}
        </ul>
        {zustellungen?.length ? (
          <details className="mt-4 text-sm">
            <summary className="cursor-pointer text-grau">Letzte Zustellungen</summary>
            <ul className="mt-2 space-y-1">
              {zustellungen.map((z, i) => (
                <li key={i} className="zahlen">{datumZeit(z.aktualisiert_am)} · {z.status} · {z.letzte_antwort}</li>
              ))}
            </ul>
          </details>
        ) : null}
      </Abschnitt>
      <Abschnitt titel="API-Schlüssel">
        <p className="mb-4 max-w-2xl text-sm">
          Lesender Zugriff über <code className="zahlen break-all">GET {ENV.siteUrl}/api/v1/…</code> mit dem Kopf <code className="zahlen break-all">Authorization: Bearer flc_…</code>. Endpunkte: <code className="zahlen break-all">termine</code>, <code className="zahlen break-all">kunden</code>, <code className="zahlen break-all">rechnungen</code>, <code className="zahlen break-all">ereignisse?nach=ID</code>, <code className="zahlen break-all">frei?leistung=radwechsel&amp;von=JJJJ-MM-TT</code>.
        </p>
        <Formular aktion={apiSchluesselAnlegen} className="mb-6 grid items-end gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
          <Feld label="Wofür?" name="name" placeholder="z. B. n8n" />
          <div className="pb-3"><Schalter label="darf auch schreiben" name="schreiben" an={false} /></div>
          <Senden vorab="Erzeugt">Schlüssel erzeugen</Senden>
        </Formular>
        <Tabelle kopf={["Name", "Beginnt mit", "Rechte", "Zuletzt benutzt", ""]}>
          {(schluessel ?? []).map((s) => (
            <Ausblenden als="tr" key={s.id}>
              <td>{s.name}</td>
              <td className="zahlen">{s.praefix}…</td>
              <td>{(s.rechte as string[]).join(", ")}</td>
              <td className="zahlen">{datumZeit(s.zuletzt_benutzt) || "nie"}</td>
              <td className="text-right">
                <Formular aktion={apiSchluesselWiderrufen.bind(null, s.id)} bestaetigen="Schlüssel widerrufen?" ausblenden><button className="text-sm underline">widerrufen</button></Formular>
              </td>
            </Ausblenden>
          ))}
        </Tabelle>
      </Abschnitt>
    </>
  );
}
