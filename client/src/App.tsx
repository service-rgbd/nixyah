import { lazy, Suspense, useEffect } from "react";
import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAppSettings } from "@/lib/appSettings";
import { useTheme } from "next-themes";
import { clearSession, getProfileId, getSessionToken, getUserId, SESSION_SYNC_KEY, setSessionIds } from "@/lib/session";
import { apiGetJson } from "@/lib/queryClient";
import { SeoHead } from "@/components/seo-head";
import { loadAnalyticsIfConsented, trackPageView } from "@/lib/analytics";
import { buildAbsoluteUrl, getSiteUrl, keywordArchitecture, resolveStaticSeo } from "@shared/seo";
import { resolveThemePreference } from "@/lib/appSettings";

const Home = lazy(() => import("@/pages/home"));
const Loader = lazy(() => import("@/pages/loader"));
const Conditions = lazy(() => import("@/pages/conditions"));
const Privacy = lazy(() => import("@/pages/privacy"));
const Cookies = lazy(() => import("@/pages/cookies"));
const Start = lazy(() => import("@/pages/start"));
const Explore = lazy(() => import("@/pages/explore"));
const Vip = lazy(() => import("@/pages/vip"));
const EventsPage = lazy(() => import("@/pages/events"));
const EventsNewPage = lazy(() => import("@/pages/events-new"));
const EventDetailPage = lazy(() => import("@/pages/event-detail"));
const EventRegistrationsPage = lazy(() => import("@/pages/event-registrations"));
const ProfileDetail = lazy(() => import("@/pages/profile"));
const Signup = lazy(() => import("@/pages/signup"));
const Settings = lazy(() => import("@/pages/settings"));
const PostIntent = lazy(() => import("@/pages/post-intent"));
const AnnonceNew = lazy(() => import("@/pages/annonce-new"));
const AnnoncesPage = lazy(() => import("@/pages/annonces"));
const AdultProductsPage = lazy(() => import("@/pages/adult-products"));
const AdultProductDetailPage = lazy(() => import("@/pages/adult-product-detail"));
const AdminPage = lazy(() => import("@/pages/admin"));
const Dashboard = lazy(() => import("@/pages/dashboard"));
const StoriesNewPage = lazy(() => import("@/pages/stories-new"));
const Login = lazy(() => import("@/pages/login"));
const PasswordForgot = lazy(() => import("@/pages/password-forgot"));
const PasswordReset = lazy(() => import("@/pages/password-reset"));
const EmailVerify = lazy(() => import("@/pages/email-verify"));
const NotFound = lazy(() => import("@/pages/not-found"));

function buildDefaultStructuredData(pathname: string): Record<string, unknown>[] {
  const origin = typeof window !== "undefined" ? getSiteUrl(window.location.origin) : getSiteUrl();
  const canonicalUrl = buildAbsoluteUrl(pathname, origin);
  const keywordCluster = keywordArchitecture.find((item) => pathname === item.path);

  const websiteSchema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "NIXYAH",
    url: origin,
    inLanguage: "fr",
    description:
      "Marketplace adulte premium pour découvrir profils, résidences, salons privés, produits intimes et évènements en français.",
  };

  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "NIXYAH",
    url: origin,
    logo: buildAbsoluteUrl("/favicon.png", origin),
  };

  const collectionSchema = keywordCluster
    ? {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: keywordCluster.primaryKeyword,
        url: canonicalUrl,
        about: keywordCluster.secondaryKeywords,
      }
    : null;

  return [websiteSchema, organizationSchema, collectionSchema].filter(
    (
      item,
    ): item is
      | typeof websiteSchema
      | typeof organizationSchema
      | NonNullable<typeof collectionSchema> => item !== null,
  );
}

function RouteRuntime() {
  const [location] = useLocation();
  const seo = resolveStaticSeo(location);

  useEffect(() => {
    loadAnalyticsIfConsented();
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      trackPageView(location, document.title);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [location]);

  return (
    <>
      <SeoHead
        title={seo.title}
        description={seo.description}
        canonicalPath={seo.canonicalPath}
        keywords={seo.keywords}
        noindex={seo.noindex}
        type={seo.type}
        pathname={location}
        structuredData={buildDefaultStructuredData(location)}
      />
      <Suspense
        fallback={
          <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
            Chargement…
          </div>
        }
      >
        <Router />
      </Suspense>
    </>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/loader" component={Loader} />
      <Route path="/conditions" component={Conditions} />
      <Route path="/privacy" component={Privacy} />
      <Route path="/cookies" component={Cookies} />
      <Route path="/start" component={Start} />
      <Route path="/events" component={EventsPage} />
      <Route path="/events/new" component={EventsNewPage} />
      <Route path="/events/:id" component={EventDetailPage} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/dashboard/events/:id/registrations" component={EventRegistrationsPage} />
      <Route path="/stories/new" component={StoriesNewPage} />
      <Route path="/explore" component={Explore} />
      <Route path="/vip" component={Vip} />
      <Route path="/profile/:id" component={ProfileDetail} />
      <Route path="/signup" component={Signup} />
      <Route path="/login" component={Login} />
      <Route path="/password/forgot" component={PasswordForgot} />
      <Route path="/password/reset" component={PasswordReset} />
      <Route path="/email/verify" component={EmailVerify} />
      <Route path="/settings" component={Settings} />
      <Route path="/post-intent" component={PostIntent} />
      <Route path="/annonce/new" component={AnnonceNew} />
      <Route path="/annonces" component={AnnoncesPage} />
      <Route path="/adult-products" component={AdultProductsPage} />
      <Route path="/adult-products/:id" component={AdultProductDetailPage} />
      <Route path="/admin" component={AdminPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const [settings] = useAppSettings();
  const { setTheme } = useTheme();
  const effectiveTheme = resolveThemePreference(settings.theme);

  useEffect(() => {
    const applyThemePreference = () => {
      const nextTheme = resolveThemePreference(settings.theme);
      document.documentElement.classList.toggle("dark", nextTheme === "dark");
      document.documentElement.style.colorScheme = nextTheme;
      setTheme(nextTheme);
    };
    applyThemePreference();
    if (settings.theme !== "auto") return;

    const interval = window.setInterval(applyThemePreference, 60_000);
    return () => window.clearInterval(interval);
  }, [settings.theme, setTheme]);

  useEffect(() => {
    document.documentElement.dataset.themePreference = settings.theme;
  }, [effectiveTheme, settings.theme]);

  // Always reconcile local session ids with the server cookie to avoid stale identity leaks.
  useEffect(() => {
    const syncSessionFromServer = async () => {
      try {
        const json = await apiGetJson<{ userId: string | null; profileId: string | null; csrfToken?: string | null; sessionToken?: string | null }>(
          "/api/me",
        );
        const currentUserId = getUserId();
        const currentProfileId = getProfileId();
        const currentSessionToken = getSessionToken();
        if (json.userId && json.profileId) {
          if (
            currentUserId !== json.userId ||
            currentProfileId !== json.profileId ||
            currentSessionToken !== (json.sessionToken ?? null)
          ) {
            queryClient.clear();
            setSessionIds({ userId: json.userId, profileId: json.profileId }, json.csrfToken ?? null, json.sessionToken ?? null);
          }
        } else {
          if (currentSessionToken && currentUserId && currentProfileId) {
            // Keep the local session during refreshes if the edge briefly fails to
            // reattach the server session. Subsequent API calls still send the
            // signed fallback token and can recover transparently.
            return;
          }
          if (currentUserId || currentProfileId) {
            queryClient.clear();
            clearSession();
          } else {
            clearSession({ broadcast: false });
          }
        }
      } catch {
        // ignore network failures, but do not mutate local session
      }
    };

    void syncSessionFromServer();

    const handleFocus = () => {
      void syncSessionFromServer();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void syncSessionFromServer();
      }
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== SESSION_SYNC_KEY) return;
      const nextUserId = getUserId();
      const nextProfileId = getProfileId();
      const nextSessionToken = getSessionToken();
      queryClient.clear();
      if (nextUserId && nextProfileId) {
        setSessionIds({ userId: nextUserId, profileId: nextProfileId }, null, nextSessionToken, { broadcast: false });
      } else {
        clearSession({ broadcast: false });
      }
    };

    window.addEventListener("focus", handleFocus);
    window.addEventListener("storage", handleStorage);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("storage", handleStorage);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <RouteRuntime />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;