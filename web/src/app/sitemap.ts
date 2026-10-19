import type { MetadataRoute } from "next";
import { coicopSlug } from "@/lib/coicopPath";
import { divisionsSorted, meta, subdivisionsSorted } from "@/lib/data";
import { birthYears } from "@/lib/lifetime";
import { SITE_URL } from "@/lib/site";

const PAGES = ["/", "/contributors", "/basket", "/replay", "/stripes", "/lifetime", "/pound", "/food", "/methodology"];

// Every page the site builds, so crawlers find the long tail (a page per division, sub-division and birth year).
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date(meta.generatedAt);
  const paths = [
    ...PAGES,
    ...divisionsSorted().flatMap((d) => (d.coicop ? [`/division/${encodeURIComponent(d.coicop)}`] : [])),
    ...subdivisionsSorted().flatMap((s) => (s.coicop ? [`/subdivision/${coicopSlug(s.coicop)}`] : [])),
    ...birthYears().map((year) => `/lifetime/${year}`),
  ];
  return paths.map((path) => ({ url: `${SITE_URL}${path}`, lastModified }));
}
