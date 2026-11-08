import type { MetadataRoute } from "next";
import { ENV } from "@/lib/env";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/app", "/team", "/login", "/t/", "/r/", "/api/"] },
    sitemap: `${ENV.siteUrl}/sitemap.xml`,
  };
}
