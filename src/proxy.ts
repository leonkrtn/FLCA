import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/**
 * Erneuert die Anmeldung und schickt nicht angemeldete Besucher von /admin, /app und /team zum Login.
 * Die Rolle prüft jede Seite und jede Server Action selbst (src/lib/auth.ts); der Proxy ist nur die
 * erste Tür, nicht die einzige.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  if (!supabaseUrl || !supabaseKey) return response;

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
        for (const [key, value] of Object.entries(headers ?? {})) response.headers.set(key, value);
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const serverAktion = request.method === "POST" && request.headers.has("next-action");
  const pfad = request.nextUrl.pathname;
  // Manifest und Icons der Web-Apps müssen ohne Anmeldung ladbar sein, sonst bietet iOS kein App-Icon an.
  const offen = /\/manifest\.webmanifest$/.test(pfad);
  if (!data?.claims && !serverAktion && !offen) {
    const login = request.nextUrl.clone();
    login.pathname = "/login";
    login.search = `?weiter=${encodeURIComponent(pfad + request.nextUrl.search)}`;
    return NextResponse.redirect(login);
  }
  return response;
}

export const config = {
  matcher: ["/admin/:path*", "/app/:path*", "/team/:path*", "/app", "/team", "/admin"],
};
