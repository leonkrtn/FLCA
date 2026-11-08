import type { Metadata } from "next";
import { LoginKarte } from "./karte";
import { LoginFormular } from "./formulare";

export const metadata: Metadata = { title: "Anmelden", robots: { index: false } };

export default async function Login({ searchParams }: { searchParams: Promise<{ weiter?: string; fehler?: string }> }) {
  const { weiter = "", fehler } = await searchParams;
  return (
    <LoginKarte titel="Anmelden">
      <LoginFormular weiter={weiter} hinweis={fehler === "kein-zugriff" ? "Für diesen Bereich fehlt Ihnen die Berechtigung." : undefined} />
    </LoginKarte>
  );
}
