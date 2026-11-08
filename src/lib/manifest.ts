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
      scope: `/${art}`,
      display: "standalone",
      orientation: "portrait",
      background_color: app ? "#1f1e1c" : "#ecebe7",
      theme_color: app ? "#1f1e1c" : "#ecebe7",
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
