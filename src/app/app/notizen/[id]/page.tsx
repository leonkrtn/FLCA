import { notFound } from "next/navigation";
import { Formular, Senden } from "@/components/admin/formular";
import { NotizFormular, NotizKnoepfe } from "@/components/admin/notizen";
import { Karte, MobilKopf } from "@/components/mobil/teile";
import { notizLoeschen, notizSpeichern } from "@/lib/aktionen/notizen";
import { benutzerMitRecht } from "@/lib/auth";
import { datumZeit } from "@/lib/format";
import { notizLaden } from "@/lib/notizen";
import { notizBezug, notizTeam } from "@/lib/notizen-seiten";
import { notizVorgabeAus } from "@/lib/sprache/vorgabe";

export const metadata = { title: "Notiz" };

export default async function AppNotiz({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ kunde?: string; termin?: string } & Record<string, string | string[] | undefined>> }) {
  const b = await benutzerMitRecht("notizen");
  const [{ id }, such] = await Promise.all([params, searchParams]);
  const neu = id === "neu";
  const n = neu ? null : await notizLaden(b, id);
  if (!neu && !n) notFound();
  const [team, bezug] = await Promise.all([notizTeam(), notizBezug(n, such)]);
  // Vom Sprechen: erkannte Angaben stehen in der Adresse
  const vorgabe = neu ? notizVorgabeAus(such) : null;
  return (
    <>
      <MobilKopf
        titel={neu ? "Neue Notiz" : n!.titel || "Notiz"}
        unter={n ? `${n.autor?.name ? `${n.autor.name} · ` : ""}${datumZeit(n.erstellt_am)}` : vorgabe ? "Aus der Sprachaufnahme, bitte prüfen" : "Optional mit Erinnerung per Push"}
        zurueck={vorgabe ? "/app/sprechen" : "/app/notizen"}
      />
      <div className="grid gap-2 p-2">
        {n ? (
          <Karte>
            <NotizKnoepfe n={n} gross />
          </Karte>
        ) : null}
        <Karte>
          <NotizFormular kompakt aktion={notizSpeichern.bind(null, "/app/notizen", n?.id ?? null)} notiz={n} team={team} bezug={bezug} vorgabe={vorgabe} />
        </Karte>
        {n ? (
          <Karte>
            <Formular aktion={notizLoeschen.bind(null, "/app/notizen", n.id)} bestaetigen="Notiz endgültig löschen?">
              <Senden art="rahmen" className="w-full text-fehler">Notiz löschen</Senden>
            </Formular>
          </Karte>
        ) : null}
      </div>
    </>
  );
}
