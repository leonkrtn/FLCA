import { Formular, Senden } from "@/components/admin/formular";
import { Abschnitt, Auswahl, Feld, Kopf, Reiter, Schalter, Tabelle, Textfeld } from "@/components/admin/ui";
import {
  apiSchluesselAnlegen,
  apiSchluesselWiderrufen,
  automatikSpeichern,
  benachrichtigungSpeichern,
  buchungSpeichern,
  firmaSpeichern,
  kalenderAbgleichen,
  kalenderIdSpeichern,
  kalenderTrennen,
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
import { ENV, KONFIGURIERT } from "@/lib/env";
import { EREIGNIS_TYPEN } from "@/lib/ereignisse";
import { datumZeit } from "@/lib/format";
import { db } from "@/lib/supabase/admin";

export const metadata = { title: "Einstellungen" };

const BEREICHE = [
  ["firma", "Firma"],
  ["zeiten", "Öffnungszeiten"],
  ["buchung", "Terminvergabe"],
  ["kalender", "Google Kalender"],
  ["rechnung", "Rechnungen"],
  ["automatik", "Automatik"],
  ["benachrichtigung", "Benachrichtigungen"],
  ["module", "Module"],
  ["schnittstellen", "Schnittstellen"],
  ["recht", "Rechtstexte"],
] as const;

export default async function EinstellungenSeite({ searchParams }: { searchParams: Promise<{ bereich?: string; fehler?: string; verbunden?: string }> }) {
  await benutzerMitRecht("einstellungen");
  const { bereich = "firma", fehler, verbunden } = await searchParams;
  const e = await einstellungen();
  return (
    <>
      <Kopf titel="Einstellungen" />
      <Reiter aktiv={`/admin/einstellungen?bereich=${bereich}`} eintraege={BEREICHE.map(([k, t]) => ({ href: `/admin/einstellungen?bereich=${k}`, text: t }))} />

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
            <div><Senden>Speichern</Senden></div>
          </Formular>
        </Abschnitt>
      ) : null}

      {bereich === "zeiten" ? (
        <Abschnitt titel="Öffnungszeiten" aktion={<span className="text-sm text-grau">Grundlage für freie Termine. Betriebsurlaub als ganztägigen Eintrag im Google-Kalender anlegen.</span>}>
          <Formular aktion={zeitenSpeichern} className="grid max-w-2xl gap-2">
            {WOCHENTAGE.map((tag, i) => {
              const f = e.oeffnungszeiten[String(i + 1) as "1"];
              return (
                <div key={tag} className="grid grid-cols-[6.5rem_1fr_1fr] items-center gap-2">
                  <span className="text-sm font-semibold">{tag}</span>
                  {[0, 1].map((n) => (
                    <div key={n} className="flex items-center gap-1">
                      <input type="time" step={900} name={`t${i + 1}_${n + 1}_von`} defaultValue={f[n]?.[0]} className="feld min-h-10 px-2" aria-label={`${tag} von`} />
                      <span className="text-grau">–</span>
                      <input type="time" step={900} name={`t${i + 1}_${n + 1}_bis`} defaultValue={f[n]?.[1]} className="feld min-h-10 px-2" aria-label={`${tag} bis`} />
                    </div>
                  ))}
                </div>
              );
            })}
            <div className="mt-2"><Senden>Speichern</Senden></div>
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
            <div className="sm:col-span-2 lg:col-span-3"><Senden>Speichern</Senden></div>
          </Formular>
        </Abschnitt>
      ) : null}

      {bereich === "kalender" ? <KalenderBereich fehler={fehler} verbunden={verbunden} /> : null}

      {bereich === "rechnung" ? <RechnungBereich /> : null}

      {bereich === "automatik" ? (
        <Abschnitt titel="Automatik">
          <Formular aktion={automatikSpeichern} className="grid gap-6">
            <Schalter label="Erinnerung 24 Stunden vor dem Termin" name="erinnerung" an={e.automatik.erinnerung.aktiv} hilfe="Mail an den Kunden mit Anfahrt und Absagelink" />
            <div className="grid items-end gap-3 sm:grid-cols-[1fr_12rem]">
              <Schalter label="Nach dem Termin um eine Google-Bewertung bitten" name="bewertung" an={e.automatik.bewertung.aktiv} hilfe="Einmal pro Kunde und Jahr, nur nach „Erledigt“. Link aus Firma → Google-Bewertungen." />
              <Feld label="Stunden nach dem Termin" name="stundenNach" wert={e.automatik.bewertung.stundenNach} inputMode="numeric" />
            </div>
            <div className="grid items-end gap-3 sm:grid-cols-[1fr_8rem_8rem]">
              <Schalter label="Reifen-Saison-Mail an Kunden mit eingelagerten Rädern" name="saison" an={e.automatik.saison.aktiv} hilfe="Mit Link zur Terminanfrage für den Radwechsel" />
              <Feld label="Frühjahr (MM-TT)" name="fruehjahr" wert={e.automatik.saison.fruehjahr} />
              <Feld label="Herbst (MM-TT)" name="herbst" wert={e.automatik.saison.herbst} />
            </div>
            <fieldset className="grid gap-3 border-t border-linie pt-4 sm:grid-cols-3">
              <div className="sm:col-span-3"><Schalter label="DATEV-Export am 1. jedes Monats an den Steuerberater senden" name="datev" an={e.automatik.datev.aktiv} /></div>
              <Feld label="E-Mail Steuerberater" name="datev_email" wert={e.automatik.datev.email} typ="email" />
              <Feld label="Beraternummer" name="beraterNr" wert={e.automatik.datev.beraterNr} />
              <Feld label="Mandantennummer" name="mandantNr" wert={e.automatik.datev.mandantNr} />
              <Feld label="Sachkontenlänge" name="sachkontenlaenge" wert={e.automatik.datev.sachkontenlaenge} />
              <Feld label="Erlöskonto 19 %" name="erloeskonto19" wert={e.automatik.datev.erloeskonto19} hilfe="SKR03: 8400, SKR04: 4400" />
              <Feld label="Debitoren-Sammelkonto" name="debitorSammel" wert={e.automatik.datev.debitorSammel} />
              <Feld label="Kasse" name="kasse" wert={e.automatik.datev.kasse} />
              <Feld label="Bank" name="bank" wert={e.automatik.datev.bank} />
            </fieldset>
            <div><Senden>Speichern</Senden></div>
          </Formular>
        </Abschnitt>
      ) : null}

      {bereich === "benachrichtigung" ? (
        <Abschnitt titel="Benachrichtigungen">
          <Formular aktion={benachrichtigungSpeichern} className="grid max-w-xl gap-4">
            <Textfeld label="E-Mail-Adressen für neue Anfragen und Bewerbungen" name="emails" wert={e.benachrichtigung.emails.join("\n")} zeilen={3} hilfe={`Eine pro Zeile. Leer = ${e.firma.email}. Push-Nachrichten schaltet jede Person in ihrer Handy-App selbst ein.`} />
            <div><Senden>Speichern</Senden></div>
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
            <div><Senden>Speichern</Senden></div>
          </Formular>
        </Abschnitt>
      ) : null}

      {bereich === "schnittstellen" ? <Schnittstellen /> : null}

      {bereich === "recht" ? (
        <Abschnitt titel="Rechtstexte">
          <Formular aktion={rechtstexteSpeichern} className="grid gap-4">
            <p className="text-sm text-grau">Am besten von einem Rechtstexte-Dienst (z. B. IT-Recht Kanzlei). Dort die „HTML-Adresse“ bzw. iFrame-URL des Textes eintragen. Die Seite lädt ihn täglich neu. Der Text darunter gilt, wenn der Dienst nicht erreichbar ist.</p>
            <Feld label="Adresse Datenschutzerklärung" name="datenschutzUrl" wert={e.rechtstexte.datenschutzUrl} placeholder="https://…" />
            <Feld label="Adresse AGB" name="agbUrl" wert={e.rechtstexte.agbUrl} placeholder="https://…" />
            <Textfeld label="Datenschutzerklärung (Ersatztext)" name="datenschutzText" wert={e.rechtstexte.datenschutzText} zeilen={8} />
            <Textfeld label="AGB (Ersatztext)" name="agbText" wert={e.rechtstexte.agbText} zeilen={8} />
            <div><Senden>Speichern</Senden></div>
          </Formular>
        </Abschnitt>
      ) : null}
    </>
  );
}

async function KalenderBereich({ fehler, verbunden }: { fehler?: string; verbunden?: string }) {
  const { data: k } = await db().from("kalender_verbindung").select("*").eq("id", 1).maybeSingle();
  const ist = Boolean(k?.refresh_token);
  return (
    <Abschnitt titel="Google Kalender">
      {!KONFIGURIERT.google ? (
        <p className="border-l-2 border-kreide bg-papier px-4 py-3">
          Es fehlen GOOGLE_CLIENT_ID und GOOGLE_CLIENT_SECRET in Vercel. Die Anleitung steht in der README unter „Google Kalender“. Weiterleitungs-URI: <code className="zahlen">{ENV.siteUrl}/api/google/rueckruf</code>
        </p>
      ) : ist ? (
        <div className="grid gap-6">
          <dl className="grid gap-y-1 sm:grid-cols-[12rem_1fr]">
            <dt className="text-grau">Verbunden mit</dt>
            <dd className="font-semibold">{k!.konto_email || "Google-Konto"}</dd>
            <dt className="text-grau">Letzter Abgleich</dt>
            <dd>{datumZeit(k!.letzter_sync) || "noch keiner"}</dd>
            <dt className="text-grau">Live-Benachrichtigung bis</dt>
            <dd>{k!.kanal_ablauf ? datumZeit(k!.kanal_ablauf) : "nicht aktiv (Abgleich läuft alle 10 Minuten)"}</dd>
            {k!.letzter_fehler ? (
              <>
                <dt className="text-grau">Fehler</dt>
                <dd className="text-rot">{k!.letzter_fehler}</dd>
              </>
            ) : null}
          </dl>
          <Formular aktion={kalenderIdSpeichern} className="grid max-w-md gap-2">
            <Feld label="Kalender" name="kalender_id" wert={k!.kalender_id} hilfe="„primary“ = Hauptkalender. Für einen eigenen Werkstattkalender dessen ID aus den Google-Kalender-Einstellungen eintragen." />
            <div><Senden klein>Speichern</Senden></div>
          </Formular>
          <div className="flex flex-wrap gap-2">
            <Formular aktion={kalenderAbgleichen}><Senden art="rahmen" klein>Jetzt abgleichen</Senden></Formular>
            <a href="/api/google/verbinden" className="knopf knopf-rahmen knopf-klein">Neu verbinden</a>
            <Formular aktion={kalenderTrennen} bestaetigen="Verbindung wirklich trennen?"><Senden art="rahmen" klein>Trennen</Senden></Formular>
          </div>
          <div className="text-sm text-grau">
            <p className="mb-1 font-semibold text-tinte">So zählt der Kalender:</p>
            <p>Bestätigte Termine trägt das System selbst ein. Was Sie direkt in Google eintragen, blockiert freie Zeiten: mit Uhrzeit einen Arbeitsplatz, ganztägig die ganze Werkstatt (z. B. Betriebsurlaub). Einträge, die in Google auf „Verfügbar“ stehen, blockieren nichts.</p>
          </div>
        </div>
      ) : (
        <div className="grid gap-4">
          {fehler ? <p className="text-rot">Verbindung nicht geklappt ({fehler}). Bitte noch einmal versuchen.</p> : null}
          {verbunden ? <p className="text-ok">Verbunden.</p> : null}
          <p className="max-w-xl">Verbinden Sie den Google-Kalender des Betriebs. Danach landen bestätigte Termine automatisch dort, und Kunden sehen keine Zeiten, die im Kalender schon belegt sind.</p>
          <a href="/api/google/verbinden" className="knopf knopf-dunkel w-fit">Mit Google verbinden</a>
        </div>
      )}
    </Abschnitt>
  );
}

async function RechnungBereich() {
  const e = await einstellungen();
  const [{ data: k }, { count }] = await Promise.all([
    db().from("nummernkreise").select("*").eq("art", "rechnung").single(),
    db().from("rechnungen").select("id", { count: "exact", head: true }).not("nummer", "is", null),
  ]);
  const gesperrt = (count ?? 0) > 0;
  const beispiel = `${k?.praefix ?? ""}${k?.mit_jahr ? `${new Date().getFullYear()}-` : ""}${String(k?.naechste ?? 1).padStart(k?.stellen ?? 4, "0")}`;
  return (
    <Abschnitt titel="Rechnungen">
      <Formular aktion={rechnungEinstellungen} className="grid gap-6">
        <fieldset className="grid gap-4 sm:grid-cols-4">
          <legend className="mb-2 font-semibold">Nummernkreis · nächste Nummer: <span className="zahlen">{beispiel}</span></legend>
          {gesperrt ? (
            <p className="text-sm text-grau sm:col-span-4">Gesperrt: Es sind schon Rechnungen gestellt. Die Nummern laufen lückenlos weiter (GoBD).</p>
          ) : (
            <>
              <input type="hidden" name="nummernkreis" value="1" />
              <Feld label="Präfix" name="praefix" wert={k?.praefix} />
              <Feld label="Nächste Nummer" name="naechste" wert={k?.naechste} inputMode="numeric" hilfe="z. B. die letzte Nummer der alten Software + 1" />
              <Feld label="Stellen" name="stellen" wert={k?.stellen} inputMode="numeric" />
              <div className="self-end pb-3"><Schalter label="Jahr in der Nummer" name="mit_jahr" an={k?.mit_jahr ?? true} /></div>
            </>
          )}
        </fieldset>
        <Feld label="Zahlungsziel (Tage)" name="zahlungszielTage" wert={e.rechnung.zahlungszielTage} inputMode="numeric" className="max-w-xs" />
        <Textfeld label="Einleitungssatz" name="einleitung" wert={e.rechnung.einleitung} zeilen={2} />
        <Textfeld label="Fußtext" name="fusstext" wert={e.rechnung.fusstext} zeilen={2} />
        <div><Senden>Speichern</Senden></div>
      </Formular>
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
          Bei jedem Ereignis schickt das System einen POST mit JSON an die Adresse. Der Kopf <code className="zahlen">x-flc-signatur</code> enthält <code className="zahlen">t=Zeit,v1=HMAC-SHA256(geheimnis, &quot;t.body&quot;)</code>. Fehlgeschlagene Zustellungen werden bis zu sechsmal wiederholt.
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
          <div><Senden>Webhook anlegen</Senden></div>
        </Formular>
        <ul className="divide-y divide-linie">
          {(hooks ?? []).map((h) => (
            <li key={h.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <span>
                <span className="font-semibold">{h.name}</span>
                <span className="zahlen block text-sm text-grau">{h.url}</span>
                <span className="zahlen block text-xs text-grau">{(h.typen as string[]).join(", ")}</span>
              </span>
              <span className="flex gap-2">
                <Formular aktion={webhookTesten.bind(null, h.id)}><Senden art="rahmen" klein>Testen</Senden></Formular>
                <Formular aktion={webhookLoeschen.bind(null, h.id)} bestaetigen="Webhook löschen?"><Senden art="rahmen" klein>Löschen</Senden></Formular>
              </span>
            </li>
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
          Lesender Zugriff über <code className="zahlen">GET {ENV.siteUrl}/api/v1/…</code> mit dem Kopf <code className="zahlen">Authorization: Bearer flc_…</code>. Endpunkte: <code className="zahlen">termine</code>, <code className="zahlen">kunden</code>, <code className="zahlen">rechnungen</code>, <code className="zahlen">ereignisse?nach=ID</code>, <code className="zahlen">frei?leistung=radwechsel&amp;von=JJJJ-MM-TT</code>.
        </p>
        <Formular aktion={apiSchluesselAnlegen} className="mb-6 grid items-end gap-3 sm:grid-cols-[1fr_auto_auto]">
          <Feld label="Wofür?" name="name" placeholder="z. B. n8n" />
          <div className="pb-3"><Schalter label="darf auch schreiben" name="schreiben" an={false} /></div>
          <Senden>Schlüssel erzeugen</Senden>
        </Formular>
        <Tabelle kopf={["Name", "Beginnt mit", "Rechte", "Zuletzt benutzt", ""]}>
          {(schluessel ?? []).map((s) => (
            <tr key={s.id}>
              <td>{s.name}</td>
              <td className="zahlen">{s.praefix}…</td>
              <td>{(s.rechte as string[]).join(", ")}</td>
              <td className="zahlen">{datumZeit(s.zuletzt_benutzt) || "nie"}</td>
              <td className="text-right">
                <Formular aktion={apiSchluesselWiderrufen.bind(null, s.id)} bestaetigen="Schlüssel widerrufen?"><button className="text-sm underline">widerrufen</button></Formular>
              </td>
            </tr>
          ))}
        </Tabelle>
      </Abschnitt>
    </>
  );
}
