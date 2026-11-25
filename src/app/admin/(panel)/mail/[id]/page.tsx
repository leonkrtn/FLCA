import { redirect } from "next/navigation";

/** Frühere Links auf eine einzelne Unterhaltung: am Rechner steht sie im Lesebereich des Postfachs. */
export default async function Seite({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/admin/mail?g=${encodeURIComponent(id)}`);
}
