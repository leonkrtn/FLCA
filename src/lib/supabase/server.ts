import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { ENV } from "../env";

/** Supabase-Client mit der Sitzung des Benutzers. Dient nur der Anmeldung, nicht dem Datenzugriff. */
export async function sitzung() {
  const cookieStore = await cookies();
  return createServerClient(ENV.supabaseUrl, ENV.supabasePublishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) cookieStore.set(name, value, options);
        } catch {
          // In Server Components lassen sich keine Cookies setzen; das übernimmt src/proxy.ts.
        }
      },
    },
  });
}
