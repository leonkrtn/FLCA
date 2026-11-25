import { PostfachSeite } from "@/components/mail/seiten";

export const metadata = { title: "Neue Mail" };

/** Postfach mit offenem Schreibfenster; `?an=…&betreff=…` füllt vor, `?p=ich` schreibt aus dem eigenen Postfach. */
export default async function Seite({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <PostfachSeite ort="team" sp={await searchParams} neu />;
}
