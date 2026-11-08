import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { benutzerMitRecht } from "@/lib/auth";
import { ENV } from "@/lib/env";
import { GOOGLE_REDIRECT, kalender } from "@/lib/services/kalender";
import { db } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  await benutzerMitRecht("einstellungen");
  const ziel = new URL("/admin/einstellungen?bereich=kalender", ENV.siteUrl);
  const p = request.nextUrl.searchParams;
  const state = (await cookies()).get("google_state")?.value;
  if (!p.get("code") || !state || state !== p.get("state")) {
    ziel.searchParams.set("fehler", p.get("error") ?? "abgebrochen");
    return NextResponse.redirect(ziel);
  }
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code: p.get("code")!, client_id: ENV.googleClientId, client_secret: ENV.googleClientSecret, redirect_uri: GOOGLE_REDIRECT(), grant_type: "authorization_code" }),
  });
  const json = (await res.json()) as { refresh_token?: string; id_token?: string };
  if (!json.refresh_token) {
    ziel.searchParams.set("fehler", "kein-refresh-token");
    return NextResponse.redirect(ziel);
  }
  let email = "";
  try {
    email = JSON.parse(Buffer.from(json.id_token!.split(".")[1], "base64url").toString()).email ?? "";
  } catch {}
  await db().from("kalender_verbindung").update({ refresh_token: json.refresh_token, konto_email: email, verbunden_am: new Date().toISOString(), letzter_fehler: "" }).eq("id", 1);
  try {
    await kalender().abgleichen();
    await kalender().beobachten(true);
  } catch (error) {
    console.error(error);
  }
  ziel.searchParams.set("verbunden", "1");
  return NextResponse.redirect(ziel);
}
