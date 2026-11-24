import Link from "next/link";
import { notFound } from "next/navigation";
import { Formular, Senden } from "@/components/admin/formular";
import { MarkeModell, type Typen } from "@/components/admin/marke-modell";
import { NotizenAbschnitt } from "@/components/admin/notizen";
import { Abschnitt, Feld, Kopf, Marke, Textfeld } from "@/components/admin/ui";
import { fahrzeugSpeichern, kundeSpeichern } from "@/lib/aktionen/kunden";
import { belegAnlegen } from "@/lib/aktionen/belege";
import { FruehereRechnungen, fruehereSumme } from "@/components/admin/fruehere-rechnungen";
import { KundeLoeschen, type LoeschFolgen } from "@/components/admin/kunde-loeschen";
import { fruehereRechnungen } from "@/lib/altbestand/daten";
import { benutzerMitRecht } from "@/lib/auth";
import { datum, datumZeit, euro, telHref } from "@/lib/format";
import { offenerBetrag } from "@/lib/rechnung/korrektur";
import { jetztMs } from "@/lib/zeit";
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
  const [fz, tm, re, ei, kv, typen, alt, laufend, notizen] = await Promise.all([
    db().from("fahrzeuge").select("*").eq("kunde_id", id).order("erstellt_am"),
    db().from("termine").select("id, beginn, leistung_name, status, km_stand, fahrzeug:fahrzeuge(kennzeichen)").eq("kunde_id", id).order("beginn", { ascending: false }).limit(50),
    // „*“: korrektur_zu und korrektur_grund gibt es erst nach der Migration „rechnung_korrigieren“.
    db().from("rechnungen").select("*").eq("kunde_id", id).order("erstellt_am", { ascending: false }),
    db().from("einlagerungen").select("id, lagerplatz, saison, reifengroesse, eingelagert_am, ausgelagert_am, fahrzeug:fahrzeuge(kennzeichen)").eq("kunde_id", id).order("eingelagert_am", { ascending: false }),
    db().from("kostenvoranschlaege").select("id, nummer, status, gueltig_bis, summe_brutto_cent, datum").eq("kunde_id", id).order("erstellt_am", { ascending: false }),
    fahrzeugTypen(),
    fruehereRechnungen(id),
    // Was das Löschen verhindert, genau wie in kunde_loeschen geprüft
    db().from("termine").select("id, beginn, leistung_name").eq("kunde_id", id).in("status", ["angefragt", "bestaetigt"]).or(`belegt_bis.gte.${new Date().toISOString()},auftrag_status.eq.in_arbeit`),
    db().from("notizen").select("id", { count: "exact", head: true }).eq("kunde_id", id),
  ]);
  const eingelagert = (ei.data ?? []).filter((e) => !e.ausgelagert_am);
  const loeschFolgen: LoeschFolgen = {
    fahrzeuge: fz.data?.length ?? 0,
    fruehere: alt.reduce((n, r) => n + 1 + r.aeltere.length, 0),
    rechnungen: (re.data?.length ?? 0) + (kv.data?.length ?? 0),
    termine: (tm.data?.length ?? 0) - (laufend.data?.length ?? 0),
    notizen: notizen.count ?? 0,
    hindernisse: [
      ...(laufend.data ?? []).map((t) => `Termin ${datumZeit(t.beginn)} (${t.leistung_name}) läuft noch: erst absagen oder abschließen.`),
      ...(eingelagert.length ? [`${eingelagert.length === 1 ? "Ein Satz Räder ist" : `${eingelagert.length} Sätze Räder sind`} noch eingelagert: erst auslagern.`] : []),
    ],
  };
  // Bei genau einem Fahrzeug kommt es gleich mit auf den neuen Beleg.
  const einziges = fz.data?.length === 1 ? (fz.data[0].id as string) : null;
  const termine = (tm.data ?? []) as unknown as (Pick<Termin, "id" | "beginn" | "leistung_name" | "status" | "km_stand"> & { fahrzeug: { kennzeichen: string } | null })[];

  // Kennzahlen oben: was beim Öffnen der Akte zuerst interessiert, ohne durch die Listen zu scrollen.
  const jetzt = jetztMs();
  const naechster = [...termine].reverse().find((t) => (t.status === "angefragt" || t.status === "bestaetigt") && new Date(t.beginn).getTime() >= jetzt);
  // Offen nur aus gestellten Rechnungen und über offenerBetrag (Fehlerbuch: Zahlungsfrage positiv aus dem Status).
  const offen = (re.data ?? []).filter((r) => r.status === "gestellt").reduce((s, r) => s + offenerBetrag(r), 0);
  const anschrift = [k.strasse, [k.plz, k.ort].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  const kontakt: [string, React.ReactNode][] = [
    ["Telefon", k.telefon ? <a href={telHref(k.telefon)} className="hover:underline">{k.telefon}</a> : null],
    ["E-Mail", k.email ? <a href={`mailto:${k.email}`} className="break-all hover:underline">{k.email}</a> : null],
    ["Anschrift", anschrift || null],
    ["Firma", k.firma || null],
    ["USt-IdNr.", k.ust_id || null],
    ["Leitweg-ID", k.leitweg_id || null],
  ];
  const sichtbar = kontakt.filter(([, v]) => v);
  const kennzahlen: [string, React.ReactNode, string?][] = [
    ["Nächster Termin", naechster ? <Link href={`/admin/termine/${naechster.id}`} className="hover:underline">{datumZeit(naechster.beginn)}</Link> : "keiner"],
    ["Fahrzeuge", String(fz.data?.length ?? 0)],
    ["Offen", euro(offen), offen > 0 ? "text-rot" : undefined],
    ["Kunde seit", datum(k.erstellt_am)],
  ];

  return (
    <>
      <Kopf titel={k.name} unter={`Kunde Nr. ${k.nummer}${k.firma ? ` · ${k.firma}` : ""}`} zurueck={{ href: "/admin/kunden", text: "Kunden" }}>
        <Link href={`/admin/termine/neu?kunde=${k.id}`} className="knopf knopf-rahmen knopf-klein">Termin eintragen</Link>
        <form action={belegAnlegen.bind(null, "kostenvoranschlag", "admin", k.id, einziges)}>
          <Senden art="rahmen" klein>Kostenvoranschlag</Senden>
        </form>
        <form action={belegAnlegen.bind(null, "rechnung", "admin", k.id, einziges)}>
          <Senden art="rahmen" klein>Rechnung ohne Termin</Senden>
        </form>
        <KundeLoeschen kundeId={k.id} name={k.name} folgen={loeschFolgen} />
      </Kopf>

      <dl className="mb-8 grid grid-cols-2 gap-px bg-linie md:grid-cols-4">
        {kennzahlen.map(([t, v, ton]) => (
          <div key={t} className="bg-weiss px-4 py-3 md:px-6">
            <dt className="text-sm text-grau">{t}</dt>
            <dd className={`zahlen mt-0.5 truncate text-lg font-semibold ${ton ?? ""}`}>{v}</dd>
          </div>
        ))}
      </dl>

      {/* Zwei Spalten, die jede für sich wachsen: Ein langer Kasten links reißt rechts keine Lücke auf. */}
      <div className="grid gap-x-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div>
          <Abschnitt titel="Kontakt">
            {sichtbar.length ? (
              <dl className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[7rem_minmax(0,1fr)]">
                {sichtbar.map(([t, v]) => (
                  <div key={t} className="contents">
                    <dt className="text-grau">{t}</dt>
                    <dd className="mb-2 break-words sm:mb-0">{v}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="text-sm text-grau">Noch keine Kontaktdaten.</p>
            )}
            {k.notiz ? <p className="mt-4 whitespace-pre-line border-t border-linie pt-4 text-sm">{k.notiz}</p> : null}
            {/* Einwilligungen vom Kundenbildschirm (Spalten erst nach der Migration „kundenbildschirm“) */}
            {k.datenschutz_am || k.whatsapp_ok_am || k.erinnerung_mail_ok_am ? (
              <ul className="mt-4 grid gap-1 border-t border-linie pt-4 text-sm">
                {k.datenschutz_am ? <li>Datenschutzhinweis bestätigt {datumZeit(k.datenschutz_am)}</li> : null}
                <li>{k.whatsapp_ok_am ? `WhatsApp erlaubt seit ${datumZeit(k.whatsapp_ok_am)}` : <span className="text-grau">WhatsApp nicht erlaubt</span>}</li>
                <li>{k.erinnerung_mail_ok_am ? `Erinnerungen per Mail erlaubt seit ${datumZeit(k.erinnerung_mail_ok_am)}` : <span className="text-grau">Erinnerungen per Mail nicht erlaubt</span>}</li>
              </ul>
            ) : null}
            {/* Bearbeiten aufklappbar: Die Akte liest man öfter, als man sie ändert. Ohne Kontaktdaten gleich offen. */}
            <details className="mt-4 border-t border-linie pt-4" open={!sichtbar.length || undefined}>
              <summary className="cursor-pointer text-sm font-semibold">Stammdaten bearbeiten</summary>
              <Formular aktion={kundeSpeichern.bind(null, k.id)} className="mt-4 grid gap-4 sm:grid-cols-2">
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
            </details>
          </Abschnitt>
          <Abschnitt titel="Fahrzeuge">
            <div className="divide-y divide-linie">
              {(fz.data ?? []).map((f) => (
                <details key={f.id} className="py-3 first:pt-0">
                  {/* Kennzeichen in fester Breite, damit die Modelle untereinander bündig stehen; km-Stand rechts. */}
                  <summary className="flex cursor-pointer list-none items-baseline gap-3">
                    <span className="zahlen min-w-28 shrink-0 font-semibold">{f.kennzeichen}</span>
                    <span className="min-w-0 flex-1 truncate text-grau">{f.marke_modell}</span>
                    {f.km_stand ? <span className="zahlen shrink-0 text-right text-sm text-grau">{new Intl.NumberFormat("de-DE").format(f.km_stand)} km</span> : null}
                  </summary>
                  <FahrzeugFormular kundeId={k.id} f={f} typen={typen} />
                </details>
              ))}
              <details className="py-3 first:pt-0">
                <summary className="cursor-pointer text-sm font-semibold">+ Fahrzeug hinzufügen</summary>
                <FahrzeugFormular kundeId={k.id} typen={typen} />
              </details>
            </div>
          </Abschnitt>
          {ei.data?.length ? (
            <Abschnitt titel="Einlagerung">
              <ul className="divide-y divide-linie text-sm">
                {(ei.data as unknown as { id: string; lagerplatz: string; saison: string; eingelagert_am: string; ausgelagert_am: string | null; fahrzeug: { kennzeichen: string } | null }[]).map((e) => (
                  <li key={e.id}>
                    <Link href={`/admin/einlagerung/${e.id}`} className="flex items-baseline justify-between gap-3 py-2 hover:bg-papier">
                      <span className="min-w-0">
                        {e.saison === "winter" ? "Winterräder" : e.saison === "sommer" ? "Sommerräder" : "Ganzjahresräder"} <span className="zahlen">{e.fahrzeug?.kennzeichen}</span>
                        <span className="text-grau"> · Platz {e.lagerplatz || "–"}</span>
                      </span>
                      <span className="shrink-0 text-grau">{e.ausgelagert_am ? `ausgelagert ${datum(e.ausgelagert_am)}` : `seit ${datum(e.eingelagert_am)}`}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Abschnitt>
          ) : null}
        </div>

        <div>
          {darf(b.rolle, "notizen") ? <NotizenAbschnitt b={b} kundeId={k.id} /> : null}
          <Abschnitt titel="Termine">
            <ul className="divide-y divide-linie text-sm">
              {termine.map((t) => (
                <li key={t.id}>
                  <Link href={`/admin/termine/${t.id}`} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-2 hover:bg-papier">
                    <span className="min-w-0">
                      <span className="block truncate">{t.leistung_name}</span>
                      <span className="text-grau"><span className="zahlen">{datumZeit(t.beginn)}</span>{t.fahrzeug?.kennzeichen ? ` · ${t.fahrzeug.kennzeichen}` : ""}</span>
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
              {(re.data ?? []).map((r) => {
                // Fassungen einer Korrektur und Stornos zeigen, worauf sie sich beziehen, damit die Kette lesbar bleibt.
                const nummerVon = (bezug: string | null | undefined) => (re.data ?? []).find((x) => x.id === bezug)?.nummer ?? "Rechnung";
                const ersetzt = (re.data ?? []).find((x) => x.korrektur_zu === r.id && x.nummer);
                const bezug = r.korrektur_zu
                  ? `${r.nummer ? "berichtigt" : "Korrektur zu"} ${nummerVon(r.korrektur_zu)}${r.korrektur_grund ? `: ${r.korrektur_grund}` : ""}`
                  : r.storno_zu
                    ? `Storno zu ${nummerVon(r.storno_zu)}`
                    : ersetzt
                      ? `ersetzt durch ${ersetzt.nummer}`
                      : "";
                return (
                  <li key={r.id}>
                    <Link href={`/admin/rechnungen/${r.id}`} className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-3 py-2 hover:bg-papier">
                      <span>
                        <span className="zahlen">{r.nummer ?? "Entwurf"}</span> <span className="text-grau">{datum(r.rechnungsdatum)}</span>
                        {bezug ? <span className="block text-xs text-grau">{bezug}</span> : null}
                      </span>
                      <span className="text-grau">{RECHNUNG_STATUS[r.status as keyof typeof RECHNUNG_STATUS]}</span>
                      <span className="zahlen text-right">{euro(r.summe_brutto_cent)}</span>
                    </Link>
                  </li>
                );
              })}
              {!re.data?.length && !alt.length ? <li className="py-2 text-grau">Keine Rechnungen.</li> : null}
            </ul>
            {alt.length ? (
              <>
                <h3 className={`mb-1 flex items-baseline justify-between gap-3 font-semibold ${re.data?.length ? "mt-6" : ""}`}>
                  <span>Frühere Rechnungen</span>
                  <span className="zahlen text-sm font-normal text-grau">{euro(fruehereSumme(alt))} gesamt</span>
                </h3>
                <FruehereRechnungen liste={alt} />
              </>
            ) : null}
          </Abschnitt>
          {kv.data?.length ? (
            <Abschnitt titel="Kostenvoranschläge">
              <ul className="divide-y divide-linie text-sm">
                {(kv.data as Pick<Kostenvoranschlag, "id" | "nummer" | "status" | "gueltig_bis" | "summe_brutto_cent" | "datum">[]).map((v) => (
                  <li key={v.id}>
                    <Link href={`/admin/kostenvoranschlaege/${v.id}`} className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-3 py-2 hover:bg-papier">
                      <span><span className="zahlen">{v.nummer ?? "Entwurf"}</span> <span className="text-grau">{datum(v.datum)}</span></span>
                      <span className="text-grau">{kvStatusText(v)}</span>
                      <span className="zahlen text-right">{euro(v.summe_brutto_cent)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Abschnitt>
          ) : null}
        </div>
      </div>
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
