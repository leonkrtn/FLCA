import type { NextConfig } from "next";

const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin : "";
const entwicklung = process.env.NODE_ENV === "development";

/**
 * Content-Security-Policy für alle Seiten. Supabase steht in connect-src, weil Uploads (Lebenslauf,
 * Bilder, Fotos) direkt aus dem Browser in den Speicher gehen.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${entwicklung ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${supabase}`.trim(),
  `media-src 'self' blob: ${supabase}`.trim(),
  "font-src 'self'",
  `connect-src 'self' ${supabase}`.trim(),
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Node-Pakete, die nicht gebündelt werden sollen (native Abhängigkeiten, große Schriftverarbeitung)
  serverExternalPackages: ["web-push", "@react-pdf/renderer"],
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: supabase ? [new URL(`${supabase}/storage/v1/object/public/website/**`)] : [],
  },
  // Schriften und Logo für die Rechnungs-PDFs werden zur Laufzeit vom Dateisystem gelesen.
  outputFileTracingIncludes: {
    "/**": ["./src/fonts/*.ttf", "./src/assets/logo-schwarz.png"],
  },
  // „Artikel“ heißt jetzt „Angebot“. Alte Lesezeichen landen weiter auf der richtigen Seite.
  async redirects() {
    return [
      { source: "/admin/artikel", destination: "/admin/angebot", permanent: true },
      // Leistungen und Preise standen früher unter Website, jetzt im Angebot.
      { source: "/admin/website/leistung/:id", destination: "/admin/angebot/:id", permanent: true },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), browsing-topics=()" },
        ],
      },
      { source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache" }, { key: "Service-Worker-Allowed", value: "/" }] },
    ];
  },
};

export default nextConfig;
