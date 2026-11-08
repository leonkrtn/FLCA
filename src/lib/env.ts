/**
 * Einzige Stelle, an der die App Umgebungsvariablen liest. Neue Variablen kommen hierher, nicht
 * verstreut in den Code. Welche Dienste aktiv sind, entscheidet sich an diesen Werten (siehe
 * src/lib/services), nicht an `if (process.env.X)` in Seiten und Aktionen.
 */
export const ENV = {
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabasePublishableKey:
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  supabaseSecretKey: process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  resendApiKey: process.env.RESEND_API_KEY ?? "",
  mailFrom: process.env.MAIL_FROM ?? "",
  googleClientId: process.env.GOOGLE_CLIENT_ID ?? "",
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
  vapidPublicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "",
  vapidPrivateKey: process.env.VAPID_PRIVATE_KEY ?? "",
  cronSecret: process.env.CRON_SECRET ?? "",
};

export const KONFIGURIERT = {
  supabase: Boolean(ENV.supabaseUrl && ENV.supabasePublishableKey),
  supabaseAdmin: Boolean(ENV.supabaseUrl && ENV.supabaseSecretKey),
  email: Boolean(ENV.resendApiKey && ENV.mailFrom),
  google: Boolean(ENV.googleClientId && ENV.googleClientSecret),
  push: Boolean(ENV.vapidPublicKey && ENV.vapidPrivateKey),
};
