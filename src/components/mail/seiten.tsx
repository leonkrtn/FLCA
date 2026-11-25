import Link from "next/link";
import { notFound } from "next/navigation";
import { Formular, Senden } from "@/components/admin/formular";
import { Abschnitt, Kopf, Leer, Reiter } from "@/components/admin/ui";
import { DateiKnopf } from "@/components/mobil/datei-knopf";
import { MobilKopf, MobilReiter } from "@/components/mobil/teile";
import { alsUngelesen, gespraechEntfernen, mailSenden } from "@/lib/aktionen/mail";
import { benutzerMitRecht } from "@/lib/auth";
import { KONFIGURIERT } from "@/lib/env";
import { datum, datumZeit, zeit } from "@/lib/format";
import { antwortBetreff, groesse, zitat } from "@/lib/mail/adressen";
import { eigeneAdresse, firmenAdresse, type Gespraech, gespraecheLaden, gespraechLaden, type MailZeile, ungelesen } from "@/lib/mail/postfach";
import { darf } from "@/lib/rollen";
import { berlinDatum } from "@/lib/zeit";
import { AlsGelesen } from "./gelesen";
import { HtmlInhalt } from "./html-inhalt";
import { Verfassen } from "./verfassen";

/**
 * Seiten des Postfachs für Verwaltung (`admin`), Werkstatt-App (`app`) und Team-App (`team`). Die Seiten-Dateien
 * reichen nur den Ort durch. Das Firmenpostfach gibt es nur in Verwaltung und Werkstatt-App (Recht „firmenmail“).
 */
export type Ort = "admin" | "app" | "team";
const BASIS = { admin: "/admin/mail", app: "/app/mail", team: "/team/mail" } as const;

type Wahl = "firma" | "ich";

async function grundlagen(ort: Ort, gewuenscht?: string) {
  const b = await benutzerMitRecht("werkstatt");
  const firma = ort !== "team" && darf(b.rolle, "firmenmail");
  // Inhaber und Büro landen zuerst im Firmenpostfach, dort kommen die Kunden an
  const wahl: Wahl = firma && gewuenscht !== "ich" ? "firma" : "ich";
  return { b, firma, wahl, basis: BASIS[ort] };
}

/** Wann: heute nur die Uhrzeit, sonst das Datum. */
function wann(wert: string): string {
  return berlinDatum(new Date(wert)) === berlinDatum() ? zeit(wert) : datum(wert);
}

function EinrichtungHinweis() {
  if (KONFIGURIERT.mailEingang) return null;
  return (
    <p className="mb-4 bg-weiss px-4 py-3 text-sm text-grau">
      Der Empfang ist noch nicht eingerichtet: Es fehlen RESEND_API_KEY, MAIL_FROM oder RESEND_WEBHOOK_SECRET (siehe README, Abschnitt Resend).
    </p>
  );
}

function Zeile({ g, href, rand }: { g: Gespraech; href: string; rand: boolean }) {
  const neu = g.ungelesen > 0;
  return (
    <Link href={href} className={`grid gap-0.5 py-3 hover:bg-papier active:bg-papier ${rand ? "px-4" : ""}`}>
      <span className="flex items-baseline justify-between gap-3">
        <span className={`flex min-w-0 items-center gap-2 truncate ${neu ? "font-semibold" : ""}`}>
          {neu ? <span aria-label="ungelesen" className="size-2 shrink-0 rounded-full bg-rot" /> : null}
          <span className="truncate">{g.gegenueber}</span>
          {g.anzahl > 1 ? <span className="zahlen shrink-0 text-sm text-grau">{g.anzahl}</span> : null}
        </span>
        <span className="zahlen shrink-0 text-sm text-grau">{wann(g.zuletzt)}</span>
      </span>
      <span className={`truncate ${neu ? "font-semibold" : ""}`}>{g.betreff}</span>
      <span className="truncate text-sm text-grau">
        {g.anhang ? "Mit Anhang · " : ""}
        {g.vorschau}
      </span>
    </Link>
  );
}

export async function PostfachSeite({ ort, suche }: { ort: Ort; suche: { postfach?: string; q?: string } }) {
  const { b, firma, wahl, basis } = await grundlagen(ort, suche.postfach);
  const q = (suche.q ?? "").slice(0, 100);
  const [liste, zahl, adresse] = await Promise.all([
    gespraecheLaden(wahl === "firma" ? null : b.id, q),
    ungelesen(b),
    wahl === "firma" ? firmenAdresse() : eigeneAdresse(b),
  ]);
  const reiter = firma
    ? [
        { href: `${basis}?postfach=firma`, text: "Firma", anzahl: zahl.firma },
        { href: `${basis}?postfach=ich`, text: "Meine", anzahl: zahl.eigene },
      ]
    : null;
  const neu = `${basis}/neu?postfach=${wahl}`;
  const suchfeld = (
    <form className={ort === "admin" ? "mb-4" : "px-4 pb-2 pt-3"}>
      <input type="hidden" name="postfach" value={wahl} />
      <input type="search" name="q" defaultValue={q} placeholder="Suchen in Betreff, Absender, Text" aria-label="Mails durchsuchen" className="feld" />
    </form>
  );
  const leer = q ? "Nichts gefunden." : "Noch keine Mails.";

  if (ort === "admin") {
    return (
      <>
        <Kopf titel="Mail" unter={adresse || undefined}>
          <Link href={neu} className="knopf knopf-dunkel">Neue Mail</Link>
        </Kopf>
        {reiter ? <Reiter aktiv={`${basis}?postfach=${wahl}`} eintraege={reiter} /> : null}
        <EinrichtungHinweis />
        {suchfeld}
        <Abschnitt>
          {liste.length ? (
            <ul className="divide-y divide-linie">
              {liste.map((g) => (
                <li key={g.id}>
                  <Zeile g={g} href={`${basis}/${g.id}`} rand={false} />
                </li>
              ))}
            </ul>
          ) : (
            <Leer>{leer}</Leer>
          )}
        </Abschnitt>
      </>
    );
  }
  return (
    <>
      <MobilKopf
        titel="Mail"
        unter={adresse}
        zurueck={ort === "app" ? "/app/mehr" : undefined}
        aktion={<Link href={neu} className="knopf knopf-dunkel knopf-klein">Neu</Link>}
      />
      {reiter ? <MobilReiter aktiv={`${basis}?postfach=${wahl}`} eintraege={reiter} /> : null}
      <div className="px-4 pt-3 empty:hidden">
        <EinrichtungHinweis />
      </div>
      {suchfeld}
      <ul className="grid grid-cols-1 gap-px bg-linie">
        {liste.map((g) => (
          <li key={g.id} className="bg-weiss">
            <Zeile g={g} href={`${basis}/${g.id}`} rand />
          </li>
        ))}
      </ul>
      {!liste.length ? <p className="px-4 py-10 text-center text-grau">{leer}</p> : null}
    </>
  );
}

function Mail({ m, mobil }: { m: MailZeile; mobil: boolean }) {
  const externeBilder = Boolean(m.html && /<img[^>]+src=["']?https?:/i.test(m.html));
  return (
    <article className="grid gap-3 bg-weiss p-4 md:p-6">
      <header className="grid gap-0.5 text-sm">
        <div className="flex items-baseline justify-between gap-3">
          <p className="min-w-0 truncate text-base">
            <span className="font-semibold">{m.richtung === "ausgang" ? "Gesendet" : m.von_name || m.von}</span>
            {m.richtung === "eingang" && m.von_name ? <span className="text-grau"> &lt;{m.von}&gt;</span> : null}
          </p>
          <span className="zahlen shrink-0 text-grau">{datumZeit(m.erstellt_am)}</span>
        </div>
        <p className="text-grau">
          {m.richtung === "ausgang" ? `Von ${m.von} an ` : "An "}
          {m.an.join(", ")}
          {m.cc.length ? ` · Kopie ${m.cc.join(", ")}` : ""}
        </p>
      </header>
      {m.html ? <HtmlInhalt html={m.html} /> : <div className="whitespace-pre-wrap break-words">{m.text}</div>}
      {externeBilder ? <p className="text-sm text-grau">Bilder von fremden Servern werden zum Schutz vor Zählpixeln nicht geladen.</p> : null}
      {m.anhaenge.length ? (
        <ul className="flex flex-wrap gap-2">
          {m.anhaenge.map((a, i) => {
            const href = `/api/mail/anhang/${m.id}/${i}`;
            const inhalt = (
              <>
                {a.name} <span className="zahlen text-grau">({groesse(a.groesse)})</span>
              </>
            );
            return (
              <li key={a.pfad}>
                {mobil ? (
                  <DateiKnopf art="datei" href={href} className="knopf knopf-rahmen knopf-klein">{inhalt}</DateiKnopf>
                ) : (
                  <a href={href} className="knopf knopf-rahmen knopf-klein">{inhalt}</a>
                )}
              </li>
            );
          })}
        </ul>
      ) : null}
    </article>
  );
}

export async function GespraechSeite({ ort, id }: { ort: Ort; id: string }) {
  const { b, basis } = await grundlagen(ort);
  const mails = await gespraechLaden(b, id);
  // Firmenpostfach in der Team-App: gibt es dort nicht, auch nicht über einen Link aus einer Push-Nachricht
  if (!mails || (ort === "team" && mails[0].postfach === null)) notFound();
  const zurueck = `${basis}?postfach=${mails[0].postfach === null ? "firma" : "ich"}`;
  const letzte = mails.at(-1)!;
  const vorgabe = {
    an: letzte.richtung === "eingang" ? letzte.antwort_an || letzte.von : letzte.an.join(", "),
    cc: letzte.richtung === "ausgang" ? letzte.cc.join(", ") : "",
    betreff: antwortBetreff(letzte.betreff),
    text: zitat(letzte.text, letzte.richtung === "eingang" ? letzte.von_name || letzte.von : "ich", datumZeit(letzte.erstellt_am)),
  };
  const betreff = mails[0].betreff || "(ohne Betreff)";
  const ungelesenDa = mails.some((m) => m.richtung === "eingang" && !m.gelesen_am);
  const mobil = ort !== "admin";
  const knoepfe = (
    <div className="flex flex-wrap gap-2">
      {mails.some((m) => m.richtung === "eingang") ? (
        <Formular aktion={alsUngelesen.bind(null, basis, id)}>
          <Senden art="rahmen" klein>Als ungelesen markieren</Senden>
        </Formular>
      ) : null}
      <Formular aktion={gespraechEntfernen.bind(null, basis, id)} bestaetigen="Dieses Gespräch mit allen Mails und Anhängen endgültig löschen?">
        <Senden art="rahmen" klein>Löschen</Senden>
      </Formular>
    </div>
  );
  const antwort = <Verfassen aktion={mailSenden.bind(null, basis)} vorgabe={vorgabe} antwortAuf={letzte.id} />;

  if (!mobil) {
    return (
      <>
        {ungelesenDa ? <AlsGelesen gespraech={id} /> : null}
        <Kopf titel={betreff} zurueck={{ href: zurueck, text: "Mail" }}>{knoepfe}</Kopf>
        <div className="mb-8 grid gap-4">
          {mails.map((m) => (
            <Mail key={m.id} m={m} mobil={false} />
          ))}
        </div>
        <Abschnitt titel="Antworten">{antwort}</Abschnitt>
      </>
    );
  }
  return (
    <>
      {ungelesenDa ? <AlsGelesen gespraech={id} /> : null}
      <MobilKopf titel={betreff} unter={`${mails.length} ${mails.length === 1 ? "Mail" : "Mails"}`} zurueck={zurueck} />
      <div className="grid gap-px bg-linie">
        {mails.map((m) => (
          <Mail key={m.id} m={m} mobil />
        ))}
      </div>
      <section className="grid gap-3 p-4">
        <h2 className="font-semibold">Antworten</h2>
        {antwort}
        {knoepfe}
      </section>
    </>
  );
}

export async function NeueMailSeite({ ort, suche }: { ort: Ort; suche: { postfach?: string; an?: string; betreff?: string } }) {
  const { b, firma, wahl, basis } = await grundlagen(ort, suche.postfach);
  const [eigene, firmen] = await Promise.all([eigeneAdresse(b), firma ? firmenAdresse() : Promise.resolve("")]);
  const postfaecher: [string, string][] = [...(firma ? [["firma", `Firma (${firmen})`] as [string, string]] : []), ["ich", `Ich (${eigene || "noch ohne Adresse"})`]];
  const formular = (
    <Verfassen
      aktion={mailSenden.bind(null, basis)}
      vorgabe={{ an: suche.an?.slice(0, 300), betreff: suche.betreff?.slice(0, 300) }}
      postfaecher={postfaecher}
      postfach={wahl}
    />
  );
  const zurueck = `${basis}?postfach=${wahl}`;
  if (ort === "admin") {
    return (
      <>
        <Kopf titel="Neue Mail" zurueck={{ href: zurueck, text: "Mail" }} />
        <Abschnitt>{formular}</Abschnitt>
      </>
    );
  }
  return (
    <>
      <MobilKopf titel="Neue Mail" unter={wahl === "firma" ? firmen : eigene} zurueck={zurueck} />
      <div className="p-4">{formular}</div>
    </>
  );
}
