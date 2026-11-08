// Service Worker der beiden Web-Apps (/app und /team): nur Push-Nachrichten.
// Bewusst kein Offline-Cache: Termine und Rechnungen sollen nie aus einem veralteten Zwischenspeicher kommen.

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let n = { titel: "FLC Automotive", text: "", url: "/app" };
  try {
    n = { ...n, ...event.data.json() };
  } catch {}
  event.waitUntil(
    self.registration.showNotification(n.titel, {
      body: n.text,
      tag: n.tag,
      data: { url: n.url },
      icon: n.url.startsWith("/team") ? "/icons/team-192.png" : "/icons/app-192.png",
      badge: "/icons/app-192.png",
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const ziel = new URL(event.notification.data?.url || "/app", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((fenster) => {
      for (const f of fenster) {
        if ("focus" in f) {
          f.navigate(ziel);
          return f.focus();
        }
      }
      return self.clients.openWindow(ziel);
    }),
  );
});
