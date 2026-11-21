/** Abstand zweier Punkte auf der Erde in Metern (Haversine; auf ein paar Hundert Meter mehr als genau genug). */
export function abstandM(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const r = 6371000;
  const rad = (x: number) => (x * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * r * Math.asin(Math.min(1, Math.sqrt(h))));
}

/**
 * Ist das Handy vor Ort? Die Ungenauigkeit des Handys zählt bis 50 m zugunsten der Person (in der Halle ist GPS
 * oft schlechter), mehr nicht: Sonst käme man mit einer groben Ortung aus einem Kilometer Entfernung durch.
 */
export function vorOrt(abstand: number, genauigkeitM: number, radiusM: number): boolean {
  return abstand <= radiusM + Math.min(Math.max(genauigkeitM, 0), 50);
}

/** „350 m“ oder „2,4 km“ */
export function abstandText(m: number): string {
  return m < 1000 ? `${m} m` : `${(m / 1000).toFixed(1).replace(".", ",")} km`;
}
