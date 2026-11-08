import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { takt } from "@/lib/automatik";
import { ENV } from "@/lib/env";

export const maxDuration = 60;

function erlaubt(request: Request): boolean {
  const gegeben = request.headers.get("x-cron-secret") ?? request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  if (!ENV.cronSecret || gegeben.length !== ENV.cronSecret.length) return false;
  return timingSafeEqual(Buffer.from(gegeben), Buffer.from(ENV.cronSecret));
}

/** Aufruf alle 10 Minuten aus Supabase (POST, x-cron-secret) und täglich aus Vercel Cron (GET, Bearer). */
async function ausfuehren(request: Request) {
  if (!erlaubt(request)) return new NextResponse("Nicht erlaubt", { status: 401 });
  return NextResponse.json(await takt());
}

export const GET = ausfuehren;
export const POST = ausfuehren;
