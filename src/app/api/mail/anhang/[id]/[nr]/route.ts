import { notFound, redirect } from "next/navigation";
import { benutzerMitRecht } from "@/lib/auth";
import { anhangLink, zugang } from "@/lib/mail/postfach";

/** Anhang einer Mail: Prüft das Postfach und leitet auf einen Link weiter, der 60 Sekunden gilt. */
export async function GET(_: Request, { params }: { params: Promise<{ id: string; nr: string }> }) {
  const b = await benutzerMitRecht("werkstatt");
  const { id, nr } = await params;
  const link = /^[0-9a-f-]{36}$/.test(id) && /^\d+$/.test(nr) ? await anhangLink(await zugang(b), id, Number(nr)) : null;
  if (!link) notFound();
  redirect(link);
}
