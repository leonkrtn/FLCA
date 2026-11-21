import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { takt } from "@/lib/automatik";
import { ENV } from "@/lib/env";
import { db } from "@/lib/supabase/admin";

export const maxDuration = 60;

function erlaubt(request: Request): boolean {
  const gegeben = Buffer.from(request.headers.get("x-cron-secret") ?? request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "");
  const erwartet = Buffer.from(ENV.cronSecret);
  // Bytes vergleichen, nicht Zeichen: Bei Sonderzeichen wären die Längen sonst verschieden und
  // timingSafeEqual würfe einen Fehler (500 statt 401).
  if (!ENV.cronSecret || gegeben.length !== erwartet.length) return false;
  return timingSafeEqual(gegeben, erwartet);
}

/** Aufruf jede Minute aus Supabase (POST, x-cron-secret) und täglich aus Vercel Cron (GET, Bearer). */
async function ausfuehren(request: Request) {
  if (!erlaubt(request)) {
    // Ruft Supabase an, aber das Geheimnis passt nicht, soll die App das anzeigen können (TaktStatus).
    // Nur bei Aufrufen mit x-cron-secret, damit beliebige Besucher hier nichts schreiben.
    if (request.headers.has("x-cron-secret")) {
      await db().from("automatik_log").upsert({ art: "takt", bezug: "abgelehnt", erstellt_am: new Date().toISOString() }, { onConflict: "art,bezug" });
    }
    return new NextResponse("Nicht erlaubt", { status: 401 });
  }
  return NextResponse.json(await takt());
}

export const GET = ausfuehren;
export const POST = ausfuehren;
