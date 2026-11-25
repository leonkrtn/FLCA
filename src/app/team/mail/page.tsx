import { PostfachSeite } from "@/components/mail/seiten";

export const metadata = { title: "Mail" };

export default async function Seite({ searchParams }: { searchParams: Promise<{ postfach?: string; q?: string }> }) {
  return <PostfachSeite ort="team" suche={await searchParams} />;
}
