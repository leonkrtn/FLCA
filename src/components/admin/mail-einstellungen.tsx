import { Ausblenden, Formular, Senden } from "@/components/admin/formular";
import { Abschnitt, Feld, Marke, Schalter, Textfeld } from "@/components/admin/ui";
import { Editor } from "@/components/mail/editor";
import {
  kategorieLoeschen,
  kategorieSpeichern,
  mailAdressenSpeichern,
  mailPersonenSpeichern,
  mailSignaturSpeichern,
  mailTesten,
  mailZugriffSpeichern,
  vorlageLoeschen,
  vorlageSpeichern,
} from "@/lib/aktionen/mail-einstellungen";
import type { Benutzer } from "@/lib/auth";
import { einstellungen } from "@/lib/einstellungen";
import { mailNameAus, mailNameVon } from "@/lib/mail/adressen";
import { einrichtungPruefen } from "@/lib/mail/einrichtung";
import { htmlBereinigen, KATEGORIE_FARBEN } from "@/lib/mail/inhalt";
import { mailDomain, personenAdresse, standardAbsender } from "@/lib/mail/postfach";
import { signaturFuer } from "@/lib/mail/signatur";
import { darf, rollenName, type Rolle } from "@/lib/rollen";
import { db } from "@/lib/supabase/admin";

type Person = { id: string; name: string; email: string; rolle: Rolle | null; aktiv: boolean; mail_name: string | null; jobbezeichnung: string; signatur_telefon: string };

/** Einstellungen → E-Mail: Einrichtung, Absender und Adressen, Zugriff und Push, Signatur, Personen, Kategorien, Textbausteine. */
export async function MailEinstellungen({ b }: { b: Benutzer }) {
  const [{ mail }, pruefung, std, { data: p }, { data: k }] = await Promise.all([
    einstellungen(),
    einrichtungPruefen(),
    standardAbsender(),
    db().from("profile").select("id, name, email, rolle, aktiv, mail_name, jobbezeichnung, signatur_telefon").order("name"),
    db().from("mail_kategorien").select("id, name, farbe").order("sortierung"),
  ]);
  const leute = ((p ?? []) as Person[]).filter((x) => x.rolle);
  const aktive = leute.filter((x) => x.aktiv);
  const domain = mailDomain();
  const signatur = htmlBereinigen(await signaturFuer(b.id, std.adresse));
  const hatZugriff = (x: Person) => x.rolle === "inhaber" || (mail.zugriff === null ? darf(x.rolle, "firmenmail") : mail.zugriff.includes(x.id));
  const hatPush = (x: Person) => (mail.push === null ? hatZugriff(x) : mail.push.includes(x.id));

  return (
    <>
      <Abschnitt titel="Einrichtung" id="einrichtung" aktion={<Formular aktion={mailTesten}><Senden art="rahmen" klein>Testmail senden</Senden></Formular>}>
        <ul className="grid gap-2">
          {pruefung.map((x) => (
            <li key={x.name} className="grid gap-x-4 sm:grid-cols-[10rem_minmax(0,1fr)]">
              <span className="flex items-center gap-2 font-semibold">
                <Marke ton={x.ok === true ? "ok" : x.ok === false ? "rot" : "hell"}>{x.ok === true ? "OK" : x.ok === false ? "Fehlt" : "Hinweis"}</Marke>
                {x.name}
              </span>
              <span className="break-words text-grau">{x.text}</span>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-sm text-grau">Resend-Webhook mit den Ereignissen email.received, email.sent, email.delivered, email.delivery_delayed, email.bounced und email.complained. Anleitung in der README unter „Resend“.</p>
      </Abschnitt>

      <Abschnitt titel="Absender und Adressen" id="adressen">
        <Formular aktion={mailAdressenSpeichern} className="grid gap-4 sm:grid-cols-2">
          <Feld label="Name im Absender" name="absenderName" wert={mail.absenderName} placeholder={std.name} hilfe="Leer = Firmenname" />
          <div>
            <label className="block">
              <span className="label">Standardadresse</span>
              <span className="flex items-center gap-2">
                <input name="standardAdresse" defaultValue={mail.standardAdresse} className="feld" autoCapitalize="none" />
                <span className="shrink-0 text-grau">@{domain}</span>
              </span>
            </label>
            <p className="mt-1 text-sm text-grau">Von hier gehen Terminmails, Rechnungen und neue Mails aus dem Firmenpostfach raus. Jetzt: {std.adresse}</p>
          </div>
          <Textfeld
            label="Adressen des Firmenpostfachs"
            name="firmenAdressen"
            wert={mail.firmenAdressen.join("\n")}
            zeilen={4}
            hilfe={`Eine pro Zeile, nur der Teil vor dem @ (z. B. service, info, termine). Diese Mails kommen im Posteingang an. Alle anderen Adressen an @${domain}, die keiner Person gehören, landen unter „Sonstige“.`}
            className="sm:col-span-2"
          />
          <div className="sm:col-span-2"><Senden vorab="Gespeichert">Speichern</Senden></div>
        </Formular>
      </Abschnitt>

      <Abschnitt titel="Zugriff und Push" id="zugriff" aktion={<span className="text-sm text-grau">Firmenpostfach mit Posteingang und „Sonstige“</span>}>
        <Formular aktion={mailZugriffSpeichern} className="grid gap-4">
          <div className="quer-scrollen">
            <table className="w-full text-left text-sm">
              <thead className="text-grau">
                <tr>
                  <th className="py-2 pr-4 font-semibold">Person</th>
                  <th className="py-2 pr-4 font-semibold">Sieht Firmenpostfach</th>
                  <th className="py-2 font-semibold">Push bei neuer Mail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-linie">
                {aktive.map((x) => (
                  <tr key={x.id}>
                    <td className="py-2 pr-4">
                      <span className="font-semibold">{x.name || x.email}</span> <span className="text-grau">{rollenName(x.rolle)}</span>
                    </td>
                    <td className="py-2 pr-4">
                      <input type="checkbox" name={`zugriff_${x.id}`} defaultChecked={hatZugriff(x)} disabled={x.rolle === "inhaber"} className="size-5 accent-tinte" aria-label={`${x.name} sieht das Firmenpostfach`} />
                      {x.rolle === "inhaber" ? <span className="ml-2 text-grau">immer</span> : null}
                    </td>
                    <td className="py-2">
                      <input type="checkbox" name={`push_${x.id}`} defaultChecked={hatPush(x)} className="size-5 accent-tinte" aria-label={`Push für ${x.name}`} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-sm text-grau">Eigene Mails kommen immer per Push, außer jemand schaltet es in seiner App unter „Mehr“ aus. Wem eine Mail zugewiesen wird, sieht diese Unterhaltung auch ohne Zugriff aufs Firmenpostfach.</p>
          <div><Senden vorab="Gespeichert">Speichern</Senden></div>
        </Formular>
      </Abschnitt>

      <Abschnitt titel="Signatur" id="signatur" aktion={<span className="text-sm text-grau">Gilt für alle, Angaben je Person unten</span>}>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <Formular aktion={mailSignaturSpeichern} className="grid content-start gap-4">
            <Feld label="Grußformel" name="gruss" wert={mail.signatur.gruss} />
            <Schalter label="Logo" name="logo" an={mail.signatur.logo} hilfe="Bild von der Website, nur wenn sie über https läuft" />
            <Schalter label="Öffnungszeiten" name="oeffnungszeiten" an={mail.signatur.oeffnungszeiten} />
            <Schalter label="Website" name="website" an={mail.signatur.website} />
            <Schalter label="Pflichtangaben" name="pflichtangaben" an={mail.signatur.pflichtangaben} hilfe="Rechtsform, Inhaber, Steuernummer bzw. USt-IdNr. klein darunter" />
            <div><Senden vorab="Gespeichert">Speichern</Senden></div>
          </Formular>
          <div>
            <span className="label">Vorschau (für Sie)</span>
            {/* Eigenes HTML, vorher bereinigt */}
            <div className="rounded-sm border border-linie bg-white p-4" dangerouslySetInnerHTML={{ __html: signatur }} />
          </div>
        </div>
      </Abschnitt>

      <Abschnitt titel="Personen" id="personen" aktion={<span className="text-sm text-grau">Adresse, Jobbezeichnung und Telefon für die Signatur</span>}>
        <Formular aktion={mailPersonenSpeichern} className="grid gap-4">
          <div className="quer-scrollen">
            <table className="w-full min-w-[44rem] text-left text-sm">
              <thead className="text-grau">
                <tr>
                  <th className="py-2 pr-3 font-semibold">Person</th>
                  <th className="py-2 pr-3 font-semibold">Adresse</th>
                  <th className="py-2 pr-3 font-semibold">Jobbezeichnung</th>
                  <th className="py-2 font-semibold">Telefon in der Signatur</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-linie align-top">
                {leute.map((x) => (
                  <tr key={x.id} className={x.aktiv ? "" : "opacity-60"}>
                    <td className="py-2 pr-3">
                      <span className="font-semibold">{x.name || x.email}</span>
                      <span className="block text-grau">{rollenName(x.rolle)}{x.aktiv ? "" : ", deaktiviert"}</span>
                    </td>
                    <td className="py-2 pr-3">
                      <span className="flex items-center gap-1">
                        <input name={`mail_name_${x.id}`} defaultValue={x.mail_name ?? ""} placeholder={mailNameAus(x.name) || "vorname.nachname"} className="feld min-w-32" autoCapitalize="none" aria-label={`Adresse von ${x.name}`} />
                        <span className="shrink-0 text-grau">@{domain}</span>
                      </span>
                      <span className="mt-1 block text-grau">{mailNameVon(x) ? personenAdresse(x) : "ohne Namen keine Adresse"}</span>
                    </td>
                    <td className="py-2 pr-3">
                      <input name={`job_${x.id}`} defaultValue={x.jobbezeichnung} placeholder="z. B. Kfz-Mechatroniker" className="feld" aria-label={`Jobbezeichnung von ${x.name}`} />
                    </td>
                    <td className="py-2">
                      <input name={`tel_${x.id}`} defaultValue={x.signatur_telefon} placeholder="leer = Firmentelefon" className="feld" inputMode="tel" aria-label={`Telefon von ${x.name}`} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-sm text-grau">Adresse leer lassen für vorname.nachname aus dem Namen.</p>
          <div><Senden vorab="Gespeichert">Speichern</Senden></div>
        </Formular>
      </Abschnitt>

      <Abschnitt titel="Kategorien" id="kategorien" aktion={<span className="text-sm text-grau">Zum Ordnen im Postfach, mit Farbe</span>}>
        <ul className="grid gap-2">
          {(k ?? []).map((x) => (
            <Ausblenden key={x.id as string}>
              <li className="flex flex-wrap items-end gap-2">
                <Formular aktion={kategorieSpeichern.bind(null, x.id as string)} className="flex flex-wrap items-end gap-2">
                  <span className="mb-3 size-4 shrink-0 rounded-full" style={{ background: KATEGORIE_FARBEN[x.farbe as string]?.hex ?? "#8a8a8a" }} />
                  <Feld label="Name" name="name" wert={x.name as string} />
                  <FarbWahl wert={x.farbe as string} />
                  <Senden art="rahmen" vorab="Gespeichert">Speichern</Senden>
                </Formular>
                <Formular aktion={kategorieLoeschen.bind(null, x.id as string)} ausblenden bestaetigen={`Kategorie „${x.name}“ löschen? Mails behalten ihren Inhalt.`}>
                  <Senden art="rahmen">Löschen</Senden>
                </Formular>
              </li>
            </Ausblenden>
          ))}
        </ul>
        <Formular aktion={kategorieSpeichern.bind(null, null)} zuruecksetzen className="mt-4 flex flex-wrap items-end gap-2 border-t border-linie pt-4">
          <Feld label="Neue Kategorie" name="name" placeholder="z. B. Teilebestellung" />
          <FarbWahl wert="blau" />
          <Senden vorab="Angelegt">Anlegen</Senden>
        </Formular>
      </Abschnitt>

      <Abschnitt titel="Textbausteine" id="vorlagen" aktion={<span className="text-sm text-grau">Im Schreibfenster über „Textbaustein“ einfügen</span>}>
        <div className="grid gap-6">
          {mail.vorlagen.map((v) => (
            <Ausblenden key={v.id}>
              <div className="grid gap-2 border-b border-linie pb-6">
                <Formular aktion={vorlageSpeichern.bind(null, v.id)} className="grid gap-3">
                  <Feld label="Name" name="name" wert={v.name} />
                  <Editor name="html" wert={v.html} minHoehe="6rem" beschriftung={`Textbaustein ${v.name}`} />
                  <div><Senden art="rahmen" vorab="Gespeichert">Speichern</Senden></div>
                </Formular>
                <Formular aktion={vorlageLoeschen.bind(null, v.id)} ausblenden bestaetigen={`Textbaustein „${v.name}“ löschen?`}>
                  <Senden art="rahmen" klein>Löschen</Senden>
                </Formular>
              </div>
            </Ausblenden>
          ))}
          <Formular aktion={vorlageSpeichern.bind(null, null)} className="grid gap-3">
            <Feld label="Neuer Textbaustein" name="name" placeholder="z. B. Auto ist fertig" />
            <Editor name="html" minHoehe="6rem" beschriftung="Neuer Textbaustein" />
            <div><Senden vorab="Angelegt">Anlegen</Senden></div>
          </Formular>
        </div>
      </Abschnitt>
    </>
  );
}

function FarbWahl({ wert }: { wert: string }) {
  return (
    <label className="block">
      <span className="label">Farbe</span>
      <select name="farbe" defaultValue={wert} className="feld">
        {Object.entries(KATEGORIE_FARBEN).map(([k, f]) => (
          <option key={k} value={k}>{f.name}</option>
        ))}
      </select>
    </label>
  );
}
