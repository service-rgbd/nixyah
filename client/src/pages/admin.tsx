import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Crown, Users, Megaphone, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { useI18n } from "@/lib/i18n";
import { apiRequest } from "@/lib/queryClient";

type AdminUser = {
  id: string;
  username: string;
  email: string | null;
  createdAt: string;
};

type AdminProfile = {
  id: string;
  pseudo: string;
  ville: string;
  isPro: boolean;
  visible: boolean;
  isVip: boolean;
  createdAt: string;
};

type AdminAnnonce = {
  id: string;
  title: string;
  active: boolean;
  createdAt: string;
  profileId: string;
  pseudo: string;
};

export default function AdminPage() {
  const [, setLocation] = useLocation();
  const { lang } = useI18n();
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/admin/me", { credentials: "include" });
        setAllowed(res.ok);
      } catch {
        setAllowed(false);
      }
    })();
  }, []);

  const usersQuery = useQuery<AdminUser[]>({
    queryKey: ["/api/admin/users"],
    enabled: allowed === true,
  });
  const profilesQuery = useQuery<AdminProfile[]>({
    queryKey: ["/api/admin/profiles"],
    enabled: allowed === true,
  });
  const annoncesQuery = useQuery<AdminAnnonce[]>({
    queryKey: ["/api/admin/annonces"],
    enabled: allowed === true,
  });

  const counts = useMemo(() => {
    return {
      users: usersQuery.data?.length ?? 0,
      profiles: profilesQuery.data?.length ?? 0,
      annonces: annoncesQuery.data?.length ?? 0,
    };
  }, [usersQuery.data, profilesQuery.data, annoncesQuery.data]);

  if (allowed === null) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-sm text-muted-foreground">{lang === "en" ? "Loading…" : "Chargement…"}</div>
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6">
        <div className="max-w-md text-center space-y-4">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-muted/50 flex items-center justify-center">
            <Shield className="w-7 h-7 text-muted-foreground" />
          </div>
          <div className="text-xl font-semibold text-foreground">{lang === "en" ? "Admin only" : "Admin uniquement"}</div>
          <div className="text-sm text-muted-foreground">
            {lang === "en"
              ? "Configure ADMIN_EMAIL and set the admin user's email in the database."
              : "Configure ADMIN_EMAIL et renseigne l'email admin dans la base."}
          </div>
          <Button variant="secondary" onClick={() => setLocation("/dashboard")}>
            {lang === "en" ? "Back" : "Retour"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 px-4 pt-3 pb-3">
        <div className="mx-auto max-w-md flex items-center justify-between">
          <button
            onClick={() => setLocation("/dashboard")}
            className="w-10 h-10 rounded-full bg-card/80 backdrop-blur flex items-center justify-center border border-border"
          >
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <div className="text-lg font-semibold text-foreground">Admin</div>
          <div className="w-10" />
        </div>
      </header>

      <main className="px-4 pb-10">
        <div className="mx-auto max-w-md space-y-4">
          <Tabs defaultValue="profiles">
            <TabsList className="w-full">
              <TabsTrigger value="profiles" className="flex-1">
                <Crown className="w-4 h-4 mr-2" />
                {lang === "en" ? "VIP" : "VIP"} ({counts.profiles})
              </TabsTrigger>
              <TabsTrigger value="annonces" className="flex-1">
                <Megaphone className="w-4 h-4 mr-2" />
                {lang === "en" ? "Ads" : "Annonces"} ({counts.annonces})
              </TabsTrigger>
              <TabsTrigger value="users" className="flex-1">
                <Users className="w-4 h-4 mr-2" />
                {lang === "en" ? "Users" : "Utilisateurs"} ({counts.users})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="profiles" className="space-y-3">
              {profilesQuery.isLoading ? (
                <div className="h-24 rounded-2xl bg-muted/40 border border-border" />
              ) : (
                (profilesQuery.data ?? []).map((p) => (
                  <div key={p.id} className="rounded-2xl border border-border bg-card/70 backdrop-blur p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-semibold text-foreground truncate">{p.pseudo}</div>
                        <div className="text-sm text-muted-foreground truncate">{p.ville}</div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-xs text-muted-foreground">{p.isPro ? "PRO" : "STD"}</div>
                        <Switch
                          checked={Boolean(p.isVip)}
                          onCheckedChange={async (checked) => {
                            await apiRequest("PATCH", `/api/admin/profiles/${p.id}`, { isVip: Boolean(checked) });
                            await profilesQuery.refetch();
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ))
              )}
            </TabsContent>

            <TabsContent value="annonces" className="space-y-3">
              {annoncesQuery.isLoading ? (
                <div className="h-24 rounded-2xl bg-muted/40 border border-border" />
              ) : (
                (annoncesQuery.data ?? []).map((a) => (
                  <div key={a.id} className="rounded-2xl border border-border bg-card/70 backdrop-blur p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-semibold text-foreground truncate">{a.title}</div>
                        <div className="text-sm text-muted-foreground truncate">{a.pseudo}</div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className={`text-xs ${a.active ? "text-emerald-400" : "text-muted-foreground"}`}>
                          {a.active ? (lang === "en" ? "Published" : "Publié") : (lang === "en" ? "Hidden" : "Masqué")}
                        </div>
                        <Switch
                          checked={Boolean(a.active)}
                          onCheckedChange={async (checked) => {
                            await apiRequest("PATCH", `/api/admin/annonces/${a.id}`, { active: Boolean(checked) });
                            await annoncesQuery.refetch();
                          }}
                        />
                      </div>
                    </div>
                    <Separator className="my-3" />
                    <Button variant="secondary" className="w-full" onClick={() => setLocation(`/profile/${a.profileId}`)}>
                      {lang === "en" ? "View profile" : "Voir le profil"}
                    </Button>
                  </div>
                ))
              )}
            </TabsContent>

            <TabsContent value="users" className="space-y-3">
              {usersQuery.isLoading ? (
                <div className="h-24 rounded-2xl bg-muted/40 border border-border" />
              ) : (
                (usersQuery.data ?? []).map((u) => (
                  <div key={u.id} className="rounded-2xl border border-border bg-card/70 backdrop-blur p-4">
                    <div className="font-semibold text-foreground truncate">{u.username}</div>
                    <div className="text-sm text-muted-foreground truncate">{u.email ?? "—"}</div>
                  </div>
                ))
              )}
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}


