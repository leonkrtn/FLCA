import Link from "next/link";
import { DateiKnopf } from "@/components/mobil/datei-knopf";
import { datumZeit, euro } from "@/lib/format";
import { groesse } from "@/lib/mail/adressen";
import { verlaufAbschneiden } from "@/lib/mail/inhalt";
import { kundeZuAdresse } from "@/lib/mail/kunde";
import { gespraechLaden, mailLaden, type MailZeile, type Zugang } from "@/lib/mail/postfach";
import { darf } from "@/lib/rollen";
import { ansichtHref, type MailAnsicht } from "./ansicht";
import { AlsGelesen } from "./gelesen";
import { HtmlInhalt } from "./html-inhalt";
import { LeseAktionen } from "./lese-aktionen";
import type { Kategorie, PersonKurz } from "./liste";
import { SchreibenKnopf } from "./schreiben";

/**
 * Lesebereich: eine Unterhaltung (ältere Mails eingeklappt, die neueste offen, mitzitierter Verlauf abgeschnitten
 * und aufklappbar) oder in der Einzelansicht eine Mail ganz. Daneben am großen Bildschirm der Kunde aus der Kartei.
 */
export async function Lesebereich({
  z,
  ansicht,
  basis,
  ort,
  kategorien,
  personen,
}: {
  z: Zugang;
  ansicht: MailAnsicht;
  basis: string;
  ort: "admin" | "app" | "team";
  kategorien: Kategorie[];
  personen: PersonKurz[];
}) {
  const mobil = ort !== "admin";
  const einzeln = ansicht.e;
  const mails = einzeln ? await mailLaden(z, ansicht.g).then((m) => (m ? [m] : null)) : await gespraechLaden(z, ansicht.g, ansicht.o === "papierkorb");
  if (!mails?.length) {
    return <p className="p-10 text-center text-grau">Diese Mail gibt es nicht mehr. Vielleicht wurde sie verschoben oder gelöscht.</p>;
  }
  const letzte = mails.at(-1)!;
  const letzteEingang = [...mails].reverse().find((m) => m.richtung === "eingang") ?? letzte;
  const ungelesen = mails.some((m) => m.richtung === "eingang" && !m.gelesen_am);
  const gegenueber = letzteEingang.richtung === "eingang" ? letzteEingang.von : letzte.an[0];
  const kunde = await kundeZuAdresse(z, gegenueber ?? "");
  const zurueck = mobil ? ansichtHref(basis, { ...ansicht, g: "" }) : ansichtHref(basis, ansicht, { g: "" });
  const zuweisbar = z.firma && mails.some((m) => m.postfach === null);

  return (
    <div className="grid min-h-0 gap-0 xl:grid-cols-[minmax(0,1fr)_17rem]">
      <div className="min-w-0">
        {ungelesen ? <AlsGelesen gespraech={einzeln ? undefined : ansicht.g} mail={einzeln ? ansicht.g : undefined} /> : null}
        <div className={`sticky top-0 z-10 border-b border-linie bg-weiss px-4 pb-2 pt-3 ${mobil ? "" : "md:px-6"}`}>
          {!mobil ? <h2 className="mb-2 text-xl font-semibold leading-tight">{letzte.betreff || "(ohne Betreff)"}</h2> : null}
          <LeseAktionen
            ziel={einzeln ? { mails: [ansicht.g] } : { gespraeche: [ansicht.g] }}
            ordner={ansicht.o}
            antwortAuf={letzteEingang.id}
            weiterleiten={letzte.id}
            druckHref={`/druck/mail/${ansicht.g}${einzeln ? "?e=1" : ""}`}
            zurueck={zurueck}
            stand={{
              gekennzeichnet: mails.some((m) => m.gekennzeichnet),
              angeheftet: mails.some((m) => m.angeheftet),
              kategorien: [...new Set(mails.flatMap((m) => m.kategorien))],
              zugewiesen_an: mails.find((m) => m.zugewiesen_an)?.zugewiesen_an ?? null,
              imPapierkorb: ansicht.o === "papierkorb",
              archiviert: mails.some((m) => m.ordner === "archiv") && !mails.some((m) => m.ordner === "eingang" || m.ordner === "sonstige"),
              eingang: mails.some((m) => m.richtung === "eingang"),
            }}
            kategorien={kategorien}
            personen={personen}
            zuweisbar={zuweisbar}
          />
        </div>
        <div className={`grid gap-3 p-3 ${mobil ? "" : "md:p-4"}`}>
          {mails.map((m, i) => (
            <Nachricht key={m.id} m={m} offen={i === mails.length - 1 || (m.richtung === "eingang" && !m.gelesen_am) || mails.length <= 2} kuerzen={!einzeln && mails.length > 1} mobil={mobil} />
          ))}
        </div>
      </div>
      <KundenSpalte kunde={kunde} adresse={gegenueber ?? ""} name={letzteEingang.richtung === "eingang" ? letzteEingang.von_name : ""} ort={ort} z={z} />
    </div>
  );
}

function Nachricht({ m, offen, kuerzen, mobil }: { m: MailZeile; offen: boolean; kuerzen: boolean; mobil: boolean }) {
  const teile = kuerzen ? verlaufAbschneiden(m.html ?? m.text, Boolean(m.html)) : { neu: m.html ?? m.text, verlauf: "" };
  const inhalt = (html: string, istHtml: boolean) => (istHtml ? <HtmlInhalt html={html} /> : <div className="whitespace-pre-wrap break-words">{html}</div>);
  const externeBilder = Boolean(m.html && /<img[^>]+src=["']?https?:/i.test(m.html));
  const absender = m.richtung === "ausgang" ? `${m.von_name || m.von} (gesendet)` : m.von_name || m.von;
  return (
    <details open={offen} className="group/n rounded-lg bg-weiss shadow-sm ring-1 ring-linie">
      <summary className="flex cursor-pointer list-none items-start justify-between gap-3 px-4 py-3">
        <span className="grid min-w-0 gap-0.5">
          <span className="truncate font-semibold">
            {absender}
            {m.richtung === "eingang" && m.von_name ? <span className="font-normal text-grau"> &lt;{m.von}&gt;</span> : null}
          </span>
          <span className="truncate text-sm text-grau">
            An {m.an.join(", ") || "(niemand)"}
            {m.cc.length ? ` · Cc ${m.cc.join(", ")}` : ""}
            {m.bcc.length ? ` · Bcc ${m.bcc.join(", ")}` : ""}
          </span>
          <span className="truncate text-sm text-grau group-open/n:hidden">{(m.text || "").slice(0, 140)}</span>
        </span>
        <span className="zahlen shrink-0 text-sm text-grau">{datumZeit(m.erstellt_am)}</span>
      </summary>
      <div className="grid gap-3 border-t border-linie px-4 py-3">
        {m.richtung === "ausgang" && (m.zustellung || m.versand_fehler) ? (
          <p className={`text-sm font-semibold ${m.zustellung === "abgewiesen" || m.versand === "fehler" ? "text-rot" : "text-grau"}`}>
            {m.zustellung === "zugestellt" ? "Zugestellt" : m.zustellung === "abgewiesen" ? "Nicht zugestellt" : m.zustellung === "verzoegert" ? "Zustellung verzögert" : m.zustellung === "beschwerde" ? "Als Spam gemeldet" : ""}
            {m.zustellung_am ? ` · ${datumZeit(m.zustellung_am)}` : ""}
            {m.versand_fehler ? ` · ${m.versand_fehler}` : ""}
          </p>
        ) : null}
        {inhalt(teile.neu, Boolean(m.html))}
        {teile.verlauf ? (
          <details className="text-sm">
            <summary className="cursor-pointer select-none text-grau hover:text-tinte">Verlauf anzeigen</summary>
            <div className="mt-2">{inhalt(teile.verlauf, Boolean(m.html))}</div>
          </details>
        ) : null}
        {externeBilder ? <p className="text-xs text-grau">Bilder von fremden Servern werden zum Schutz vor Zählpixeln nicht geladen.</p> : null}
        {m.anhaenge.length ? (
          <ul className="flex flex-wrap gap-2">
            {m.anhaenge.map((a, i) => {
              const href = `/api/mail/anhang/${m.id}/${i}`;
              const text = (
                <>
                  <span className="max-w-56 truncate">{a.name}</span> <span className="zahlen font-normal text-grau">{groesse(a.groesse)}</span>
                </>
              );
              return (
                <li key={a.pfad}>
                  {mobil ? (
                    <DateiKnopf art="datei" href={href} className="knopf knopf-rahmen knopf-klein">{text}</DateiKnopf>
                  ) : (
                    <a href={href} className="knopf knopf-rahmen knopf-klein">{text}</a>
                  )}
                </li>
              );
            })}
          </ul>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <SchreibenKnopf art="antwort" mailId={m.id}>Antworten</SchreibenKnopf>
          <SchreibenKnopf art="weiter" mailId={m.id}>Weiterleiten</SchreibenKnopf>
        </div>
      </div>
    </details>
  );
}

/** Kunde zur Adresse des Gegenübers: Fahrzeuge, nächster Termin, offene Rechnungen und Knöpfe zum Anlegen. */
function KundenSpalte({ kunde, adresse, name, ort, z }: { kunde: Awaited<ReturnType<typeof kundeZuAdresse>>; adresse: string; name: string; ort: "admin" | "app" | "team"; z: Zugang }) {
  if (!darf(z.rolle, "kunden") || !adresse) return null;
  const pfad = ort === "app" ? "/app" : "/admin";
  const k = "knopf knopf-rahmen knopf-klein w-full";
  return (
    <aside className="border-t border-linie bg-papier p-4 text-sm xl:border-l xl:border-t-0">
      {kunde ? (
        <div className="grid gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-grau">Kunde</p>
            <Link href={`${pfad}/kunden/${kunde.id}`} className="text-base font-semibold hover:underline">{kunde.name}</Link>
            <p className="zahlen text-grau">Nr. {kunde.nummer}{kunde.firma ? ` · ${kunde.firma}` : ""}</p>
            {kunde.telefon ? <a href={`tel:${kunde.telefon}`} className="text-grau underline">{kunde.telefon}</a> : null}
          </div>
          {kunde.fahrzeuge.length ? (
            <div>
              <p className="font-semibold">Fahrzeuge</p>
              {kunde.fahrzeuge.map((f) => (
                <p key={f.kennzeichen} className="text-grau"><span className="zahlen text-tinte">{f.kennzeichen}</span> {f.marke_modell}</p>
              ))}
            </div>
          ) : null}
          {kunde.naechsterTermin ? (
            <div>
              <p className="font-semibold">Nächster Termin</p>
              <Link href={`${pfad}/termine/${kunde.naechsterTermin.id}`} className="text-grau underline">
                {datumZeit(kunde.naechsterTermin.beginn)} · {kunde.naechsterTermin.leistung}
                {kunde.naechsterTermin.status === "angefragt" ? " (Anfrage)" : ""}
              </Link>
            </div>
          ) : null}
          {kunde.offen.length ? (
            <div>
              <p className="font-semibold text-rot">Offen</p>
              {kunde.offen.map((r) => (
                <Link key={r.id} href={`/admin/rechnungen/${r.id}`} className="block text-grau underline">
                  {r.nummer} · <span className="zahlen">{euro(r.offen_cent)}</span>
                </Link>
              ))}
            </div>
          ) : null}
          <div className="grid gap-2">
            {darf(z.rolle, "termine") ? <Link href={ort === "app" ? `/app/neu?kunde=${kunde.id}` : `/admin/termine/neu?kunde=${kunde.id}`} className={k}>Termin anlegen</Link> : null}
            {darf(z.rolle, "notizen") ? <Link href={`${pfad}/notizen/neu?kunde=${kunde.id}`} className={k}>Notiz anlegen</Link> : null}
          </div>
        </div>
      ) : (
        <div className="grid gap-2">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-grau">Kunde</p>
          <p className="text-grau">{adresse} ist nicht in der Kartei.</p>
          <Link href={ort === "app" ? `/app/kunden/neu` : `/admin/kunden?neu=1&name=${encodeURIComponent(name)}&email=${encodeURIComponent(adresse)}`} className={k}>Kunde anlegen</Link>
        </div>
      )}
    </aside>
  );
}
