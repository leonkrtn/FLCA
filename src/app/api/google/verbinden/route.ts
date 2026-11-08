import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { benutzerMitRecht } from "@/lib/auth";
import { ENV, KONFIGURIERT } from "@/lib/env";
import { GOOGLE_REDIRECT, GOOGLE_SCOPES } from "@/lib/services/kalender";

/** Startet die Google-Anmeldung. access_type=offline + prompt=consent, sonst gibt Google keinen Refresh-Token. */
export async function GET() {
  await benutzerMitRecht("einstellungen");
  if (!KONFIGURIERT.google) return new NextResponse("GOOGLE_CLIENT_ID und GOOGLE_CLIENT_SECRET fehlen.", { status: 500 });
  const state = randomBytes(16).toString("hex");
  (await cookies()).set("google_state", state, { httpOnly: true, secure: true, sameSite: "lax", maxAge: 600, path: "/api/google" });
  const q = new URLSearchParams({
    client_id: ENV.googleClientId,
    redirect_uri: GOOGLE_REDIRECT(),
    response_type: "code",
    scope: GOOGLE_SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${q}`);
}
