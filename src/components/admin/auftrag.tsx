import Link from "next/link";
import { Absenden, Formular, Senden } from "./formular";
import { PositionenUebersicht } from "./positionen-uebersicht";
import { Auswahl, Feld, Marke, Textfeld } from "./ui";
import { Unterschrift } from "./unterschrift";
import { DateiKnopf } from "@/components/mobil/datei-knopf";
import { FotoKnopf } from "@/components/mobil/auftrag";
import type { Ort } from "@/lib/aktionen/belege";
import {
  annahmeAktion,
  auftragAnlegenAktion,
  auftragVersendenAktion,
  erteilungZuruecknehmenAktion,
  kvAmTerminVerknuepfen,
  kvAusTerminAktion,
  kvTerminLoesenAktion,
} from "@/lib/aktionen/auftrag";
import type { AuftragTermin } from "@/lib/auftrag";
import { auftragAnBildschirmAktion } from "@/lib/aktionen/kundenbildschirm";
import { type KalenderAnsicht, mitKal } from "@/lib/kalender-ansicht";
import { AUFTRAG_STAND_TEXT, AUFTRAG_STAND_TON, auftragStand, erteiltText, grenzeText, TANKSTAENDE } from "@/lib/auftrag-regeln";
import { datum, datumZeit, euro } from "@/lib/format";
import { KV_STATUS } from "@/lib/rechnung/kostenvoranschlaege";
import type { KvAmTermin } from "@/lib/termin-daten";

const OFFEN = ["ungeplant", "angefragt", "bestaetigt", "erledigt"];

/**
 * Werkstattauftrag am Termin (Verwaltung und Handy-App): anlegen, Positionen, PDF, Erteilung per Unterschrift
 * oder per Mail zur Freigabe. Ohne erteilten Auftrag darf die Werkstatt anfangen, sieht aber die Warnung.
 */
/** `kal`: Termin wurde aus dem Kalender geöffnet; der Weg zu den Positionen nimmt das mit (zurück bis in den Kalender). */
export function AuftragBereich({ t, ort, kal }: { t: AuftragTermin; ort: Ort; kal?: KalenderAnsicht | null }) {
  const stand = auftragStand(t);
  if (stand === "kein") {
    if (!OFFEN.includes(t.status)) return <p className="text-grau">Zu diesem Termin gibt es keinen Auftrag.</p>;
    return (
      <Formular aktion={auftragAnlegenAktion.bind(null, t.id)} className="grid gap-3">
        <p className="text-sm text-grau">
          Noch kein Werkstattauftrag. Er übernimmt die Leistungen des Termins (oder einen angenommenen Kostenvoranschlag), der Kunde erteilt ihn per Unterschrift oder online.
        </p>
        <Senden vorab="Angelegt">Werkstattauftrag anlegen</Senden>
      </Formular>
    );
  }
  const warnung = grenzeText(t);
  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-semibold">{t.auftrag_nummer}</span>
          <Marke ton={AUFTRAG_STAND_TON[stand]}>{AUFTRAG_STAND_TEXT[stand]}</Marke>
        </span>
        <span className="zahlen font-semibold">{euro(t.auftrag_summe_brutto_cent ?? 0)}</span>
      </div>
      {t.auftrag_kostengrenze_cent != null ? (
        <p className={`text-sm ${warnung ? "font-semibold text-rot" : "text-grau"}`}>{warnung || `Kostengrenze ${euro(t.auftrag_kostengrenze_cent)}`}</p>
      ) : null}
      {t.auftrag_positionen?.length ? <PositionenUebersicht positionen={t.auftrag_positionen} /> : <p className="text-sm text-grau">Noch keine Positionen.</p>}
      <div className="knopfreihe knopfreihe-frei">
        <Link href={mitKal(`/${ort}/termine/${t.id}/auftrag`, kal ?? null)} className="knopf knopf-rahmen">Positionen bearbeiten</Link>
        <DateiKnopf art="datei" href={`/admin/termine/${t.id}/auftrag/pdf`} className="knopf knopf-rahmen">PDF</DateiKnopf>
      </div>

      {stand === "erteilt" ? (
        <div className="grid gap-3 border-t border-linie pt-4">
          <p className="font-semibold text-ok">{erteiltText(t)}</p>
          {t.auftrag_erteilt_brutto_cent != null && t.auftrag_erteilt_brutto_cent !== t.auftrag_summe_brutto_cent ? (
            <p className="text-sm text-grau">Bei der Erteilung waren es {euro(t.auftrag_erteilt_brutto_cent)}.</p>
          ) : null}
          {t.unterschrift ? (
            // eslint-disable-next-line @next/next/no-img-element -- data:-URL aus der Datenbank, kein Bild zum Optimieren
            <img src={t.unterschrift} alt={`Unterschrift ${t.auftrag_erteilt_name}`} className="h-20 w-auto max-w-full self-start rounded-md bg-flaeche p-1" />
          ) : null}
          <details className="text-sm">
            <summary className="cursor-pointer text-grau">Erteilung zurücknehmen …</summary>
            <Formular aktion={erteilungZuruecknehmenAktion.bind(null, t.id)} bestaetigen="Erteilung wirklich zurücknehmen? Die Unterschrift wird gelöscht." className="mt-3 grid gap-2">
              <p className="max-w-md">Nur bei einem Versehen (falsche Person, falscher Termin). Danach lässt sich der Auftrag neu erteilen.</p>
              <Senden art="rahmen" klein vorab="Zurückgenommen">Zurücknehmen</Senden>
            </Formular>
          </details>
        </div>
      ) : OFFEN.includes(t.status) ? (
        <div className="grid gap-4 border-t border-linie pt-4">
          <p className="text-sm font-semibold text-warnung">Der Kunde hat den Auftrag noch nicht erteilt. Die Werkstatt kann trotzdem anfangen, sieht aber einen Hinweis.</p>
          <Formular aktion={auftragAnBildschirmAktion.bind(null, t.id)} className="grid gap-2">
            <div className="flex flex-wrap items-center gap-3">
              <Senden art="rahmen" vorab="Geschickt">Am Kundenbildschirm unterschreiben</Senden>
              <span className="text-sm text-grau">Der Kunde sieht den Auftrag am Bildschirm im Büro und unterschreibt mit der Maus.</span>
            </div>
          </Formular>
          <details open={ort === "app"}>
            <summary className="cursor-pointer font-semibold">Vor Ort unterschreiben lassen</summary>
            <div className="mt-3">
              <Unterschrift terminId={t.id} name={t.kunde?.name ?? ""} />
            </div>
          </details>
          <details>
            <summary className="cursor-pointer font-semibold">Per E-Mail zur Freigabe senden</summary>
            <Formular aktion={auftragVersendenAktion.bind(null, t.id)} className="mt-3 grid max-w-md gap-2">
              <p className="text-sm text-grau">Der Kunde bekommt das PDF und erteilt den Auftrag über seinen Terminlink.</p>
              <Feld label="An" name="an" typ="email" wert={t.auftrag_gesendet_an ?? t.kundeVoll?.email ?? t.kunde?.email ?? ""} />
              <Senden art="rahmen" vorab="Wird gesendet">{t.auftrag_gesendet_am ? "Erneut senden" : "Senden"}</Senden>
            </Formular>
            {t.auftrag_gesendet_am ? <p className="mt-2 text-sm text-grau">Gesendet {datumZeit(t.auftrag_gesendet_am)} an {t.auftrag_gesendet_an}</p> : null}
          </details>
          <DateiKnopf art="link" href={`/t/${t.token}#auftrag`} className="text-sm text-grau underline">
            {ort === "app" ? "Kundenlink teilen" : "Kundenansicht öffnen"}
          </DateiKnopf>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Fahrzeugannahme: was bei der Übergabe festgehalten wird. Nichts davon ist Pflicht. km und Fahrzeugschein-Daten
 * gehen auch an das Fahrzeug in der Kartei.
 */
export function AnnahmeFormular({ t, fotos, kompakt = false }: { t: AuftragTermin; fotos: { id: string; url: string; notiz: string; art: string }[]; kompakt?: boolean }) {
  const a = t.annahme ?? {};
  const f = t.fahrzeugVoll;
  const vorschaeden = fotos.filter((x) => x.art === "vorschaden");
  return (
    <div className="grid gap-4">
      <Formular aktion={annahmeAktion.bind(null, t.id)} className={`grid gap-4 ${kompakt ? "" : "sm:grid-cols-2"}`}>
        <Textfeld label="Auftrag / Beanstandung des Kunden" name="beschreibung" wert={t.auftrag_beschreibung} zeilen={2} className={kompakt ? "" : "sm:col-span-2"} />
        <Feld label="Kilometerstand" name="km_stand" wert={t.km_stand} inputMode="numeric" />
        <Auswahl label="Tank / Ladung" name="tank" wert={a.tank ?? ""} leer="–" optionen={TANKSTAENDE.map((x) => [x, x])} />
        <Feld label="Schlüssel übergeben" name="schluessel" wert={a.schluessel ?? ""} inputMode="numeric" />
        <Feld label="Erstzulassung" name="erstzulassung" wert={f?.erstzulassung ?? ""} placeholder="MM/JJJJ" />
        <Feld label="FIN" name="fin" wert={f?.fin ?? ""} autoCapitalize="characters" className={kompakt ? "" : "sm:col-span-2"} />
        <Feld label="HSN" name="hsn" wert={f?.hsn ?? ""} inputMode="numeric" />
        <Feld label="TSN" name="tsn" wert={f?.tsn ?? ""} autoCapitalize="characters" />
        <Textfeld label="Vorschäden" name="vorschaeden" wert={a.vorschaeden ?? ""} zeilen={2} className={kompakt ? "" : "sm:col-span-2"} />
        <div className={kompakt ? "" : "sm:col-span-2"}>
          <Senden art="rahmen" vorab="Gespeichert" className={kompakt ? "w-full" : ""}>Annahme speichern</Senden>
        </div>
      </Formular>
      {!t.fahrzeug ? <p className="text-sm text-grau">Der Termin hat kein Fahrzeug; FIN, HSN, TSN und Erstzulassung werden erst mit Fahrzeug gespeichert.</p> : null}
      <FotoKnopf id={t.id} art="vorschaden" text="Vorschaden fotografieren" />
      {vorschaeden.length ? (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {vorschaeden.map((x) => (
            <a key={x.id} href={x.url} target="_blank" rel="noreferrer" className="block aspect-square overflow-hidden bg-boden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={x.url} alt="Vorschaden" className="size-full object-cover" loading="lazy" />
            </a>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** Kostenvoranschläge am Termin: verknüpfte anzeigen, neuen aus dem Termin anlegen, vorhandenen des Kunden verknüpfen. */
/** `ohneZeit`: Die Terminzeile trägt nur den Auftrag aus dem Kostenvoranschlag, lösen ginge an seiner Herkunft vorbei. */
export function KvAmTerminBereich({ terminId, ort, kvs, ohneZeit = false }: { terminId: string; ort: Ort; kvs: { verknuepft: KvAmTermin[]; frei: KvAmTermin[] }; ohneZeit?: boolean }) {
  return (
    <div className="grid gap-3">
      {kvs.verknuepft.length ? (
        <ul className="space-y-2">
          {kvs.verknuepft.map((k) => (
            <li key={k.id} className="flex items-center gap-2">
              <Link href={`/${ort}/kostenvoranschlaege/${k.id}`} className="flex min-w-0 flex-1 justify-between gap-2 hover:underline">
                <span className="min-w-0">
                  {k.nummer ?? "Entwurf"} <span className="text-grau">· {KV_STATUS[k.status as keyof typeof KV_STATUS] ?? k.status}</span>
                </span>
                <span className="zahlen">{euro(k.summe_brutto_cent)}</span>
              </Link>
              {ohneZeit ? null : (
                <form action={kvTerminLoesenAktion.bind(null, k.id, terminId)}>
                  <Absenden className="text-xs text-grau underline hover:text-tinte" title="Verknüpfung lösen, der Kostenvoranschlag bleibt">
                    lösen
                  </Absenden>
                </form>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-grau">Nimmt der Kunde einen Kostenvoranschlag zu diesem Termin an, wird er zum erteilten Werkstattauftrag.</p>
      )}
      <form action={kvAusTerminAktion.bind(null, terminId, ort)}>
        <Senden art="rahmen" className="w-full">Kostenvoranschlag erstellen</Senden>
      </form>
      {kvs.frei.length ? (
        <Formular aktion={kvAmTerminVerknuepfen.bind(null, terminId)} className="grid gap-2">
          <Auswahl
            label="Vorhandenen Kostenvoranschlag verknüpfen"
            name="kv"
            leer="bitte wählen"
            optionen={kvs.frei.map((k) => [k.id, [k.nummer ?? `Entwurf vom ${datum(k.erstellt_am)}`, euro(k.summe_brutto_cent), KV_STATUS[k.status as keyof typeof KV_STATUS]].join(" · ")])}
          />
          <Senden art="rahmen" klein vorab="Verknüpft">Mit Termin verknüpfen</Senden>
        </Formular>
      ) : null}
    </div>
  );
}
