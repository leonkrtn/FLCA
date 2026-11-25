import { NeueMailSeite } from "@/components/mail/seiten";

export const metadata = { title: "Neue Mail" };

export default async function Seite({ searchParams }: { searchParams: Promise<{ postfach?: string; an?: string; betreff?: string }> }) {
  return <NeueMailSeite ort="team" suche={await searchParams} />;
}
