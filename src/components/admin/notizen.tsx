import Link from "next/link";
import { Formular, Senden } from "@/components/admin/formular";
import { Abschnitt, Auswahl, Feld, Marke, Textfeld } from "@/components/admin/ui";
import { notizErledigt, notizSpaeter } from "@/lib/aktionen/notizen";
import type { Ergebnis } from "@/lib/forms";
import { datumZeit } from "@/lib/format";
import type { Benutzer } from "@/lib/auth";
import { faellig, type Notiz, notizenLaden, WIEDERHOLUNG_TEXT } from "@/lib/notizen";
import { berlinDatum, berlinUhrzeit, jetztMs } from "@/lib/zeit";

export type NotizBezug = { kunde?: { id: string; name: string } | null; termin?: { id: string; text: string } | null };

/**
 * Formular für eine Notiz. Kunde oder Termin kommen von der Seite, auf der man „Notiz anlegen“ getippt hat,
 * und lassen sich hier nur lösen, nicht neu wählen. Erinnerung: leeres Datum = keine Erinnerung.
 */
export function NotizFormular({
  aktion,
  notiz,
  team,
  bezug,
  kompakt = false,
}: {
  aktion: (v: Ergebnis, fd: FormData) => Promise<Ergebnis>;
  notiz: Notiz | null;
  team: { id: string; name: string }[];
  bezug: NotizBezug;
  kompakt?: boolean;
}) {
  const am = notiz?.erinnern_am ? new Date(notiz.erinnern_am) : null;
  return (
    <Formular aktion={aktion} className={`grid gap-4 ${kompakt ? "" : "sm:grid-cols-2"}`}>
      <Feld label="Titel" name="titel" wert={notiz?.titel} placeholder="z. B. Reifen für Herrn Müller bestellen" className={kompakt ? "" : "sm:col-span-2"} maxLength={200} />
      <Textfeld label="Notiz" name="text" wert={notiz?.text} zeilen={5} className={kompakt ? "" : "sm:col-span-2"} />
      <Auswahl
        label="Wer sieht die Notiz?"
        name="sichtbar"
        wert={notiz?.sichtbar ?? "privat"}
        optionen={[
          ["privat", "Nur ich"],
          ["buero", "Büro (Inhaber und Büro)"],
        ]}
      />
      {bezug.kunde || bezug.termin ? (
        <div className={kompakt ? "" : "sm:col-span-2"}>
          <span className="label">Gehört zu</span>
          <div className="grid gap-1">
            {bezug.kunde ? <p>Kunde {bezug.kunde.name}</p> : null}
            {bezug.termin ? <p>Termin {bezug.termin.text}</p> : null}
            <label className="flex items-center gap-2 text-sm text-grau">
              <input type="checkbox" name="loesen" className="size-4 shrink-0 accent-tinte" /> Verknüpfung lösen
            </label>
          </div>
          {bezug.kunde ? <input type="hidden" name="kunde_id" value={bezug.kunde.id} /> : null}
          {bezug.termin ? <input type="hidden" name="termin_id" value={bezug.termin.id} /> : null}
        </div>
      ) : null}
      <fieldset className={`grid gap-3 border-t border-linie pt-4 ${kompakt ? "grid-cols-2" : "sm:col-span-2 sm:grid-cols-4"}`}>
        <legend className="mb-2 font-semibold">Erinnerung per Push</legend>
        <Feld label="Datum" name="datum" typ="date" wert={am ? berlinDatum(am) : ""} />
        <Feld label="Uhrzeit" name="uhrzeit" typ="time" wert={am ? berlinUhrzeit(am) : ""} step={300} />
        <Auswahl
          label="Wiederholen"
          name="wiederholung"
          wert={notiz?.wiederholung ?? "keine"}
          optionen={[
            ["keine", "Nicht wiederholen"],
            ["taeglich", "Täglich"],
            ["woechentlich", "Wöchentlich"],
            ["monatlich", "Monatlich"],
          ]}
        />
        <Auswahl label="Erinnern an" name="erinnern_an" wert={notiz?.erinnern_an ?? ""} leer="Mich selbst" optionen={team.map((p) => [p.id, p.name || "ohne Namen"])} />
        <p className={`text-sm text-grau ${kompakt ? "col-span-2" : "sm:col-span-4"}`}>
          Ohne Datum keine Erinnerung. Ohne Uhrzeit um 8 Uhr. Der Push kommt bis zu 10 Minuten nach der Uhrzeit.
        </p>
      </fieldset>
      <div className={kompakt ? "" : "sm:col-span-2"}>
        <Senden vorab="Gespeichert" className={kompakt ? "w-full" : ""}>
          {notiz ? "Speichern" : "Notiz anlegen"}
        </Senden>
      </div>
    </Formular>
  );
}

/** Kurzinfo zur Erinnerung: „fällig“, „21.11.2026, 09:00 · wöchentlich“ oder nichts. */
export function ErinnerungsMarke({ n, jetzt }: { n: Notiz; jetzt: number }) {
  if (n.erledigt_am) return <Marke ton="ok">erledigt</Marke>;
  if (!n.erinnern_am) return null;
  if (faellig(n, jetzt)) return <Marke ton="rot">fällig</Marke>;
  return (
    <Marke ton="hell">
      {datumZeit(n.erinnern_am)}
      {n.wiederholung !== "keine" ? ` · ${WIEDERHOLUNG_TEXT[n.wiederholung]}` : ""}
    </Marke>
  );
}

/** Eine Zeile in Notizlisten (Verwaltung, App, Kunde, Termin). */
export function NotizZeile({ n, href, jetzt }: { n: Notiz; href: string; jetzt: number }) {
  return (
    <Link href={href} className="flex items-start justify-between gap-3 py-3 hover:bg-papier active:bg-papier">
      <span className="min-w-0">
        <span className="block truncate font-semibold">{n.titel || n.text.split("\n")[0] || "Notiz"}</span>
        {n.titel && n.text ? <span className="line-clamp-2 block text-sm text-grau">{n.text}</span> : null}
        <span className="block text-xs text-grau">
          {[n.sichtbar === "buero" ? "Büro" : "nur ich", n.kunde?.name, n.termin ? `Termin Nr. ${n.termin.nummer}` : null, n.empfaenger?.name ? `an ${n.empfaenger.name}` : null]
            .filter(Boolean)
            .join(" · ")}
        </span>
      </span>
      <span className="shrink-0">
        <ErinnerungsMarke n={n} jetzt={jetzt} />
      </span>
    </Link>
  );
}

/** Erledigt / wieder öffnen und „später erinnern“ (nur bei einmaligen Erinnerungen). */
export function NotizKnoepfe({ n, gross = false }: { n: Notiz; gross?: boolean }) {
  const klein = !gross;
  return (
    <div className={`flex flex-wrap gap-2 ${gross ? "[&>form]:flex-1" : ""}`}>
      <Formular aktion={notizErledigt.bind(null, n.id, !n.erledigt_am)}>
        <Senden art={n.erledigt_am ? "rahmen" : "dunkel"} klein={klein} className={gross ? "w-full" : ""} vorab={n.erledigt_am ? "Wieder offen" : "Erledigt"}>
          {n.erledigt_am ? "Wieder öffnen" : "Erledigt"}
        </Senden>
      </Formular>
      {!n.erledigt_am && n.erinnern_am && n.wiederholung === "keine" ? (
        <>
          <Formular aktion={notizSpaeter.bind(null, n.id, "stunde")}>
            <Senden art="rahmen" klein={klein} className={gross ? "w-full" : ""}>In 1 Std.</Senden>
          </Formular>
          <Formular aktion={notizSpaeter.bind(null, n.id, "morgen")}>
            <Senden art="rahmen" klein={klein} className={gross ? "w-full" : ""}>Morgen 8 Uhr</Senden>
          </Formular>
        </>
      ) : null}
    </div>
  );
}

/** Offene Notizen zu einem Kunden oder Termin, mit „Notiz anlegen“ (Kunden- und Terminseite der Verwaltung). */
export async function NotizenAbschnitt({ b, kundeId, terminId }: { b: Benutzer; kundeId?: string; terminId?: string }) {
  const liste = await notizenLaden(b, { kundeId, terminId, limit: 20 });
  const neu = `/admin/notizen/neu?${kundeId ? `kunde=${kundeId}` : `termin=${terminId}`}`;
  const jetzt = jetztMs();
  return (
    <Abschnitt titel="Notizen" aktion={<Link href={neu} className="text-sm underline">Notiz anlegen</Link>}>
      {liste.length ? (
        <ul className="divide-y divide-linie">
          {liste.map((n) => (
            <li key={n.id}>
              <NotizZeile n={n} href={`/admin/notizen/${n.id}`} jetzt={jetzt} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-grau">Keine offenen Notizen.</p>
      )}
    </Abschnitt>
  );
}
