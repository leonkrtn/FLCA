import type { Instrumentation } from "next";

/**
 * Jeder Fehler, der auf dem Server bis nach oben durchfällt (Seite, Route, Server Action), kommt ins
 * Fehlerprotokoll (Einstellungen → Fehler). Die Fehlerseite zeigt denselben Fehlercode (digest), damit
 * sich ein gemeldeter Fehler dort wiederfinden lässt; im Browser steht im Betrieb nie die Meldung selbst.
 */
export const onRequestError: Instrumentation.onRequestError = async (fehler, anfrage, kontext) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { fehlerMelden } = await import("./lib/fehler");
  const digest = typeof fehler === "object" && fehler && "digest" in fehler ? String(fehler.digest) : undefined;
  const art = { render: "Seite", route: "Schnittstelle", action: "Aktion", proxy: "Proxy" }[kontext.routeType] ?? kontext.routeType;
  await fehlerMelden(fehler, `${art} ${kontext.routePath} (${anfrage.method} ${anfrage.path.split("?")[0]})`, digest);
};
