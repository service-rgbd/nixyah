const SITE_NAME = "NIXYAH";
const DEFAULT_SITE_URL = "https://www.nixyah.com";
const DEFAULT_IMAGE_PATH = "/favicon.png";
const TWITTER_HANDLE = "@nixyah";

export type StaticSeoRoute = {
  title: string;
  description: string;
  canonicalPath: string;
  keywords: string[];
  noindex?: boolean;
  type?: "website" | "article" | "profile" | "product";
};

type RouteRule = {
  kind: "exact" | "prefix";
  path: string;
  seo: StaticSeoRoute;
};

const routeRules: RouteRule[] = [
  {
    kind: "exact",
    path: "/",
    seo: {
      title: "Marketplace adulte premium francophone",
      description:
        "Marketplace adulte premium pour découvrir profils, résidences, salons privés, produits intimes et évènements en français.",
      canonicalPath: "/",
      keywords: [
        "marketplace adulte premium",
        "annonces adultes francophones",
        "profils adultes premium",
        "plateforme adulte francophone",
      ],
      type: "website",
    },
  },
  {
    kind: "exact",
    path: "/start",
    seo: {
      title: "Annonces adultes, profils et services premium",
      description:
        "Explore annonces adultes, profils vérifiés, résidences, salons privés, produits intimes et évènements pour une audience francophone.",
      canonicalPath: "/start",
      keywords: [
        "annonces adultes premium",
        "profils adultes vérifiés",
        "services adultes francophones",
        "marketplace adulte internationale",
      ],
      type: "website",
    },
  },
  {
    kind: "exact",
    path: "/explore",
    seo: {
      title: "Profils adultes à découvrir",
      description:
        "Parcours des profils adultes, résidences et salons privés avec filtres par ville, disponibilité et type d’offre.",
      canonicalPath: "/explore",
      keywords: [
        "profils adultes",
        "annonces escortes francophones",
        "résidences meublées adultes",
        "salons privés premium",
      ],
      type: "website",
    },
  },
  {
    kind: "exact",
    path: "/annonces",
    seo: {
      title: "Annonces adultes récentes",
      description:
        "Consulte les dernières annonces adultes, disponibilités et mises en avant publiées sur NIXYAH.",
      canonicalPath: "/annonces",
      keywords: [
        "annonces adultes récentes",
        "annonces premium francophones",
        "annonces escortes",
        "annonces résidences adultes",
      ],
      type: "website",
    },
  },
  {
    kind: "exact",
    path: "/vip",
    seo: {
      title: "Sélection VIP adultes",
      description:
        "Découvre une sélection VIP de profils, expériences privées et annonces premium pour un public adulte francophone.",
      canonicalPath: "/vip",
      keywords: [
        "profils vip adultes",
        "annonces adultes premium",
        "expériences privées vip",
        "sélection adulte premium",
      ],
      type: "website",
    },
  },
  {
    kind: "exact",
    path: "/events",
    seo: {
      title: "Évènements privés et soirées premium",
      description:
        "Retrouve les évènements privés, soirées premium et rencontres sélectionnées proposés sur NIXYAH.",
      canonicalPath: "/events",
      keywords: [
        "évènements privés adultes",
        "soirées premium francophones",
        "rencontres privées adultes",
        "agenda évènements adultes",
      ],
      type: "website",
    },
  },
  {
    kind: "exact",
    path: "/adult-products",
    seo: {
      title: "Boutique intime et produits adultes",
      description:
        "Achète des produits intimes, accessoires adultes, lubrifiants et articles bien-être sélectionnés sur NIXYAH.",
      canonicalPath: "/adult-products",
      keywords: [
        "boutique adulte premium",
        "produits intimes",
        "accessoires adultes",
        "bien-être intime francophone",
      ],
      type: "website",
    },
  },
  {
    kind: "prefix",
    path: "/adult-products/",
    seo: {
      title: "Produit intime premium",
      description:
        "Découvre les détails d’un produit intime premium, ses caractéristiques, son prix et ses options de commande.",
      canonicalPath: "/adult-products",
      keywords: [
        "produit intime premium",
        "détail produit adulte",
        "achat accessoire intime",
        "fiche produit adulte",
      ],
      type: "product",
    },
  },
  {
    kind: "prefix",
    path: "/profile/",
    seo: {
      title: "Profil adulte premium",
      description:
        "Consulte le détail d’un profil adulte, ses disponibilités, ses services et ses informations de contact.",
      canonicalPath: "/explore",
      keywords: [
        "profil adulte premium",
        "fiche profil adulte",
        "services adultes privés",
        "profil vérifié francophone",
      ],
      type: "profile",
    },
  },
  {
    kind: "exact",
    path: "/conditions",
    seo: {
      title: "Conditions d'utilisation",
      description:
        "Lis les conditions d’utilisation de NIXYAH, le rôle de la plateforme et les responsabilités des utilisateurs.",
      canonicalPath: "/conditions",
      keywords: [
        "conditions d'utilisation nixyah",
        "mentions légales plateforme adulte",
        "règles utilisation marketplace adulte",
      ],
      type: "article",
    },
  },
  {
    kind: "exact",
    path: "/privacy",
    seo: {
      title: "Politique de confidentialité",
      description:
        "Comprends comment NIXYAH traite les données de compte, les contenus publiés, la sécurité et les paiements.",
      canonicalPath: "/privacy",
      keywords: [
        "politique confidentialité nixyah",
        "données personnelles plateforme adulte",
        "confidentialité marketplace adulte",
      ],
      type: "article",
    },
  },
  {
    kind: "exact",
    path: "/cookies",
    seo: {
      title: "Cookies et stockage local",
      description:
        "Découvre comment NIXYAH utilise cookies techniques, session et stockage local pour sécuriser et fluidifier l’expérience.",
      canonicalPath: "/cookies",
      keywords: [
        "cookies nixyah",
        "stockage local session",
        "cookies techniques plateforme adulte",
      ],
      type: "article",
    },
  },
  {
    kind: "exact",
    path: "/loader",
    seo: {
      title: "Chargement",
      description: "Chargement de l’application.",
      canonicalPath: "/loader",
      keywords: [],
      noindex: true,
    },
  },
  {
    kind: "prefix",
    path: "/dashboard",
    seo: {
      title: "Espace utilisateur",
      description: "Espace privé utilisateur.",
      canonicalPath: "/dashboard",
      keywords: [],
      noindex: true,
    },
  },
  {
    kind: "exact",
    path: "/stories/new",
    seo: {
      title: "Publier une story",
      description: "Publication privée.",
      canonicalPath: "/stories/new",
      keywords: [],
      noindex: true,
    },
  },
  {
    kind: "exact",
    path: "/signup",
    seo: {
      title: "Créer un compte",
      description: "Création de compte NIXYAH.",
      canonicalPath: "/signup",
      keywords: [],
      noindex: true,
    },
  },
  {
    kind: "exact",
    path: "/login",
    seo: {
      title: "Connexion",
      description: "Connexion au compte NIXYAH.",
      canonicalPath: "/login",
      keywords: [],
      noindex: true,
    },
  },
  {
    kind: "prefix",
    path: "/password/",
    seo: {
      title: "Accès compte",
      description: "Gestion d’accès au compte.",
      canonicalPath: "/login",
      keywords: [],
      noindex: true,
    },
  },
  {
    kind: "exact",
    path: "/email/verify",
    seo: {
      title: "Validation email",
      description: "Validation d’adresse email.",
      canonicalPath: "/email/verify",
      keywords: [],
      noindex: true,
    },
  },
  {
    kind: "exact",
    path: "/settings",
    seo: {
      title: "Paramètres",
      description: "Paramètres du compte.",
      canonicalPath: "/settings",
      keywords: [],
      noindex: true,
    },
  },
  {
    kind: "exact",
    path: "/post-intent",
    seo: {
      title: "Choix de publication",
      description: "Choix de publication utilisateur.",
      canonicalPath: "/post-intent",
      keywords: [],
      noindex: true,
    },
  },
  {
    kind: "exact",
    path: "/annonce/new",
    seo: {
      title: "Nouvelle annonce",
      description: "Création d’annonce privée.",
      canonicalPath: "/annonce/new",
      keywords: [],
      noindex: true,
    },
  },
  {
    kind: "exact",
    path: "/admin",
    seo: {
      title: "Administration",
      description: "Administration privée.",
      canonicalPath: "/admin",
      keywords: [],
      noindex: true,
    },
  },
];

const fallbackSeo: StaticSeoRoute = {
  title: "Marketplace adulte premium francophone",
  description:
    "NIXYAH réunit profils, annonces, résidences, salons privés, produits intimes et évènements pour une audience adulte francophone.",
  canonicalPath: "/",
  keywords: [
    "marketplace adulte francophone",
    "annonces adultes premium",
    "profils adultes",
    "produits intimes premium",
  ],
  type: "website",
};

export function getSiteUrl(origin?: string | null): string {
  const base = String(origin || DEFAULT_SITE_URL).trim();
  if (!base) return DEFAULT_SITE_URL;
  return base.replace(/\/+$/, "");
}

export function buildAbsoluteUrl(pathOrUrl: string, origin?: string | null): string {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  const base = getSiteUrl(origin);
  const path = pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`;
  return `${base}${path}`;
}

export function resolveStaticSeo(pathname: string): StaticSeoRoute {
  const normalizedPath = normalizePath(pathname);
  for (const rule of routeRules) {
    if (rule.kind === "exact" && normalizedPath === rule.path) return rule.seo;
    if (rule.kind === "prefix" && normalizedPath.startsWith(rule.path)) return rule.seo;
  }
  return fallbackSeo;
}

export function isNoIndexPath(pathname: string): boolean {
  return Boolean(resolveStaticSeo(pathname).noindex);
}

export function formatSeoTitle(title: string): string {
  const trimmed = String(title || "").trim();
  if (!trimmed) return SITE_NAME;
  if (trimmed.includes(SITE_NAME)) return trimmed;
  return `${trimmed} | ${SITE_NAME}`;
}

export function getDefaultSeoImage(origin?: string | null): string {
  return buildAbsoluteUrl(DEFAULT_IMAGE_PATH, origin);
}

export function injectSeoIntoHtml(html: string, pathname: string, origin?: string | null): string {
  const seo = resolveStaticSeo(pathname);
  const title = formatSeoTitle(seo.title);
  const description = seo.description;
  const canonicalUrl = buildAbsoluteUrl(seo.canonicalPath, origin);
  const imageUrl = getDefaultSeoImage(origin);
  const robots = seo.noindex ? "noindex, nofollow, noarchive" : "index, follow, max-image-preview:large";
  const keywords = seo.keywords.join(", ");
  const type = seo.type === "article" ? "article" : "website";

  return html
    .replace(/<title>.*?<\\/title>/i, `<title>${escapeHtml(title)}</title>`)
    .replace(/<meta\\s+name="description"\\s+content="[^"]*"\\s*\\/?>/i, `<meta name="description" content="${escapeHtml(description)}" />`)
    .replace(/<meta\\s+name="robots"\\s+content="[^"]*"\\s*\\/?>/i, `<meta name="robots" content="${escapeHtml(robots)}" />`)
    .replace(/<meta\\s+name="keywords"\\s+content="[^"]*"\\s*\\/?>/i, `<meta name="keywords" content="${escapeHtml(keywords)}" />`)
    .replace(/<link\\s+rel="canonical"\\s+href="[^"]*"\\s*\\/?>/i, `<link rel="canonical" href="${escapeHtml(canonicalUrl)}" />`)
    .replace(/<meta\\s+property="og:title"\\s+content="[^"]*"\\s*\\/?>/i, `<meta property="og:title" content="${escapeHtml(title)}" />`)
    .replace(/<meta\\s+property="og:description"\\s+content="[^"]*"\\s*\\/?>/i, `<meta property="og:description" content="${escapeHtml(description)}" />`)
    .replace(/<meta\\s+property="og:type"\\s+content="[^"]*"\\s*\\/?>/i, `<meta property="og:type" content="${escapeHtml(type)}" />`)
    .replace(/<meta\\s+property="og:url"\\s+content="[^"]*"\\s*\\/?>/i, `<meta property="og:url" content="${escapeHtml(canonicalUrl)}" />`)
    .replace(/<meta\\s+property="og:image"\\s+content="[^"]*"\\s*\\/?>/i, `<meta property="og:image" content="${escapeHtml(imageUrl)}" />`)
    .replace(/<meta\\s+name="twitter:title"\\s+content="[^"]*"\\s*\\/?>/i, `<meta name="twitter:title" content="${escapeHtml(title)}" />`)
    .replace(/<meta\\s+name="twitter:description"\\s+content="[^"]*"\\s*\\/?>/i, `<meta name="twitter:description" content="${escapeHtml(description)}" />`)
    .replace(/<meta\\s+name="twitter:image"\\s+content="[^"]*"\\s*\\/?>/i, `<meta name="twitter:image" content="${escapeHtml(imageUrl)}" />`)
    .replace(/<meta\\s+name="twitter:site"\\s+content="[^"]*"\\s*\\/?>/i, `<meta name="twitter:site" content="${escapeHtml(TWITTER_HANDLE)}" />`);
}

export type KeywordCluster = {
  path: string;
  intent: "transactional" | "informational" | "navigational";
  primaryKeyword: string;
  secondaryKeywords: string[];
  internalLinksTo: string[];
};

export const keywordArchitecture: KeywordCluster[] = [
  {
    path: "/start",
    intent: "transactional",
    primaryKeyword: "annonces adultes premium",
    secondaryKeywords: [
      "marketplace adulte francophone",
      "profils adultes vérifiés",
      "services adultes premium",
      "annonces privées francophones",
    ],
    internalLinksTo: ["/explore", "/annonces", "/vip", "/events", "/adult-products"],
  },
  {
    path: "/explore",
    intent: "transactional",
    primaryKeyword: "profils adultes francophones",
    secondaryKeywords: [
      "profils escortes premium",
      "résidences meublées adultes",
      "salons privés premium",
      "profils vérifiés adultes",
    ],
    internalLinksTo: ["/annonces", "/vip", "/start"],
  },
  {
    path: "/annonces",
    intent: "transactional",
    primaryKeyword: "annonces adultes récentes",
    secondaryKeywords: [
      "annonces escortes francophones",
      "annonces résidences privées",
      "annonces salons premium",
      "annonces disponibles adultes",
    ],
    internalLinksTo: ["/explore", "/vip", "/start"],
  },
  {
    path: "/vip",
    intent: "transactional",
    primaryKeyword: "profils vip adultes",
    secondaryKeywords: [
      "sélection vip premium",
      "annonces adultes haut de gamme",
      "expériences privées premium",
      "profils premium francophones",
    ],
    internalLinksTo: ["/explore", "/annonces", "/start"],
  },
  {
    path: "/adult-products",
    intent: "transactional",
    primaryKeyword: "boutique adulte premium",
    secondaryKeywords: [
      "produits intimes premium",
      "accessoires adultes",
      "achat produits adultes francophones",
      "bien-être intime adulte",
    ],
    internalLinksTo: ["/start", "/events"],
  },
  {
    path: "/events",
    intent: "informational",
    primaryKeyword: "évènements privés adultes",
    secondaryKeywords: [
      "soirées premium francophones",
      "agenda évènements privés",
      "rencontres sélectionnées",
      "soirées adultes premium",
    ],
    internalLinksTo: ["/start", "/vip", "/explore"],
  },
];

function normalizePath(pathname: string): string {
  const raw = String(pathname || "/").trim();
  if (!raw) return "/";
  const normalized = raw.startsWith("/") ? raw : `/${raw}`;
  return normalized.length > 1 ? normalized.replace(/\/+$/, "") : normalized;
}

function escapeHtml(value: string): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
