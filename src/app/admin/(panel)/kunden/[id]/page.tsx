import Link from "next/link";
import { notFound } from "next/navigation";
import { Formular, Senden } from "@/components/admin/formular";
import { Abschnitt, Feld, Kopf, Marke, Textfeld } from "@/components/admin/ui";
import { fahrzeugSpeichern, kundeSpeichern } from "@/lib/aktionen/kunden";
import { neueRechnung } from "@/lib/aktionen/rechnungen";
import { benutzerMitRecht } from "@/lib/auth";
import { datum, datumZeit, euro } from "@/lib/format";
import { RECHNUNG_STATUS } from "@/lib/rechnung/rechnungen";
import { TERMIN_TON } from "@/lib/status";
import { db } from "@/lib/supabase/admin";
import { STATUS_TEXT, type Termin } from "@/lib/termine";

export default async function KundeDetail({ params }: { params: Promise<{ id: string }> }) {
  await benutzerMitRecht("kunden");
  const { id } = await params;
  const { data: k } = await db().from("kunden").select("*").eq("id", id).maybeSingle();
  if (!k) notFound();
  const [fz, tm, re, ei] = await Promise.all([
    db().from("fahrzeuge").select("*").eq("kunde_id", id).order("erstellt_am"),
    db().from("termine").select("id, beginn, leistung_name, status, km_stand, fahrzeug:fahrzeuge(kennzeichen)").eq("kunde_id", id).order("beginn", { ascending: false }).limit(50),
    db().from("rechnungen").select("id, nummer, status, summe_brutto_cent, rechnungsdatum").eq("kunde_id", id).order("erstellt_am", { ascending: false }),
    db().from("einlagerungen").select("id, lagerplatz, saison, reifengroesse, eingelagert_am, ausgelagert_am, fahrzeug:fahrzeuge(kennzeichen)").eq("kunde_id", id).order("eingelagert_am", { ascending: false }),
  ]);
  const termine = (tm.data ?? []) as unknown as (Pick<Termin, "id" | "beginn" | "leistung_name" | "status" | "km_stand"> & { fahrzeug: { kennzeichen: string } | null })[];

  return (
    <>
      <Kopf titel={k.name} unter={`Kunde Nr. ${k.nummer}${k.firma ? ` · ${k.firma}` : ""}`} zurueck={{ href: "/admin/kunden", text: "Kunden" }}>
        <form action={neueRechnung.bind(null, k.id)}>
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
                  <summary className="cursor-pointer list-none">
                    <span className="zahlen font-semibold">{f.kennzeichen}</span> <span className="text-grau">{f.marke_modell}</span>
                    {f.km_stand ? <span className="zahlen ml-2 text-sm text-grau">{new Intl.NumberFormat("de-DE").format(f.km_stand)} km</span> : null}
                  </summary>
                  <FahrzeugFormular kundeId={k.id} f={f} />
                </details>
              ))}
              <details>
                <summary className="cursor-pointer font-semibold">+ Fahrzeug hinzufügen</summary>
                <FahrzeugFormular kundeId={k.id} />
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
        <Abschnitt titel="Termine">
          <ul className="divide-y divide-linie text-sm">
            {termine.map((t) => (
              <li key={t.id}>
                <Link href={`/admin/termine/${t.id}`} className="flex items-center justify-between gap-3 py-2 hover:bg-papier">
                  <span>
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
                <Link href={`/admin/rechnungen/${r.id}`} className="grid grid-cols-[1fr_auto_auto] gap-3 py-2 hover:bg-papier">
                  <span>{r.nummer ?? "Entwurf"} <span className="text-grau">{datum(r.rechnungsdatum)}</span></span>
                  <span className="text-grau">{RECHNUNG_STATUS[r.status as keyof typeof RECHNUNG_STATUS]}</span>
                  <span className="zahlen text-right">{euro(r.summe_brutto_cent)}</span>
                </Link>
              </li>
            ))}
            {!re.data?.length ? <li className="py-2 text-grau">Keine Rechnungen.</li> : null}
          </ul>
        </Abschnitt>
      </div>
    </>
  );
}

function FahrzeugFormular({ kundeId, f }: { kundeId: string; f?: Record<string, string | number | null> }) {
  return (
    <Formular aktion={fahrzeugSpeichern.bind(null, kundeId, (f?.id as string) ?? null)} className="mt-4 grid gap-3 sm:grid-cols-2">
      <Feld label="Kennzeichen" name="kennzeichen" wert={f?.kennzeichen} required />
      <Feld label="Marke / Modell" name="marke_modell" wert={f?.marke_modell} />
      <Feld label="HSN" name="hsn" wert={f?.hsn} />
      <Feld label="TSN" name="tsn" wert={f?.tsn} />
      <Feld label="FIN" name="fin" wert={f?.fin} />
      <Feld label="Reifengröße" name="reifengroesse" wert={f?.reifengroesse} placeholder="205/55 R16 91V" />
      <Feld label="Kilometerstand" name="km_stand" wert={f?.km_stand} inputMode="numeric" />
      <div className="self-end"><Senden className="w-full sm:w-auto" vorab="Gespeichert">Speichern</Senden></div>
    </Formular>
  );
}
