import { useEffect } from "react";
import {
  buildAbsoluteUrl,
  formatSeoTitle,
  getDefaultSeoImage,
  getSiteUrl,
  type StaticSeoRoute,
} from "@shared/seo";

type JsonLdValue = Record<string, unknown> | Array<Record<string, unknown>>;

type SeoHeadProps = Partial<StaticSeoRoute> & {
  image?: string;
  pathname?: string;
  structuredData?: JsonLdValue | null;
};

function sanitizeStructuredData(payload: JsonLdValue): JsonLdValue | null {
  const items = Array.isArray(payload) ? payload : [payload];
  const sanitized = items.filter((item): item is Record<string, unknown> => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return false;
    const context = item["@context"];
    if (typeof context === "string") {
      return context.trim().length > 0;
    }
    if (Array.isArray(context)) {
      return context.some((value) => typeof value === "string" && value.trim().length > 0);
    }
    return false;
  });
  if (!sanitized.length) return null;
  return Array.isArray(payload) ? sanitized : sanitized[0];
}

function ensureMeta(selector: string, attrs: Record<string, string>, content: string) {
  let node = document.head.querySelector(selector) as HTMLMetaElement | null;
  if (!node) {
    node = document.createElement("meta");
    Object.entries(attrs).forEach(([key, value]) => node?.setAttribute(key, value));
    document.head.appendChild(node);
  }
  node.setAttribute("content", content);
}

function ensureLink(selector: string, rel: string, href: string) {
  let node = document.head.querySelector(selector) as HTMLLinkElement | null;
  if (!node) {
    node = document.createElement("link");
    node.setAttribute("rel", rel);
    document.head.appendChild(node);
  }
  node.setAttribute("href", href);
}

function upsertStructuredData(id: string, payload: JsonLdValue | null | undefined) {
  const existing = document.head.querySelector(`script[data-seo-jsonld="${id}"]`) as HTMLScriptElement | null;
  const safePayload = payload ? sanitizeStructuredData(payload) : null;
  if (!safePayload) {
    existing?.remove();
    return;
  }

  const script = existing ?? document.createElement("script");
  script.type = "application/ld+json";
  script.dataset.seoJsonld = id;
  script.textContent = JSON.stringify(safePayload);
  if (!existing) {
    document.head.appendChild(script);
  }
}

export function buildBreadcrumbJsonLd(items: Array<{ name: string; path: string }>, origin?: string | null) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: buildAbsoluteUrl(item.path, origin),
    })),
  };
}

export function SeoHead({
  title,
  description,
  canonicalPath,
  keywords,
  noindex,
  type,
  image,
  pathname,
  structuredData,
}: SeoHeadProps) {
  useEffect(() => {
    const currentPath = pathname || `${window.location.pathname}${window.location.search}`;
    const siteUrl = getSiteUrl(window.location.origin || undefined);
    const canonicalUrl = buildAbsoluteUrl(canonicalPath || currentPath || "/", siteUrl);
    const imageUrl = image ? buildAbsoluteUrl(image, siteUrl) : getDefaultSeoImage(siteUrl);
    const finalTitle = formatSeoTitle(title || "NIXYAH");
    const finalDescription =
      description ||
      "Marketplace adulte premium pour découvrir profils, résidences, salons privés, produits intimes et évènements en français.";
    const robots = noindex ? "noindex, nofollow, noarchive" : "index, follow, max-image-preview:large";
    const finalType = type === "article" ? "article" : "website";

    document.title = finalTitle;
    document.documentElement.lang = "fr";

    ensureMeta('meta[name="description"]', { name: "description" }, finalDescription);
    ensureMeta('meta[name="robots"]', { name: "robots" }, robots);
    ensureMeta('meta[name="keywords"]', { name: "keywords" }, (keywords ?? []).join(", "));
    ensureMeta('meta[property="og:title"]', { property: "og:title" }, finalTitle);
    ensureMeta('meta[property="og:description"]', { property: "og:description" }, finalDescription);
    ensureMeta('meta[property="og:type"]', { property: "og:type" }, finalType);
    ensureMeta('meta[property="og:url"]', { property: "og:url" }, canonicalUrl);
    ensureMeta('meta[property="og:image"]', { property: "og:image" }, imageUrl);
    ensureMeta('meta[name="twitter:card"]', { name: "twitter:card" }, "summary_large_image");
    ensureMeta('meta[name="twitter:site"]', { name: "twitter:site" }, "@nixyah");
    ensureMeta('meta[name="twitter:title"]', { name: "twitter:title" }, finalTitle);
    ensureMeta('meta[name="twitter:description"]', { name: "twitter:description" }, finalDescription);
    ensureMeta('meta[name="twitter:image"]', { name: "twitter:image" }, imageUrl);
    ensureLink('link[rel="canonical"]', "canonical", canonicalUrl);

    upsertStructuredData("page", structuredData);
  }, [canonicalPath, description, image, keywords, noindex, pathname, structuredData, title, type]);

  return null;
}

