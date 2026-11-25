import { GespraechSeite } from "@/components/mail/seiten";

export const metadata = { title: "Mail" };

export default async function Seite({ params }: { params: Promise<{ id: string }> }) {
  return <GespraechSeite ort="team" id={(await params).id} />;
}
