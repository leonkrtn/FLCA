import { notFound } from "next/navigation";
import { Formular, Senden } from "@/components/admin/formular";
import { Abschnitt, Auswahl, Feld, Kopf, Reiter, Schalter, Tabelle } from "@/components/admin/ui";
import { abwesenheitMelden, arbeitszeitenSpeichern, profilSpeichern, zeitLoeschen, zeitNachtragen } from "@/lib/aktionen/team";
import { benutzerMitRecht } from "@/lib/auth";
import { WOCHENTAGE } from "@/lib/einstellungen";
import { datum, datumKurzText, zeit } from "@/lib/format";
import { ROLLEN } from "@/lib/rollen";
import { db } from "@/lib/supabase/admin";
import { berlinDatum, jetztMs } from "@/lib/zeit";
import { monatszeiten, stunden } from "@/lib/zeiterfassung";

export default async function Person({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ monat?: string }> }) {
  await benutzerMitRecht("team");
  const { id } = await params;
  const { monat: m } = await searchParams;
  const monat = m && /^\d{4}-\d{2}$/.test(m) ? m : berlinDatum().slice(0, 7);
  const { data: p } = await db().from("profile").select("*").eq("id", id).maybeSingle();
  if (!p) notFound();
  const [{ data: zeiten }, { data: abw }, mz] = await Promise.all([
    db().from("arbeitszeiten").select("*").eq("profil_id", id).order("wochentag").order("beginn"),
    db().from("abwesenheiten").select("*").eq("profil_id", id).order("von", { ascending: false }).limit(30),
    monatszeiten(id, monat),
  ]);
  const fenster = (t: number, n: number) => (zeiten ?? []).filter((z) => z.wochentag === t)[n - 1];
  const urlaubGenommen = (abw ?? [])
    .filter((a) => a.art === "urlaub" && a.status === "genehmigt" && a.von.startsWith(monat.slice(0, 4)))
    .reduce((s, a) => s + Math.round((new Date(a.bis).getTime() - new Date(a.von).getTime()) / 86400000) + 1, 0);
  const vor = new Date(Date.UTC(Number(monat.slice(0, 4)), Number(monat.slice(5)) - 2, 1)).toISOString().slice(0, 7);
  const nach = new Date(Date.UTC(Number(monat.slice(0, 4)), Number(monat.slice(5)), 1)).toISOString().slice(0, 7);

  return (
    <>
      <Kopf titel={p.name || p.email} unter={p.email} zurueck={{ href: "/admin/team", text: "Team" }} />
      <div className="grid gap-x-8 lg:grid-cols-2">
        <Abschnitt titel="Person">
          <Formular aktion={profilSpeichern.bind(null, id)} className="grid gap-4 sm:grid-cols-2">
            <Feld label="Name" name="name" wert={p.name} />
            <Feld label="Telefon" name="telefon" wert={p.telefon} typ="tel" />
            <Auswahl label="Rolle" name="rolle" wert={p.rolle} optionen={ROLLEN.map((r) => [r.wert, r.name])} />
            <Feld label="Urlaubstage pro Jahr" name="urlaubstage" wert={p.urlaubstage} inputMode="numeric" hilfe={`${urlaubGenommen} Tage in ${monat.slice(0, 4)} genehmigt`} />
            <Schalter label="Zeiterfassung" name="zeiterfassung" an={p.zeiterfassung} hilfe="Ein- und Ausstempeln in der Team-App" />
            <Schalter label="Konto aktiv" name="aktiv" an={p.aktiv} hilfe="Aus = kein Login mehr möglich" />
            <div className="sm:col-span-2"><Senden>Speichern</Senden></div>
          </Formular>
        </Abschnitt>
        <Abschnitt titel="Arbeitszeiten">
          <Formular aktion={arbeitszeitenSpeichern.bind(null, id)} className="grid gap-2">
            {WOCHENTAGE.map((tag, i) => (
              <div key={tag} className="grid grid-cols-[6.5rem_1fr_1fr] items-center gap-2">
                <span className="text-sm font-semibold">{tag}</span>
                {[1, 2].map((n) => (
                  <div key={n} className="flex items-center gap-1">
                    <input type="time" name={`t${i + 1}_${n}_von`} defaultValue={fenster(i + 1, n)?.beginn?.slice(0, 5)} step={900} className="feld min-h-10 px-2" aria-label={`${tag} Fenster ${n} von`} />
                    <span className="text-grau">–</span>
                    <input type="time" name={`t${i + 1}_${n}_bis`} defaultValue={fenster(i + 1, n)?.ende?.slice(0, 5)} step={900} className="feld min-h-10 px-2" aria-label={`${tag} Fenster ${n} bis`} />
                  </div>
                ))}
              </div>
            ))}
            <p className="text-sm text-grau">Zweites Fenster für geteilte Schichten (z. B. Mittagspause). Leer lassen = frei.</p>
            <div><Senden>Arbeitszeiten speichern</Senden></div>
          </Formular>
        </Abschnitt>
      </div>

      <Abschnitt titel="Abwesenheiten">
        <Formular aktion={abwesenheitMelden.bind(null, id)} zuruecksetzen className="mb-6 grid items-end gap-3 sm:grid-cols-[10rem_10rem_10rem_minmax(0,1fr)_auto]">
          <Auswahl label="Art" name="art" optionen={[["urlaub", "Urlaub"], ["krank", "Krank"], ["sonstiges", "Sonstiges"]]} />
          <Feld label="Von" name="von" typ="date" required />
          <Feld label="Bis" name="bis" typ="date" />
          <Feld label="Notiz" name="notiz" />
          <Senden klein>Eintragen</Senden>
        </Formular>
        <ul className="divide-y divide-linie text-sm">
          {(abw ?? []).map((a) => (
            <li key={a.id} className="py-2">
              {a.art === "krank" ? "Krank" : a.art === "urlaub" ? "Urlaub" : "Sonstiges"} {datum(a.von)} bis {datum(a.bis)} <span className="text-grau">· {a.status}</span>
            </li>
          ))}
        </ul>
      </Abschnitt>

      {p.zeiterfassung ? (
        <Abschnitt titel={`Zeiterfassung ${monat.slice(5)}/${monat.slice(0, 4)}: ${stunden(mz.minuten)}`}>
          <Reiter aktiv="" eintraege={[{ href: `?monat=${vor}`, text: "← Vormonat" }, { href: `?monat=${nach}`, text: "Nächster →" }]} />
          <Tabelle kopf={["Tag", "Kommt", "Geht", { text: "Dauer", zahl: true }, "Notiz", ""]}>
            {mz.eintraege.map((z) => {
              const min = Math.round(((z.ende ? new Date(z.ende).getTime() : jetztMs()) - new Date(z.beginn).getTime()) / 60000);
              return (
                <tr key={z.id}>
                  <td className="zahlen">{datumKurzText(z.beginn)}</td>
                  <td className="zahlen">{zeit(z.beginn)}</td>
                  <td className="zahlen">{z.ende ? zeit(z.ende) : "läuft"}</td>
                  <td className="zahl">{stunden(min)}</td>
                  <td className="text-grau">{z.notiz}</td>
                  <td className="text-right">
                    <Formular aktion={zeitLoeschen.bind(null, z.id)} bestaetigen="Eintrag löschen?">
                      <button className="text-sm text-grau underline">löschen</button>
                    </Formular>
                  </td>
                </tr>
              );
            })}
          </Tabelle>
          <Formular aktion={zeitNachtragen.bind(null, id)} zuruecksetzen className="mt-6 grid items-end gap-3 sm:grid-cols-[10rem_8rem_8rem_minmax(0,1fr)_auto]">
            <Feld label="Datum" name="datum" typ="date" required />
            <Feld label="Kommt" name="von" typ="time" required />
            <Feld label="Geht" name="bis" typ="time" required />
            <Feld label="Notiz" name="notiz" placeholder="nachgetragen" />
            <Senden klein>Nachtragen</Senden>
          </Formular>
        </Abschnitt>
      ) : null}
    </>
  );
}
