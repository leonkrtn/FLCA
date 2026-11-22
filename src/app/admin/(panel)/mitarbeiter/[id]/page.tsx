import { notFound } from "next/navigation";
import { Formular, Senden } from "@/components/admin/formular";
import { FaehigkeitenMatrix } from "@/components/admin/faehigkeiten";
import { Abschnitt, Auswahl, Feld, Kopf, Marke, Reiter, Schalter, Tabelle } from "@/components/admin/ui";
import { ZeitkontoKacheln } from "@/components/zeitkonto";
import {
  abwesenheitLoeschen,
  abwesenheitMelden,
  arbeitszeitenSpeichern,
  ausnahmeLoeschen,
  ausnahmeSpeichern,
  einplanenSpeichern,
  profilSpeichern,
  zeitLoeschen,
  zeitNachtragen,
} from "@/lib/aktionen/team";
import { benutzerMitRecht } from "@/lib/auth";
import { type Fenster, WOCHENTAGE } from "@/lib/einstellungen";
import { datum, datumKurzText, zeit } from "@/lib/format";
import { KATEGORIEN } from "@/lib/inhalte";
import { istPlanbar, urlaubKonten, zeitkonto } from "@/lib/mitarbeiter";
import { abwesenheitText, kalenderwoche } from "@/lib/planung";
import { darf, ROLLEN, rollenName } from "@/lib/rollen";
import { db } from "@/lib/supabase/admin";
import { istTerminLeistung, type Leistung } from "@/lib/termine";
import { berlinDatum, istDatum, plusTage } from "@/lib/zeit";
import { monatszeiten, nettoMinuten, saldo, stunden } from "@/lib/zeiterfassung";

type Zeile = { wochentag: number; beginn: string; ende: string; woche: "jede" | "gerade" | "ungerade" };

export default async function Person({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ monat?: string; datum?: string }> }) {
  const b = await benutzerMitRecht("team");
  // Personalsachen (Rolle, Konto, Urlaubsanspruch, Zeiterfassung) nur für den Inhaber; das Büro plant mit.
  const personal = darf(b.rolle, "personal");
  const { id } = await params;
  const { monat: m, datum: vorgabeDatum } = await searchParams;
  const monat = m && /^\d{4}-\d{2}$/.test(m) ? m : berlinDatum().slice(0, 7);
  const heute = berlinDatum();
  const jahr = heute.slice(0, 4);
  const { data: p } = await db().from("profile").select("*").eq("id", id).maybeSingle();
  if (!p) notFound();
  const [{ data: zeiten }, { data: abw }, { data: ausnahmen }, { data: l }, { data: sperren }, mz, konten, konto] = await Promise.all([
    db().from("arbeitszeiten").select("*").eq("profil_id", id).order("wochentag").order("beginn"),
    db().from("abwesenheiten").select("*").eq("profil_id", id).order("von", { ascending: false }).limit(40),
    db().from("arbeitszeit_ausnahmen").select("*").eq("profil_id", id).gte("datum", plusTage(heute, -14)).order("datum").limit(60),
    db().from("leistungen").select("id, name, kategorie, art, aktiv, sortierung").order("sortierung"),
    db().from("leistung_sperren").select("leistung_id").eq("profil_id", id),
    monatszeiten(id, monat),
    urlaubKonten(jahr, [id]),
    p.zeiterfassung && personal ? zeitkonto(id, monat) : Promise.resolve(null),
  ]);
  const urlaub = konten.get(id);
  const planbar = istPlanbar(p.rolle, p.nimmt_auftraege);
  const plan = (zeiten ?? []) as Zeile[];
  const wechsel = plan.some((z) => z.woche !== "jede");
  // Plan A: jede Woche bzw. gerade Kalenderwochen; Plan B: ungerade Kalenderwochen
  const fenster = (planB: boolean, t: number, n: number) =>
    plan.filter((z) => z.wochentag === t && (planB ? z.woche === "ungerade" : z.woche !== "ungerade"))[n - 1];
  const leistungen = ((l ?? []) as Leistung[]).filter(istTerminLeistung);
  const vor = new Date(Date.UTC(Number(monat.slice(0, 4)), Number(monat.slice(5)) - 2, 1)).toISOString().slice(0, 7);
  const nach = new Date(Date.UTC(Number(monat.slice(0, 4)), Number(monat.slice(5)), 1)).toISOString().slice(0, 7);
  const kw = kalenderwoche(heute);

  return (
    <>
      <Kopf
        titel={p.name || p.email}
        unter={
          <span className="flex flex-wrap items-center gap-2">
            <span>{p.email} · {rollenName(p.rolle)}</span>
            {planbar ? <Marke ton="ok">eingeplant</Marke> : <Marke ton="hell">nicht eingeplant</Marke>}
            {!p.aktiv ? <Marke ton="hell">deaktiviert</Marke> : null}
            {urlaub?.anspruch ? <span className="zahlen">Resturlaub {String(urlaub.rest).replace(".", ",")} Tage</span> : null}
            {konto?.saldoGesamt != null ? <span className={`zahlen ${konto.saldoGesamt < 0 ? "text-rot" : ""}`}>Zeitkonto {saldo(konto.saldoGesamt)}</span> : null}
          </span>
        }
        zurueck={{ href: "/admin/mitarbeiter", text: "Mitarbeiter" }}
      />
      {personal ? (
        <Abschnitt titel="Person">
          <Formular aktion={profilSpeichern.bind(null, id)} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Feld label="Name" name="name" wert={p.name} />
            <Feld label="Telefon" name="telefon" wert={p.telefon} typ="tel" />
            <Auswahl label="Rolle" name="rolle" wert={p.rolle} optionen={ROLLEN.map((r) => [r.wert, r.name])} />
            <Feld
              label="Urlaubstage pro Jahr"
              name="urlaubstage"
              wert={p.urlaubstage}
              inputMode="numeric"
              hilfe={urlaub ? `${String(urlaub.genehmigt).replace(".", ",")} Arbeitstage in ${jahr} genehmigt, ${String(urlaub.beantragt).replace(".", ",")} beantragt` : undefined}
            />
            <Schalter
              label="In der Werkstatt einplanen"
              name="nimmt_auftraege"
              an={planbar}
              hilfe={p.rolle === "mitarbeiter" ? "Mitarbeiter werden immer eingeplant" : "Für Inhaber und Büro: Zählt für freie Termine auf der Website und wird zugeteilt"}
            />
            <Schalter label="Zeiterfassung" name="zeiterfassung" an={p.zeiterfassung} hilfe="Ein- und Ausstempeln in der Team-App" />
            <Schalter label="Konto aktiv" name="aktiv" an={p.aktiv} hilfe="Aus = kein Login mehr möglich" />
            <div className="sm:col-span-2 xl:col-span-4"><Senden vorab="Gespeichert">Speichern</Senden></div>
          </Formular>
        </Abschnitt>
      ) : p.rolle !== "mitarbeiter" ? (
        <Abschnitt titel="Einplanen">
          <Formular aktion={einplanenSpeichern.bind(null, id)} className="grid gap-4">
            <Schalter label="In der Werkstatt einplanen" name="nimmt_auftraege" an={planbar} hilfe="Zählt für freie Termine auf der Website und wird zugeteilt" />
            <div><Senden vorab="Gespeichert">Speichern</Senden></div>
          </Formular>
        </Abschnitt>
      ) : null}

      <div className="grid gap-x-8 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Abschnitt titel="Wochenplan" aktion={<span className="text-sm text-grau">Diese Woche: KW {kw} ({kw % 2 === 0 ? "gerade" : "ungerade"})</span>}>
          <Formular aktion={arbeitszeitenSpeichern.bind(null, id)}>
            <Schalter label="Wechselnde Wochen" name="wechsel" an={wechsel} hilfe="Linker Plan gilt dann in geraden, rechter in ungeraden Kalenderwochen (z. B. jeder zweite Samstag)" />
            <div className="mt-4 grid gap-6">
              {[false, true].map((planB) => (
                <div key={String(planB)}>
                  <p className="mb-2 text-sm font-semibold">{planB ? "Ungerade Kalenderwochen" : "Jede Woche / gerade Kalenderwochen"}</p>
                  <div className="grid grid-cols-[5.5rem_repeat(4,minmax(0,1fr))] items-center gap-x-2 gap-y-2 quer-scrollen">
                    <span />
                    {["Beginn", "Ende", "Beginn 2", "Ende 2"].map((k) => (
                      <span key={k} className="label mb-0 text-grau">{k}</span>
                    ))}
                    {WOCHENTAGE.map((tag, i) => (
                      <div key={tag} className="contents">
                        <span className="text-sm font-semibold">{tag}</span>
                        {[1, 2].flatMap((n) => [
                          <input key={`${n}v`} type="time" name={`${planB ? "b" : "a"}_t${i + 1}_${n}_von`} defaultValue={fenster(planB, i + 1, n)?.beginn?.slice(0, 5)} className="feld min-w-[5.5rem] tabular-nums" aria-label={`${tag} ${n === 1 ? "Beginn" : "Beginn 2"}`} />,
                          <input key={`${n}b`} type="time" name={`${planB ? "b" : "a"}_t${i + 1}_${n}_bis`} defaultValue={fenster(planB, i + 1, n)?.ende?.slice(0, 5)} className="feld min-w-[5.5rem] tabular-nums" aria-label={`${tag} ${n === 1 ? "Ende" : "Ende 2"}`} />,
                        ])}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-3 text-sm text-grau">Zweites Zeitfenster für geteilte Schichten (z. B. mit Mittagspause). Leer lassen = frei. Ohne „wechselnde Wochen“ zählt nur der linke Plan.</p>
            <div className="mt-4"><Senden vorab="Gespeichert">Wochenplan speichern</Senden></div>
          </Formular>
        </Abschnitt>

        <div>
          <Abschnitt titel="Abweichende Tage">
            <span id="ausnahmen" className="block -translate-y-24" aria-hidden />
            <Formular aktion={ausnahmeSpeichern.bind(null, id)} zuruecksetzen className="grid gap-3 sm:grid-cols-2">
              <Feld label="Datum" name="datum" typ="date" wert={istDatum(vorgabeDatum) ? vorgabeDatum : ""} required />
              <Feld label="Bis (optional)" name="datum_bis" typ="date" hilfe="Für mehrere Tage am Stück" />
              <div className="grid grid-cols-2 gap-2 sm:col-span-2 sm:grid-cols-4">
                <Feld label="Beginn" name="von_1" typ="time" />
                <Feld label="Ende" name="bis_1" typ="time" />
                <Feld label="Beginn 2" name="von_2" typ="time" />
                <Feld label="Ende 2" name="bis_2" typ="time" />
              </div>
              <Feld label="Notiz" name="notiz" className="sm:col-span-2" placeholder="z. B. Berufsschule, Messe" />
              <p className="text-sm text-grau sm:col-span-2">Ohne Uhrzeit = an dem Tag frei. Gilt statt des Wochenplans.</p>
              <div className="sm:col-span-2"><Senden vorab="Gespeichert">Speichern</Senden></div>
            </Formular>
            {ausnahmen?.length ? (
              <ul className="mt-4 divide-y divide-linie text-sm">
                {ausnahmen.map((a) => (
                  <li key={a.id} className={`flex items-center justify-between gap-3 py-2 ${a.datum < heute ? "text-grau" : ""}`}>
                    <span className="min-w-0">
                      <span className="zahlen font-semibold">{datumKurzText(a.datum)}</span>{" "}
                      {(a.fenster as Fenster[]).length ? <span className="zahlen">{(a.fenster as Fenster[]).map(([x, y]) => `${x}–${y}`).join(", ")}</span> : "frei"}
                      {a.notiz ? <span className="text-grau"> · {a.notiz}</span> : null}
                    </span>
                    <Formular aktion={ausnahmeLoeschen.bind(null, a.id)}>
                      <button className="text-grau underline">löschen</button>
                    </Formular>
                  </li>
                ))}
              </ul>
            ) : null}
          </Abschnitt>

          <Abschnitt titel="Abwesenheiten">
            <span id="abwesenheiten" className="block -translate-y-24" aria-hidden />
            <Formular aktion={abwesenheitMelden.bind(null, id)} zuruecksetzen className="mb-6 grid items-end gap-3 sm:grid-cols-2">
              <Auswahl label="Art" name="art" optionen={[["urlaub", "Urlaub"], ["krank", "Krank"], ["sonstiges", "Sonstiges"]]} />
              <Feld label="Notiz" name="notiz" />
              <Feld label="Von" name="von" typ="date" required />
              <Feld label="Bis" name="bis" typ="date" />
              <Feld label="Ab Uhrzeit (halber Tag)" name="von_zeit" typ="time" />
              <Feld label="Bis Uhrzeit" name="bis_zeit" typ="time" />
              <p className="text-sm text-grau sm:col-span-2">Mit Uhrzeit nur für einen Tag. Termine der Person in der Zeit gehen automatisch an Kollegen, die frei sind.</p>
              <div className="sm:col-span-2"><Senden vorab="Eingetragen">Eintragen</Senden></div>
            </Formular>
            <ul className="divide-y divide-linie text-sm">
              {(abw ?? []).map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 py-2">
                  <span className="min-w-0">
                    {abwesenheitText(a)} {datum(a.von)}
                    {a.bis !== a.von ? ` bis ${datum(a.bis)}` : ""}
                    {a.von_zeit ? `, ${a.von_zeit.slice(0, 5)}–${a.bis_zeit?.slice(0, 5)} Uhr` : ""} <span className="text-grau">· {a.status}</span>
                  </span>
                  <Formular aktion={abwesenheitLoeschen.bind(null, a.id)} bestaetigen="Abwesenheit löschen?">
                    <button className="text-grau underline">löschen</button>
                  </Formular>
                </li>
              ))}
            </ul>
          </Abschnitt>
        </div>
      </div>

      <Abschnitt titel="Darf diese Leistungen" aktion={<span className="text-sm text-grau">Neue Leistungen gelten wie ihre Kategorie.</span>}>
        {planbar ? (
          <FaehigkeitenMatrix
            profil={id}
            leistungen={leistungen.map((x) => ({ id: x.id, name: x.name, kategorie: x.kategorie }))}
            personen={[{ id, name: p.name || p.email }]}
            gesperrt={(sperren ?? []).map((x) => `${id}_${x.leistung_id}`)}
            kategorien={KATEGORIEN}
          />
        ) : (
          <p className="text-grau">Wird nicht in der Werkstatt eingeplant. {p.rolle === "mitarbeiter" ? "" : "Oben zuschalten, dann lässt sich hier eintragen, was die Person machen darf."}</p>
        )}
      </Abschnitt>

      {p.zeiterfassung && personal ? (
        <Abschnitt titel={`Zeiterfassung ${monat.slice(5)}/${monat.slice(0, 4)}: ${stunden(mz.minuten)}`}>
          {konto ? (
            <div className="mb-6">
              <ZeitkontoKacheln k={konto} />
            </div>
          ) : null}
          <Reiter aktiv="" eintraege={[{ href: `?monat=${vor}`, text: "← Vormonat" }, { href: `?monat=${nach}`, text: "Nächster →" }]} />
          <Tabelle kopf={["Tag", "Kommt", "Geht", { text: "Pause", zahl: true }, { text: "Dauer", zahl: true }, "Notiz", ""]}>
            {mz.eintraege.map((z) => {
              const min = nettoMinuten(z);
              return (
                <tr key={z.id}>
                  <td className="zahlen">{datumKurzText(z.beginn)}</td>
                  <td className="zahlen">{zeit(z.beginn)}</td>
                  <td className="zahlen">{z.ende ? zeit(z.ende) : "läuft"}</td>
                  <td className="zahl">{z.pause_seit ? "läuft" : z.pause_minuten ? `${z.pause_minuten} min` : "–"}</td>
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
          <Formular aktion={zeitNachtragen.bind(null, id)} zuruecksetzen className="mt-6 grid items-end gap-3 sm:grid-cols-2 xl:grid-cols-[11rem_8rem_8rem_7rem_minmax(0,1fr)_auto]">
            <Feld label="Datum" name="datum" typ="date" required />
            <Feld label="Kommt" name="von" typ="time" required />
            <Feld label="Geht" name="bis" typ="time" required />
            <Feld label="Pause (min)" name="pause" inputMode="numeric" />
            <Feld label="Notiz" name="notiz" placeholder="nachgetragen" />
            <Senden vorab="Nachgetragen">Nachtragen</Senden>
          </Formular>
        </Abschnitt>
      ) : null}
    </>
  );
}
