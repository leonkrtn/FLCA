import { redirect } from "next/navigation";
import { GEMERKT_PFAD } from "@/components/admin/gemerkte-preise";

/** Alte Adresse (Lesezeichen): Die gemerkten Preise sind jetzt ein Reiter in den Einstellungen. */
export default async function GemerktePreiseAlt({ searchParams }: { searchParams: Promise<{ ansicht?: string; q?: string }> }) {
  const { ansicht, q } = await searchParams;
  redirect(`${GEMERKT_PFAD}${ansicht === "pakete" ? "&ansicht=pakete" : ""}${q ? `&q=${encodeURIComponent(q)}` : ""}`);
}
