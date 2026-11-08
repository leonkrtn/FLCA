import type { MetadataRoute } from "next";
import { ENV } from "@/lib/env";
import { oeffentlicheLeistungen, stellen } from "@/lib/inhalte";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [l, s] = await Promise.all([oeffentlicheLeistungen(), stellen()]);
  const url = (p: string) => `${ENV.siteUrl}${p}`;
  return [
    { url: url("/"), priority: 1 },
    { url: url("/termin"), priority: 0.9 },
    { url: url("/leistungen"), priority: 0.8 },
    ...l.map((x) => ({ url: url(`/leistungen/${x.slug}`), priority: 0.7 })),
    { url: url("/galerie"), priority: 0.5 },
    { url: url("/karriere"), priority: 0.5 },
    ...s.map((x) => ({ url: url(`/karriere/${x.id}`), priority: 0.4 })),
    { url: url("/impressum"), priority: 0.1 },
    { url: url("/datenschutz"), priority: 0.1 },
    { url: url("/agb"), priority: 0.1 },
  ];
}
