import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Home from "@/pages/home";
import Loader from "@/pages/loader";
import Conditions from "@/pages/conditions";
import Start from "@/pages/start";
import Explore from "@/pages/explore";
import ProfileDetail from "@/pages/profile";
import Signup from "@/pages/signup";
import Settings from "@/pages/settings";
import PostIntent from "@/pages/post-intent";
import AnnonceNew from "@/pages/annonce-new";
import AnnoncesPage from "@/pages/annonces";
import AdultProductsPage from "@/pages/adult-products";
import AdultProductDetailPage from "@/pages/adult-product-detail";
import AdminPage from "@/pages/admin";
import Dashboard from "@/pages/dashboard";
import Login from "@/pages/login";
import PasswordForgot from "@/pages/password-forgot";
import PasswordReset from "@/pages/password-reset";
import EmailVerify from "@/pages/email-verify";
import NotFound from "@/pages/not-found";
import { useEffect } from "react";
import { useAppSettings } from "@/lib/appSettings";
import { useTheme } from "next-themes";
import { getProfileId, setSessionIds } from "@/lib/session";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/loader" component={Loader} />
      <Route path="/conditions" component={Conditions} />
      <Route path="/start" component={Start} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/explore" component={Explore} />
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

  useEffect(() => {
    if (settings.theme) setTheme(settings.theme);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.theme]);

  // Restore local session ids from server session cookie (prevents "lost session" on refresh).
  useEffect(() => {
    const stored = getProfileId();
    if (stored) return;
    (async () => {
      try {
        const res = await fetch("/api/me", { credentials: "include" });
        if (!res.ok) return;
        const json = (await res.json()) as { userId: string | null; profileId: string | null };
        if (json.userId && json.profileId) {
          setSessionIds({ userId: json.userId, profileId: json.profileId });
        }
      } catch {
        // ignore
      }
    })();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;