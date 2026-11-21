import { notFound } from "next/navigation";
import { Formular, Senden } from "@/components/admin/formular";
import { NotizFormular, NotizKnoepfe } from "@/components/admin/notizen";
import { Abschnitt, Kopf } from "@/components/admin/ui";
import { notizLoeschen, notizSpeichern } from "@/lib/aktionen/notizen";
import { benutzerMitRecht } from "@/lib/auth";
import { datumZeit } from "@/lib/format";
import { notizLaden } from "@/lib/notizen";
import { notizBezug, notizTeam } from "@/lib/notizen-seiten";

export const metadata = { title: "Notiz" };

export default async function NotizSeite({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ kunde?: string; termin?: string }> }) {
  const b = await benutzerMitRecht("notizen");
  const [{ id }, such] = await Promise.all([params, searchParams]);
  const neu = id === "neu";
  const n = neu ? null : await notizLaden(b, id);
  if (!neu && !n) notFound();
  const [team, bezug] = await Promise.all([notizTeam(), notizBezug(n, such)]);
  return (
    <>
      <Kopf
        titel={neu ? "Neue Notiz" : n!.titel || "Notiz"}
        unter={n ? `Angelegt ${datumZeit(n.erstellt_am)}${n.autor?.name ? ` von ${n.autor.name}` : ""}${n.erledigt_am ? ` · erledigt ${datumZeit(n.erledigt_am)}` : ""}` : undefined}
        zurueck={{ href: "/admin/notizen", text: "Notizen" }}
      >
        {n ? (
          <Formular aktion={notizLoeschen.bind(null, "/admin/notizen", n.id)} bestaetigen="Notiz endgültig löschen?">
            <Senden art="rahmen" klein className="text-fehler">Löschen</Senden>
          </Formular>
        ) : null}
      </Kopf>
      {n ? (
        <div className="mb-6">
          <NotizKnoepfe n={n} />
        </div>
      ) : null}
      <Abschnitt>
        <NotizFormular aktion={notizSpeichern.bind(null, "/admin/notizen", n?.id ?? null)} notiz={n} team={team} bezug={bezug} />
      </Abschnitt>
    </>
  );
}
