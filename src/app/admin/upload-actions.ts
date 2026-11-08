"use server";

import { randomUUID } from "node:crypto";
import { benutzerMitRecht } from "@/lib/auth";
import { db } from "@/lib/supabase/admin";

const ENDUNGEN: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
  "image/heic": "heic",
  "video/mp4": "mp4",
  "video/webm": "webm",
};

/**
 * Signierte Upload-Adresse: Bilder und Videos gehen direkt vom Browser in den Speicher, nicht durch die
 * Server-Funktion (Vercel begrenzt deren Anfragen auf 4,5 MB, ein Startseiten-Video ist größer).
 */
export async function uploadAdresse(
  bucket: "website" | "auftragsfotos",
  ordner: string,
  typ: string,
): Promise<{ ok: true; pfad: string; url: string } | { ok: false; meldung: string }> {
  await benutzerMitRecht(bucket === "website" ? "website" : "werkstatt");
  if (!ENDUNGEN[typ] || (bucket === "auftragsfotos" && typ.startsWith("video/"))) return { ok: false, meldung: "Dieses Dateiformat geht nicht." };
  const sauber = ordner.replace(/[^a-z0-9-]/gi, "").slice(0, 40) || "allgemein";
  const pfad = `${sauber}/${randomUUID()}.${ENDUNGEN[typ]}`;
  const { data, error } = await db().storage.from(bucket).createSignedUploadUrl(pfad);
  if (error || !data) return { ok: false, meldung: "Upload konnte nicht vorbereitet werden." };
  return { ok: true, pfad, url: data.signedUrl };
}
