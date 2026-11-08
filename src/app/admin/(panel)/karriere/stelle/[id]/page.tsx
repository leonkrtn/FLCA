import { notFound } from "next/navigation";
import { Formular, Senden } from "@/components/admin/formular";
import { Abschnitt, Feld, Kopf, Schalter, Textfeld } from "@/components/admin/ui";
import { stelleSpeichern } from "@/lib/aktionen/karriere";
import { benutzerMitRecht } from "@/lib/auth";
import { db } from "@/lib/supabase/admin";

export default async function Stelle({ params }: { params: Promise<{ id: string }> }) {
  await benutzerMitRecht("karriere");
  const { id } = await params;
  const neu = id === "neu";
  const { data: s } = neu ? { data: null } : await db().from("stellen").select("*").eq("id", id).maybeSingle();
  if (!neu && !s) notFound();
  return (
    <>
      <Kopf titel={neu ? "Neue Stelle" : s!.titel} zurueck={{ href: "/admin/karriere", text: "Karriere" }} />
      <Abschnitt>
        <Formular aktion={stelleSpeichern.bind(null, neu ? null : id)} className="grid gap-4 sm:grid-cols-2">
          <Feld label="Titel" name="titel" wert={s?.titel} placeholder="Kfz-Mechatroniker (m/w/d)" required />
          <Feld label="Umfang" name="umfang" wert={s?.umfang ?? "Vollzeit"} />
          <Textfeld label="Einleitung" name="einleitung" wert={s?.einleitung} zeilen={3} className="sm:col-span-2" />
          <Textfeld label="Aufgaben (eine pro Zeile)" name="aufgaben" wert={s?.aufgaben} />
          <Textfeld label="Was die Person mitbringt (eine pro Zeile)" name="profil" wert={s?.profil} />
          <Textfeld label="Was wir bieten (eine pro Zeile)" name="wir_bieten" wert={s?.wir_bieten} />
          <Feld label="Reihenfolge" name="sortierung" wert={s?.sortierung ?? 0} inputMode="numeric" />
          <Schalter label="Online" name="aktiv" an={s?.aktiv ?? true} hilfe="Auf der Website sichtbar und bewerbbar" />
          <div className="sm:col-span-2"><Senden vorab="Gespeichert">Speichern</Senden></div>
        </Formular>
      </Abschnitt>
    </>
  );
}
