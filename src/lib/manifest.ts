/** Web-App-Manifest je Bereich. Eigenes Icon, eigener Name, eigene Startseite auf dem Home-Bildschirm. */
export function manifest(art: "app" | "team") {
  const app = art === "app";
  return Response.json(
    {
      name: app ? "FLC Werkstatt" : "FLC Team",
      short_name: app ? "Werkstatt" : "FLC Team",
      description: app ? "Termine, Anfragen und Rechnungen von FLC Automotive" : "Arbeitszeiten, Aufträge und Urlaub bei FLC Automotive",
      id: `/${art}`,
      start_url: `/${art}`,
      // Bereich ist die ganze Seite, nicht nur /app bzw. /team: Führt ein Link aus dem Bereich heraus
      // (Verwaltung, Login nach abgelaufener Sitzung, Push-Ziel unter /admin), blendet iOS sonst ein
      // Safari-Fenster mit Adressleiste und „Fertig“ ein, und man kommt nicht mehr in die App zurück.
      // Die beiden Apps bleiben über id und start_url getrennt.
      scope: "/",
      display: "standalone",
      orientation: "portrait",
      // Hell wie der Seitengrund und der Kopf der Apps, damit Statusleiste und Startbild nahtlos anschließen.
      background_color: "#ecebe7",
      theme_color: "#ecebe7",
      lang: "de",
      icons: [
        { src: `/icons/${art}-192.png`, sizes: "192x192", type: "image/png" },
        { src: `/icons/${art}-512.png`, sizes: "512x512", type: "image/png" },
        { src: `/icons/${art}-maskable.png`, sizes: "512x512", type: "image/png", purpose: "maskable" },
      ],
    },
    { headers: { "content-type": "application/manifest+json", "cache-control": "public, max-age=3600" } },
  );
}
