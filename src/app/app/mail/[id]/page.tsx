import { MailLesenSeite } from "@/components/mail/seiten";

export const metadata = { title: "Mail" };

export default async function Seite({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <MailLesenSeite ort="app" id={(await params).id} sp={await searchParams} />;
}
