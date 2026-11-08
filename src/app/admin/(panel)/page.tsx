import Link from "next/link";
import { Abschnitt, Kopf, Leer, Marke } from "@/components/admin/ui";
import { benutzerMitRecht } from "@/lib/auth";
import { datumKurzText, datumLangText, euro, zeit } from "@/lib/format";
import { TERMIN_TON } from "@/lib/status";
import { db } from "@/lib/supabase/admin";
import { STATUS_TEXT, TERMIN_FELDER, type Termin } from "@/lib/termine";
import { berlin, berlinDatum, plusTage } from "@/lib/zeit";

export const metadata = { title: "Übersicht" };

export default async function Uebersicht() {
  const b = await benutzerMitRecht("termine");
  const heute = berlinDatum();
  const [heuteRes, anfragenRes, offenRes, abwRes, kalRes] = await Promise.all([
    db().from("termine").select(TERMIN_FELDER).in("status", ["bestaetigt", "erledigt", "angefragt"]).gte("beginn", berlin(heute).toISOString()).lt("beginn", berlin(plusTage(heute, 1)).toISOString()).order("beginn"),
    db().from("termine").select(TERMIN_FELDER).eq("status", "angefragt").order("beginn").limit(8),
    db().from("rechnungen").select("summe_brutto_cent, faellig_am").eq("status", "gestellt"),
    db().from("abwesenheiten").select("id, art, von, bis, status, profil:profile(name)").lte("von", heute).gte("bis", heute).neq("status", "abgelehnt"),
    db().from("kalender_verbindung").select("refresh_token, letzter_fehler").eq("id", 1).maybeSingle(),
  ]);
  const heuteTermine = (heuteRes.data ?? []) as Termin[];
  const anfragen = (anfragenRes.data ?? []) as Termin[];
  const offen = offenRes.data ?? [];
  const ueberfaellig = offen.filter((r) => r.faellig_am && r.faellig_am < heute);
  const abwesend = (abwRes.data ?? []) as unknown as { id: string; art: string; profil: { name: string } | null }[];

  return (
    <>
      <Kopf titel={`Hallo${b.name ? ` ${b.name.split(" ")[0]}` : ""}.`} unter={datumLangText(heute)} />
      {kalRes.data && !kalRes.data.refresh_token ? (
        <p className="mb-6 border-l-2 border-kreide bg-weiss px-4 py-3">
          Der Google-Kalender ist noch nicht verbunden. <Link href="/admin/einstellungen?bereich=kalender" className="font-semibold underline">Jetzt verbinden</Link>
        </p>
      ) : kalRes.data?.letzter_fehler ? (
        <p className="mb-6 border-l-2 border-rot bg-weiss px-4 py-3">{kalRes.data.letzter_fehler}</p>
      ) : null}
      <div className="grid gap-x-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div>
          <Abschnitt titel={`Heute in der Werkstatt (${heuteTermine.length})`} aktion={<Link href="/admin/kalender" className="text-sm underline">Woche ansehen</Link>}>
            {heuteTermine.length ? (
              <ul className="divide-y divide-linie">
                {heuteTermine.map((t) => (
                  <li key={t.id}>
                    <Link href={`/admin/termine/${t.id}`} className="grid grid-cols-[4.5rem_1fr_auto] items-center gap-4 py-3 hover:bg-papier">
                      <span className="zahlen text-lg">{zeit(t.beginn)}</span>
                      <span>
                        <span className="font-semibold">{t.leistung_name}</span>
                        <span className="block text-sm text-grau">
                          {[t.kunde?.name, t.fahrzeug?.kennzeichen, t.mitarbeiter?.name].filter(Boolean).join(" · ")}
                        </span>
                      </span>
                      <Marke ton={TERMIN_TON[t.status]}>{STATUS_TEXT[t.status]}</Marke>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <Leer>Heute stehen keine Termine an.</Leer>
            )}
          </Abschnitt>
          <Abschnitt titel="Offene Anfragen" aktion={<Link href="/admin/termine?ansicht=anfragen" className="text-sm underline">alle</Link>}>
            {anfragen.length ? (
              <ul className="divide-y divide-linie">
                {anfragen.map((t) => (
                  <li key={t.id}>
                    <Link href={`/admin/termine/${t.id}`} className="flex items-center justify-between gap-4 py-3 hover:bg-papier">
                      <span>
                        <span className="font-semibold">{t.kunde?.name}</span> <span className="text-grau">· {t.leistung_name}</span>
                      </span>
                      <span className="zahlen whitespace-nowrap text-sm">
                        {datumKurzText(t.beginn)} {zeit(t.beginn)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <Leer>Alles beantwortet.</Leer>
            )}
          </Abschnitt>
        </div>
        <div>
          <Abschnitt titel="Offene Rechnungen">
            <p className="zahlen text-3xl">{euro(offen.reduce((s, r) => s + Number(r.summe_brutto_cent), 0))}</p>
            <p className="text-sm text-grau">
              {offen.length} offen{ueberfaellig.length ? `, davon ${ueberfaellig.length} überfällig` : ""}
            </p>
            <Link href="/admin/rechnungen?status=gestellt" className="mt-3 inline-block text-sm underline">ansehen</Link>
          </Abschnitt>
          <Abschnitt titel="Heute nicht da">
            {abwesend.length ? (
              <ul className="space-y-1">
                {abwesend.map((a) => (
                  <li key={a.id}>
                    {a.profil?.name} <span className="text-grau">· {a.art === "krank" ? "krank" : a.art === "urlaub" ? "Urlaub" : "abwesend"}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-grau">Alle da.</p>
            )}
          </Abschnitt>
        </div>
      </div>
    </>
  );
}
