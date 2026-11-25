import Link from "next/link";
import { MobilKopf } from "@/components/mobil/teile";
import { benutzerMitRecht } from "@/lib/auth";
import { KONFIGURIERT } from "@/lib/env";
import { listeLaden, ordnerZahlen, personenAdresse, standardAbsender, ungelesen, zugang } from "@/lib/mail/postfach";
import { db } from "@/lib/supabase/admin";
import { ansichtHref, ansichtLesen, type MailAnsicht, ORDNER_TEXT } from "./ansicht";
import { Lesebereich } from "./lesen";
import { type Kategorie, MailListe, type PersonKurz } from "./liste";
import { NeuOeffnen } from "./neu-oeffnen";
import { OrdnerLeiste } from "./ordner";
import { OrdnerMenue } from "./ordner-menue";
import { SchreibenKnopf } from "./schreiben";

/**
 * Seiten des Postfachs für Verwaltung (`admin`, drei Spalten wie Outlook), Werkstatt-App (`app`) und Team-App
 * (`team`, Liste und Lesen als eigene Seiten). Die Seiten-Dateien reichen nur Ort und Adresse durch.
 */
export type Ort = "admin" | "app" | "team";
export const BASIS = { admin: "/admin/mail", app: "/app/mail", team: "/team/mail" } as const;
type Such = Record<string, string | string[] | undefined>;

async function grundlagen(ort: Ort, sp: Such) {
  const b = await benutzerMitRecht("werkstatt");
  const z = await zugang(b);
  const ansicht = ansichtLesen(sp, z.firma);
  const [{ data: k }, { data: p }, std] = await Promise.all([
    db().from("mail_kategorien").select("id, name, farbe").order("sortierung"),
    db().from("profile").select("id, name, mail_name").eq("aktiv", true).not("rolle", "is", null).order("name"),
    standardAbsender(),
  ]);
  const ich = (p ?? []).find((x) => x.id === b.id) as { name: string; mail_name: string | null } | undefined;
  return {
    b,
    z,
    ansicht,
    basis: BASIS[ort],
    kategorien: (k ?? []) as Kategorie[],
    personen: (p ?? []).map((x) => ({ id: x.id as string, name: (x.name as string) || "Ohne Namen" })) as PersonKurz[],
    eigeneAdresse: ich ? personenAdresse(ich) : "",
    firmenAdresse: std.adresse,
  };
}

function Hinweis() {
  if (KONFIGURIERT.mailEingang) return null;
  return <p className="bg-kreide px-4 py-2 text-sm">Der Empfang ist noch nicht eingerichtet (Einstellungen → E-Mail → Einrichtung).</p>;
}

/** Suche und Umschalter Unterhaltung/Einzeln über der Liste. */
function ListenKopf({ ansicht, basis, mobil }: { ansicht: MailAnsicht; basis: string; mobil: boolean }) {
  return (
    <div className={`flex items-center gap-2 border-b border-linie bg-weiss ${mobil ? "px-4 py-2" : "px-3 py-2"}`}>
      <form className="min-w-0 flex-1" action={basis}>
        {ansicht.p !== "firma" ? <input type="hidden" name="p" value={ansicht.p} /> : null}
        {ansicht.o !== "eingang" ? <input type="hidden" name="o" value={ansicht.o} /> : null}
        {ansicht.k ? <input type="hidden" name="k" value={ansicht.k} /> : null}
        {ansicht.e ? <input type="hidden" name="e" value="1" /> : null}
        <input type="search" name="q" defaultValue={ansicht.q} placeholder="Suchen" aria-label="Mails durchsuchen" className="feld min-h-9 py-1" />
      </form>
      <Link
        href={ansichtHref(basis, ansicht, { e: !ansicht.e, g: "" })}
        className="shrink-0 rounded-sm px-2 py-1 text-xs font-semibold text-grau hover:bg-boden hover:text-tinte"
        title={ansicht.e ? "Als Unterhaltungen anzeigen" : "Einzelne Mails anzeigen"}
      >
        {ansicht.e ? "Einzeln" : "Unterhaltungen"}
      </Link>
    </div>
  );
}

export async function PostfachSeite({ ort, sp, neu }: { ort: Ort; sp: Such; neu?: boolean }) {
  const g = await grundlagen(ort, sp);
  const { z, ansicht, basis } = g;
  const [liste, zahlenFirma, zahlenIch, post] = await Promise.all([
    listeLaden(z, { postfach: ansicht.p, ansicht: ansicht.o, kategorie: ansicht.k, suche: ansicht.q, einzeln: ansicht.e }),
    z.firma ? ordnerZahlen(z, "firma") : Promise.resolve({}),
    ordnerZahlen(z, "ich"),
    ungelesen(z),
  ]);
  const titel = `${ORDNER_TEXT[ansicht.o]}${ansicht.o !== "zugewiesen" && z.firma ? (ansicht.p === "firma" ? " · Firma" : " · Meine") : ""}`;
  const neuKnopf = (klasse: string) => (
    <SchreibenKnopf art="neu" wunsch={{ postfach: ansicht.p }} className={klasse}>
      Neue Mail
    </SchreibenKnopf>
  );
  const auto = neu ? <NeuOeffnen wunsch={{ postfach: ansicht.p, an: typeof sp.an === "string" ? sp.an : undefined, betreff: typeof sp.betreff === "string" ? sp.betreff : undefined }} /> : null;
  const listeEl = <MailListe eintraege={liste} ansicht={ansicht} basis={basis} kategorien={g.kategorien} personen={g.personen} firma={z.firma} mobil={ort !== "admin"} />;

  if (ort !== "admin") {
    return (
      <>
        {auto}
        <MobilKopf titel="Mail" unter={titel} zurueck={ort === "app" ? "/app/mehr" : undefined} aktion={neuKnopf("knopf knopf-dunkel knopf-klein")} />
        <Hinweis />
        <div className="grid gap-2 bg-boden px-4 py-2">
          <OrdnerMenue ansicht={ansicht} basis={basis} firma={z.firma} zahlenFirma={zahlenFirma} zahlenIch={zahlenIch} kategorien={g.kategorien} />
        </div>
        <ListenKopf ansicht={ansicht} basis={basis} mobil />
        {listeEl}
        <p className="px-4 py-4 text-center text-xs text-grau">Nach links wischen: {ansicht.o === "archiv" || ansicht.o === "papierkorb" ? "löschen" : "archivieren"}. Nach rechts: gelesen/ungelesen.</p>
      </>
    );
  }

  // Am Rechner: drei Spalten. Schmaler (Tablet, Handy im Browser): Liste, und mit geöffneter Mail nur die Mail.
  return (
    <div className="vollbreite -mx-4 -my-6 md:-mx-8 lg:-mx-10 lg:-my-10">
      {auto}
      <Hinweis />
      <div className="grid lg:h-dvh lg:grid-cols-[13.5rem_minmax(19rem,24rem)_minmax(0,1fr)]">
        <aside className="hidden min-h-0 overflow-y-auto border-r border-linie bg-boden px-2 pt-4 lg:block">
          <div className="px-1">{neuKnopf("knopf knopf-dunkel w-full")}</div>
          <OrdnerLeiste
            ansicht={ansicht}
            basis={basis}
            firma={z.firma}
            zahlenFirma={zahlenFirma}
            zahlenIch={zahlenIch}
            zugewiesen={post.zugewiesen}
            kategorien={g.kategorien}
            eigeneAdresse={g.eigeneAdresse}
            firmenAdresse={g.firmenAdresse}
          />
        </aside>
        <section className={`${ansicht.g ? "hidden lg:flex" : "flex"} min-h-0 flex-col border-r border-linie bg-weiss`}>
          <div className="flex items-center justify-between gap-2 px-3 pb-1 pt-4 lg:pt-4">
            <h1 className="schmal truncate text-2xl leading-none">{titel}</h1>
            <span className="lg:hidden">{neuKnopf("knopf knopf-dunkel knopf-klein")}</span>
          </div>
          <div className="px-3 pb-2 lg:hidden">
            <OrdnerMenue ansicht={ansicht} basis={basis} firma={z.firma} zahlenFirma={zahlenFirma} zahlenIch={zahlenIch} kategorien={g.kategorien} />
          </div>
          <ListenKopf ansicht={ansicht} basis={basis} mobil={false} />
          {listeEl}
        </section>
        <section className={`${ansicht.g ? "block" : "hidden lg:block"} min-h-0 overflow-y-auto bg-papier`}>
          {ansicht.g ? (
            <>
              <Link href={ansichtHref(basis, ansicht, { g: "" })} className="block px-4 pt-3 text-sm text-grau lg:hidden">← {titel}</Link>
              <Lesebereich z={z} ansicht={ansicht} basis={basis} ort="admin" kategorien={g.kategorien} personen={g.personen} />
            </>
          ) : (
            <div className="grid h-full place-items-center p-10 text-center text-grau">
              <div>
                <p className="schmal text-3xl text-tinte">Keine Mail ausgewählt</p>
                <p className="mt-2">Links eine Mail anklicken. Mit den Häkchen mehrere auf einmal bearbeiten.</p>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

/** Handy-Apps: eine Unterhaltung (oder mit `?e=1` eine Mail) als eigene Seite. */
export async function MailLesenSeite({ ort, id, sp }: { ort: Exclude<Ort, "admin">; id: string; sp: Such }) {
  const g = await grundlagen(ort, { ...sp, g: id });
  const { z, ansicht, basis } = g;
  const { data: kopf } = await db().from("mails").select("betreff").eq(ansicht.e ? "id" : "gespraech", ansicht.g || "00000000-0000-0000-0000-000000000000").order("erstellt_am", { ascending: false }).limit(1);
  return (
    <>
      <MobilKopf titel={(kopf?.[0]?.betreff as string) || "(ohne Betreff)"} unter={ORDNER_TEXT[ansicht.o]} zurueck={ansichtHref(basis, { ...ansicht, g: "" })} />
      <Lesebereich z={z} ansicht={ansicht} basis={basis} ort={ort} kategorien={g.kategorien} personen={g.personen} />
    </>
  );
}
