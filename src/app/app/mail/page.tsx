import { PostfachSeite } from "@/components/mail/seiten";

export const metadata = { title: "Mail" };

export default async function Seite({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <PostfachSeite ort="app" sp={await searchParams} />;
}
