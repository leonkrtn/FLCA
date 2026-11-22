import Link from "next/link";
import { notFound } from "next/navigation";
import { Formular, Senden } from "@/components/admin/formular";
import { MarkeModell, type Typen } from "@/components/admin/marke-modell";
import { NotizenAbschnitt } from "@/components/admin/notizen";
import { Abschnitt, Feld, Kopf, Marke, Textfeld } from "@/components/admin/ui";
import { fahrzeugSpeichern, kundeSpeichern } from "@/lib/aktionen/kunden";
import { belegAnlegen } from "@/lib/aktionen/belege";
import { type FruehereRechnung, fruehereRechnungen } from "@/lib/altbestand/daten";
import { benutzerMitRecht } from "@/lib/auth";
import { datum, datumZeit, euro } from "@/lib/format";
import { kvStatusText, type Kostenvoranschlag } from "@/lib/rechnung/kostenvoranschlaege";
import { RECHNUNG_STATUS } from "@/lib/rechnung/rechnungen";
import { darf } from "@/lib/rollen";
import { TERMIN_TON } from "@/lib/status";
import { db } from "@/lib/supabase/admin";
import { STATUS_TEXT, type Termin } from "@/lib/termine";
import { fahrzeugTypen, markeUndModell } from "@/lib/kunden";

export default async function KundeDetail({ params }: { params: Promise<{ id: string }> }) {
  const b = await benutzerMitRecht("kunden");
  const { id } = await params;
  const { data: k } = await db().from("kunden").select("*").eq("id", id).maybeSingle();
  if (!k) notFound();
  const [fz, tm, re, ei, kv, typen, alt] = await Promise.all([
    db().from("fahrzeuge").select("*").eq("kunde_id", id).order("erstellt_am"),
    db().from("termine").select("id, beginn, leistung_name, status, km_stand, fahrzeug:fahrzeuge(kennzeichen)").eq("kunde_id", id).order("beginn", { ascending: false }).limit(50),
    db().from("rechnungen").select("id, nummer, status, summe_brutto_cent, rechnungsdatum").eq("kunde_id", id).order("erstellt_am", { ascending: false }),
    db().from("einlagerungen").select("id, lagerplatz, saison, reifengroesse, eingelagert_am, ausgelagert_am, fahrzeug:fahrzeuge(kennzeichen)").eq("kunde_id", id).order("eingelagert_am", { ascending: false }),
    db().from("kostenvoranschlaege").select("id, nummer, status, gueltig_bis, summe_brutto_cent, datum").eq("kunde_id", id).order("erstellt_am", { ascending: false }),
    fahrzeugTypen(),
    fruehereRechnungen(id),
  ]);
  // Bei genau einem Fahrzeug kommt es gleich mit auf den neuen Beleg.
  const einziges = fz.data?.length === 1 ? (fz.data[0].id as string) : null;
  const termine = (tm.data ?? []) as unknown as (Pick<Termin, "id" | "beginn" | "leistung_name" | "status" | "km_stand"> & { fahrzeug: { kennzeichen: string } | null })[];

  return (
    <>
      <Kopf titel={k.name} unter={`Kunde Nr. ${k.nummer}${k.firma ? ` · ${k.firma}` : ""}`} zurueck={{ href: "/admin/kunden", text: "Kunden" }}>
        <Link href={`/admin/termine/neu?kunde=${k.id}`} className="knopf knopf-rahmen knopf-klein">Termin eintragen</Link>
        <form action={belegAnlegen.bind(null, "kostenvoranschlag", "admin", k.id, einziges)}>
          <button className="knopf knopf-rahmen knopf-klein">Kostenvoranschlag</button>
        </form>
        <form action={belegAnlegen.bind(null, "rechnung", "admin", k.id, einziges)}>
          <button className="knopf knopf-rahmen knopf-klein">Rechnung ohne Termin</button>
        </form>
      </Kopf>
      <div className="grid gap-x-8 lg:grid-cols-2">
        <Abschnitt titel="Stammdaten">
          <Formular aktion={kundeSpeichern.bind(null, k.id)} className="grid gap-4 sm:grid-cols-2">
            <Feld label="Name" name="name" wert={k.name} required />
            <Feld label="Firma" name="firma" wert={k.firma} />
            <Feld label="Telefon" name="telefon" wert={k.telefon} typ="tel" />
            <Feld label="E-Mail" name="email" wert={k.email} typ="email" />
            <Feld label="Straße" name="strasse" wert={k.strasse} className="sm:col-span-2" />
            <Feld label="PLZ" name="plz" wert={k.plz} />
            <Feld label="Ort" name="ort" wert={k.ort} />
            <Feld label="USt-IdNr. (Geschäftskunde)" name="ust_id" wert={k.ust_id} />
            <Feld label="Leitweg-ID (Behörde)" name="leitweg_id" wert={k.leitweg_id} />
            <Textfeld label="Notiz" name="notiz" wert={k.notiz} zeilen={3} className="sm:col-span-2" />
            <div><Senden vorab="Gespeichert">Speichern</Senden></div>
          </Formular>
        </Abschnitt>
        <div>
          <Abschnitt titel="Fahrzeuge">
            <div className="space-y-6">
              {(fz.data ?? []).map((f) => (
                <details key={f.id} className="border-b border-linie pb-4">
                  {/* Kennzeichen in fester Breite, damit die Modelle untereinander bündig stehen; km-Stand rechts. */}
                  <summary className="flex cursor-pointer list-none items-baseline gap-3">
                    <span className="zahlen min-w-28 shrink-0 font-semibold">{f.kennzeichen}</span>
                    <span className="min-w-0 flex-1 truncate text-grau">{f.marke_modell}</span>
                    {f.km_stand ? <span className="zahlen shrink-0 text-right text-sm text-grau">{new Intl.NumberFormat("de-DE").format(f.km_stand)} km</span> : null}
                  </summary>
                  <FahrzeugFormular kundeId={k.id} f={f} typen={typen} />
                </details>
              ))}
              <details>
                <summary className="cursor-pointer font-semibold">+ Fahrzeug hinzufügen</summary>
                <FahrzeugFormular kundeId={k.id} typen={typen} />
              </details>
            </div>
          </Abschnitt>
          {ei.data?.length ? (
            <Abschnitt titel="Einlagerung">
              <ul className="space-y-1 text-sm">
                {(ei.data as unknown as { id: string; lagerplatz: string; saison: string; eingelagert_am: string; ausgelagert_am: string | null; fahrzeug: { kennzeichen: string } | null }[]).map((e) => (
                  <li key={e.id}>
                    <Link href={`/admin/einlagerung/${e.id}`} className="hover:underline">
                      {e.saison === "winter" ? "Winterräder" : e.saison === "sommer" ? "Sommerräder" : "Ganzjahresräder"} {e.fahrzeug?.kennzeichen} · Platz {e.lagerplatz || "–"}
                    </Link>
                    <span className="text-grau"> {e.ausgelagert_am ? `ausgelagert ${datum(e.ausgelagert_am)}` : `seit ${datum(e.eingelagert_am)}`}</span>
                  </li>
                ))}
              </ul>
            </Abschnitt>
          ) : null}
        </div>
      </div>
      <div className="grid gap-x-8 lg:grid-cols-2">
        {darf(b.rolle, "notizen") ? <NotizenAbschnitt b={b} kundeId={k.id} /> : null}
        <Abschnitt titel="Termine">
          <ul className="divide-y divide-linie text-sm">
            {termine.map((t) => (
              <li key={t.id}>
                <Link href={`/admin/termine/${t.id}`} className="flex items-center justify-between gap-3 py-2 hover:bg-papier">
                  <span className="min-w-0">
                    <span className="zahlen">{datumZeit(t.beginn)}</span> · {t.leistung_name} <span className="text-grau">{t.fahrzeug?.kennzeichen}</span>
                  </span>
                  <Marke ton={TERMIN_TON[t.status]}>{STATUS_TEXT[t.status]}</Marke>
                </Link>
              </li>
            ))}
            {!termine.length ? <li className="py-2 text-grau">Keine Termine.</li> : null}
          </ul>
        </Abschnitt>
        <Abschnitt titel="Rechnungen">
          <ul className="divide-y divide-linie text-sm">
            {(re.data ?? []).map((r) => (
              <li key={r.id}>
                <Link href={`/admin/rechnungen/${r.id}`} className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-3 py-2 hover:bg-papier">
                  <span>{r.nummer ?? "Entwurf"} <span className="text-grau">{datum(r.rechnungsdatum)}</span></span>
                  <span className="text-grau">{RECHNUNG_STATUS[r.status as keyof typeof RECHNUNG_STATUS]}</span>
                  <span className="zahlen text-right">{euro(r.summe_brutto_cent)}</span>
                </Link>
              </li>
            ))}
            {!re.data?.length && !alt.length ? <li className="py-2 text-grau">Keine Rechnungen.</li> : null}
          </ul>
          {kv.data?.length ? (
            <>
              <h3 className="mb-1 mt-6 font-semibold">Kostenvoranschläge</h3>
              <ul className="divide-y divide-linie text-sm">
                {(kv.data as Pick<Kostenvoranschlag, "id" | "nummer" | "status" | "gueltig_bis" | "summe_brutto_cent" | "datum">[]).map((v) => (
                  <li key={v.id}>
                    <Link href={`/admin/kostenvoranschlaege/${v.id}`} className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-3 py-2 hover:bg-papier">
                      <span>{v.nummer ?? "Entwurf"} <span className="text-grau">{datum(v.datum)}</span></span>
                      <span className="text-grau">{kvStatusText(v)}</span>
                      <span className="zahlen text-right">{euro(v.summe_brutto_cent)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          {alt.length ? <FruehereRechnungen liste={alt} /> : null}
        </Abschnitt>
      </div>
    </>
  );
}

/**
 * Rechnungen aus der Zeit vor dem System (Einstellungen → Datenübernahme), zum Nachschlagen: was wann am
 * Auto gemacht wurde und zu welchem Preis. Positionen stehen wie auf dem Beleg, also netto bzw. bei
 * Kleinunternehmer-Rechnungen ohne Umsatzsteuer.
 */
function FruehereRechnungen({ liste }: { liste: FruehereRechnung[] }) {
  const umsatz = liste.filter((r) => !r.korrektur).reduce((s, r) => s + (r.endbetrag_cent ?? 0), 0);
  const zahl = (cent: number | null) => (cent == null ? "" : euro(cent));
  return (
    <>
      <h3 className="mb-1 mt-6 flex items-baseline justify-between gap-3 font-semibold">
        <span>Frühere Rechnungen</span>
        <span className="zahlen text-sm font-normal text-grau">{euro(umsatz)} gesamt</span>
      </h3>
      <ul className="divide-y divide-linie text-sm">
        {liste.map((r) => (
          <li key={r.id}>
            <details>
              <summary className="grid cursor-pointer list-none grid-cols-[minmax(0,1fr)_auto] gap-3 py-2 hover:bg-papier">
                <span className="min-w-0 truncate">
                  <span className="zahlen">{r.nummer}</span> <span className="text-grau">{datum(r.rechnungsdatum)} {r.kennzeichen}</span>
                  {r.korrektur ? <span className="text-grau"> · Korrektur</span> : null}
                </span>
                <span className="zahlen text-right">{zahl(r.endbetrag_cent)}</span>
              </summary>
              <div className="grid gap-2 pb-4">
                <table className="w-full text-sm">
                  <tbody>
                    {r.positionen.map((p, i) => (
                      <tr key={i} className="align-top">
                        <td className="zahlen w-12 py-0.5 pr-2 text-grau">{p.menge}</td>
                        <td className="py-0.5 pr-2">{p.text}</td>
                        <td className="zahlen py-0.5 text-right">{euro(p.summe_cent)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="zahlen text-xs text-grau">
                  {r.steuer === "kleinunternehmer"
                    ? "ohne Umsatzsteuer (§ 19 UStG)"
                    : [r.netto_cent != null ? `netto ${euro(r.netto_cent)}` : "", r.mwst_cent != null ? `MwSt ${euro(r.mwst_cent)}` : "", r.brutto_cent != null ? `brutto ${euro(r.brutto_cent)}` : ""].filter(Boolean).join(" · ")}
                  {r.regulaer_cent ? ` · Sonderpreis statt ${euro(r.regulaer_cent)}` : ""}
                  {r.leistungsdatum && r.leistungsdatum !== r.rechnungsdatum ? ` · Leistung ${datum(r.leistungsdatum)}` : ""}
                  {r.km_stand ? ` · ${new Intl.NumberFormat("de-DE").format(r.km_stand)} km` : ""}
                  {r.zahlart ? ` · ${r.zahlart}` : ""}
                </p>
                <p className="break-all text-xs text-grau">Original: {r.datei}</p>
              </div>
            </details>
          </li>
        ))}
      </ul>
    </>
  );
}

function FahrzeugFormular({ kundeId, f, typen }: { kundeId: string; f?: Record<string, string | number | null>; typen: Typen }) {
  const mm = f ? markeUndModell({ marke_modell: String(f.marke_modell ?? ""), marke: String(f.marke ?? ""), modell: String(f.modell ?? "") }) : { marke: "", modell: "" };
  return (
    <Formular aktion={fahrzeugSpeichern.bind(null, kundeId, (f?.id as string) ?? null)} className="mt-4 grid gap-3 sm:grid-cols-2">
      <Feld label="Kennzeichen" name="kennzeichen" wert={f?.kennzeichen} required />
      <MarkeModell typen={typen} marke={mm.marke} modell={mm.modell} className="sm:col-span-2" />
      <Feld label="HSN" name="hsn" wert={f?.hsn} />
      <Feld label="TSN" name="tsn" wert={f?.tsn} />
      <Feld label="FIN" name="fin" wert={f?.fin} />
      <Feld label="Reifengröße" name="reifengroesse" wert={f?.reifengroesse} placeholder="205/55 R16 91V" />
      <Feld label="Kilometerstand" name="km_stand" wert={f?.km_stand} inputMode="numeric" />
      <div className="self-end"><Senden className="w-full sm:w-auto" vorab="Gespeichert">Speichern</Senden></div>
    </Formular>
  );
}
