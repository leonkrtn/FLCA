import type { EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { sitzung } from "@/lib/supabase/server";

/**
 * Ziel der Links aus Einladungs- und Passwort-Mails. In Supabase unter Authentication → Email Templates
 * den Link auf {{ .SiteURL }}/auth/bestaetigen?token_hash={{ .TokenHash }}&type=invite (bzw. recovery) setzen.
 */
export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const typ = request.nextUrl.searchParams.get("type") as EmailOtpType | null;
  const ziel = request.nextUrl.clone();
  ziel.search = "";
  if (tokenHash && typ) {
    const { error } = await (await sitzung()).auth.verifyOtp({ type: typ, token_hash: tokenHash });
    if (!error) {
      ziel.pathname = "/login/passwort-setzen";
      return NextResponse.redirect(ziel);
    }
  }
  ziel.pathname = "/login/passwort-vergessen";
  return NextResponse.redirect(ziel);
}
