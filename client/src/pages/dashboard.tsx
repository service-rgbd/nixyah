import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Settings2, Megaphone, UserCircle2, Compass, Menu, LogOut, Phone, MapPin, AlertCircle, HelpCircle, Info, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { clearSession, getProfileId } from "@/lib/session";
import { useI18n } from "@/lib/i18n";
import avatarUrl from "@assets/avatar.png";
import { apiRequest } from "@/lib/queryClient";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type ApiProfileDetail = {
  id: string;
  pseudo: string;
  age: number;
  ville: string;
  verified: boolean;
  isPro?: boolean | null;
  accountType?: "profile" | "residence" | "salon" | "adult_shop" | null;
  photoUrl: string | null;
  photos: string[];
  videoUrl: string | null;
  tarif: string | null;
  lieu: string | null;
  services: string[] | null;
  description: string | null;
  visible?: boolean | null;
  showLocation?: boolean | null;
  contact?: {
    phone: string | null;
    telegram: string | null;
    showPhone?: boolean;
    showTelegram?: boolean;
    preference?: "whatsapp" | "telegram";
  } | null;
  annonce: { id: string; title: string; body: string | null } | null;
};

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { lang, t } = useI18n();
  const profileId = getProfileId();
  const queryClient = useQueryClient();
  const [phone, setPhone] = useState("");
  const [showPhone, setShowPhone] = useState(false);
  const [telegram, setTelegram] = useState("");
  const [showTelegram, setShowTelegram] = useState(false);
  const [contactPreference, setContactPreference] = useState<"whatsapp" | "telegram">("whatsapp");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [showLocation, setShowLocation] = useState(false);
  const [accountEmail, setAccountEmail] = useState("");
  const [showEmailDialog, setShowEmailDialog] = useState(false);

  const scrollToId = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const { data, isLoading } = useQuery<ApiProfileDetail | null>({
    queryKey: profileId ? [`/api/profiles/${profileId}`] : ["__no_profile__"],
    enabled: Boolean(profileId),
  });

  const { data: account } = useQuery<{ username: string; email: string | null }>({
    queryKey: ["/api/me/account"],
    enabled: Boolean(profileId),
  });

  const { data: support } = useQuery<{ resetEmail: string | null; telegramUrl: string | null }>({
    queryKey: ["/api/support"],
  });

  const { data: adminMe } = useQuery<{ ok: boolean }>({
    queryKey: ["/api/admin/me"],
    enabled: Boolean(profileId),
    retry: false,
  });

  useEffect(() => {
    if (!data) return;
    setPhone(data.contact?.phone ?? "");
    setTelegram(data.contact?.telegram ?? "");
    setShowPhone(Boolean(data.contact?.showPhone));
    setShowTelegram(Boolean(data.contact?.showTelegram));
    setContactPreference(data.contact?.preference ?? "whatsapp");
    setShowLocation(Boolean(data.showLocation));
  }, [data]);

  useEffect(() => {
    if (!account) return;
    setAccountEmail(account.email ?? "");
    if (!account.email) {
      setShowEmailDialog(true);
    }
  }, [account]);

  if (!profileId) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6">
        <div className="text-center space-y-3">
          <p className="text-foreground font-medium">
            {lang === "en" ? "No session" : "Aucune session"}
          </p>
          <p className="text-muted-foreground text-sm">
            {lang === "en"
              ? "Sign up to access your space."
              : "Inscris-toi pour accéder à ton espace."}
          </p>
          <Button onClick={() => setLocation("/signup")}>{t("signup")}</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Dialog open={showEmailDialog} onOpenChange={setShowEmailDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">
              {lang === "en" ? "Add a recovery email" : "Ajoute un email de récupération"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {lang === "en"
                ? "Optional but recommended. This email will only be used if you lose your password."
                : "Optionnel mais recommandé. Cet email servira uniquement si tu perds ton mot de passe."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <Input
              type="email"
              value={accountEmail}
              onChange={(e) => setAccountEmail(e.target.value)}
              placeholder={lang === "en" ? "your@email.com" : "ton.email@example.com"}
              className="h-11"
            />
          </div>
          <DialogFooter className="pt-3">
            <Button
              variant="ghost"
              type="button"
              onClick={() => setShowEmailDialog(false)}
            >
              {lang === "en" ? "Later" : "Plus tard"}
            </Button>
            <Button
              type="button"
              onClick={async () => {
                const trimmed = accountEmail.trim();
                if (!trimmed) {
                  toast({
                    title: lang === "en" ? "Add an email first" : "Ajoute d’abord un email",
                  });
                  return;
                }
                const res = await apiRequest("PATCH", "/api/me/account", { email: trimmed });
                if (!res.ok) {
                  toast({
                    title: lang === "en" ? "Unable to save email" : "Impossible d’enregistrer l’email",
                  });
                  return;
                }
                toast({
                  title: lang === "en" ? "Email saved" : "Email enregistré",
                });
                setShowEmailDialog(false);
              }}
            >
              {lang === "en" ? "Save" : "Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <main className="px-4 pb-10 space-y-4 pt-4">
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="border-border mx-auto max-w-md">
            <CardHeader className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="leading-tight">
                  <div className="text-2xl font-bold text-gradient tracking-tight">NIXYAH</div>
                  <div className="text-xs text-muted-foreground">
                    {lang === "en" ? "My space" : "Mon espace"}
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="rounded-full bg-gradient-to-r from-pink-500/90 via-fuchsia-500/90 to-purple-500/90 text-white shadow-lg px-3 h-9 gap-2"
                      data-testid="button-dashboard-menu"
                    >
                      <Menu className="w-4 h-4" />
                      <span className="text-xs font-medium">
                        {lang === "en" ? "Quick menu" : "Menu rapide"}
                      </span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    className="w-64 glass border border-white/10 bg-background/80 backdrop-blur-xl"
                  >
                    <DropdownMenuLabel className="text-xs uppercase tracking-wide text-muted-foreground">
                      {lang === "en" ? "Navigation" : "Navigation"}
                    </DropdownMenuLabel>
                    <DropdownMenuItem onClick={() => setLocation("/start")}>
                      <Compass className="w-4 h-4" />
                      {lang === "en" ? "News & feed" : "Actualités"}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setLocation(`/profile/${profileId}`)}>
                      <UserCircle2 className="w-4 h-4" />
                      {t("viewProfile")}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setLocation("/annonce/new")}>
                      <Megaphone className="w-4 h-4" />
                      {data?.annonce
                        ? lang === "en"
                          ? "Edit ad"
                          : "Modifier annonce"
                        : lang === "en"
                        ? "Create ad"
                        : "Créer annonce"}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setLocation("/explore")}>
                      <Compass className="w-4 h-4" />
                      {t("explore")}
                    </DropdownMenuItem>

                    <DropdownMenuSeparator />
                    <DropdownMenuLabel className="text-xs uppercase tracking-wide text-muted-foreground">
                      {lang === "en" ? "Sections" : "Sections"}
                    </DropdownMenuLabel>
                    <DropdownMenuItem onClick={() => scrollToId("section-contact")}>
                      <Phone className="w-4 h-4" />
                      {lang === "en" ? "Contact" : "Contact"}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => scrollToId("section-location")}>
                      <MapPin className="w-4 h-4" />
                      {lang === "en" ? "Location" : "Localisation"}
                    </DropdownMenuItem>

                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => setLocation("/settings")}
                      data-testid="button-open-settings"
                    >
                      <Settings2 className="w-4 h-4" />
                      {t("settings")}
                    </DropdownMenuItem>

                    {adminMe?.ok ? (
                      <DropdownMenuItem onClick={() => setLocation("/admin")}>
                        <Settings2 className="w-4 h-4" />
                        Admin
                      </DropdownMenuItem>
                    ) : null}
                    <DropdownMenuItem
                      onClick={async () => {
                        try {
                          await apiRequest("POST", "/api/logout");
                        } finally {
                          clearSession();
                          setLocation("/");
                        }
                      }}
                      data-testid="button-logout"
                    >
                      <LogOut className="w-4 h-4" />
                      {lang === "en" ? "Sign out" : "Se déconnecter"}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <div className="space-y-1">
                <CardTitle className="text-base flex items-center gap-2">
                  <UserCircle2 className="w-4 h-4 text-primary" />
                  {lang === "en" ? "My profile" : "Mon profil"}
                </CardTitle>
                <CardDescription>
                  {lang === "en" ? "Manage your space simply." : "Gère ton espace simplement."}
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {isLoading ? (
                <p className="text-sm text-muted-foreground">Chargement…</p>
              ) : data ? (
                <div className="flex items-center gap-4">
                  <img
                    src={data.photoUrl || avatarUrl}
                    alt={data.pseudo}
                    className="w-16 h-16 rounded-2xl object-cover border border-border"
                  />
                  <div className="flex-1 space-y-1">
                    <p className="font-semibold text-foreground">
                      {data.pseudo} • {data.age}
                    </p>
                    <p className="text-sm text-muted-foreground">{data.ville}</p>
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wide">
                      {data.accountType === "residence"
                        ? "Profil résidence meublée"
                        : data.accountType === "salon"
                        ? "Profil SPA / salon privé"
                        : data.accountType === "adult_shop"
                        ? "Profil boutique produits adultes"
                        : "Profil escorte"}
                    </p>
                    {data.annonce ? (
                      <p className="text-xs text-muted-foreground mt-1">
                        Annonce active:{" "}
                        <span className="text-foreground">{data.annonce.title}</span>
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground mt-1">
                        Aucune annonce pour le moment
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Profil introuvable.</p>
              )}

              <div className="flex items-center justify-between gap-4">
                <Label className="text-sm text-foreground">{t("showProfile")}</Label>
                <Switch
                  checked={Boolean(data?.visible ?? true)}
                  onCheckedChange={async (checked) => {
                    await apiRequest("PATCH", "/api/me/profile", { visible: Boolean(checked) });
                    await queryClient.invalidateQueries({ queryKey: [`/api/profiles/${profileId}`] });
                  }}
                  data-testid="switch-profile-visible"
                />
              </div>

              <details id="section-contact" className="rounded-2xl border border-border bg-card">
                <summary className="px-4 py-4 cursor-pointer select-none">
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-2 text-base font-semibold text-foreground">
                        <Phone className="w-4 h-4 text-muted-foreground" />
                        <span>{lang === "en" ? "Contact" : "Contact"}</span>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {lang === "en" ? "WhatsApp / Telegram visibility" : "WhatsApp / Telegram (visibilité)"}
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground">{lang === "en" ? "Open" : "Ouvrir"}</span>
                  </div>
                </summary>
                <div className="px-4 pb-4">
                  <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>{lang === "en" ? "Preferred method" : "Méthode mise en avant"}</Label>
                    <div className="grid grid-cols-2 gap-3">
                      <Button
                        variant={contactPreference === "whatsapp" ? "default" : "outline"}
                        onClick={() => setContactPreference("whatsapp")}
                        type="button"
                      >
                        WhatsApp
                      </Button>
                      <Button
                        variant={contactPreference === "telegram" ? "default" : "outline"}
                        onClick={() => setContactPreference("telegram")}
                        type="button"
                      >
                        Telegram
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {lang === "en"
                        ? "This is the method highlighted when both are available."
                        : "C’est la méthode prioritaire quand les deux sont disponibles."}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>Téléphone (WhatsApp)</Label>
                    <Input
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+2250700000000"
                      className="h-12"
                    />
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">
                        {lang === "en" ? "Show phone" : "Afficher le téléphone"}
                      </span>
                      <Switch checked={showPhone} onCheckedChange={(v) => setShowPhone(Boolean(v))} />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Telegram</Label>
                    <Input
                      value={telegram}
                      onChange={(e) => setTelegram(e.target.value)}
                      placeholder="@username"
                      className="h-12"
                    />
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">
                        {lang === "en" ? "Show Telegram" : "Afficher Telegram"}
                      </span>
                      <Switch
                        checked={showTelegram}
                        onCheckedChange={(v) => setShowTelegram(Boolean(v))}
                      />
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    className="w-full h-12"
                    onClick={async () => {
                      await apiRequest("PATCH", "/api/me/profile", {
                        phone: phone.trim() ? phone.trim() : null,
                        showPhone,
                        telegram: telegram.trim() ? telegram.trim() : null,
                        showTelegram,
                        contactPreference,
                      });
                      await queryClient.invalidateQueries({ queryKey: [`/api/profiles/${profileId}`] });
                    }}
                  >
                    {lang === "en" ? "Save contact" : "Enregistrer le contact"}
                  </Button>
                  </div>
                </div>
              </details>

              <details id="section-account-email" className="rounded-2xl border border-border bg-card">
                <summary className="px-4 py-4 cursor-pointer select-none">
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-2 text-base font-semibold text-foreground">
                        <Mail className="w-4 h-4 text-muted-foreground" />
                        <span>
                          {lang === "en" ? "Account email" : "Email du compte"}
                        </span>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {lang === "en"
                          ? "Used only for password recovery (optional)"
                          : "Utilisé uniquement pour récupérer ton mot de passe (optionnel)"}
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground">{lang === "en" ? "Open" : "Ouvrir"}</span>
                  </div>
                </summary>
                <div className="px-4 pb-4 space-y-3">
                  <Input
                    type="email"
                    value={accountEmail}
                    onChange={(e) => setAccountEmail(e.target.value)}
                    placeholder={lang === "en" ? "your@email.com" : "ton.email@example.com"}
                    className="h-11"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    {lang === "en"
                      ? "This email is not shown on your profile. It only helps you reset your password."
                      : "Cet email n’est pas affiché sur ton profil. Il sert uniquement à t’aider à récupérer ton mot de passe."}
                  </p>
                  <Button
                    variant="outline"
                    className="w-full h-11"
                    onClick={async () => {
                      const trimmed = accountEmail.trim();
                      const body =
                        trimmed.length === 0
                          ? { email: null as string | null }
                          : { email: trimmed };
                      const res = await apiRequest("PATCH", "/api/me/account", body);
                      if (!res.ok) {
                        toast({
                          title: lang === "en" ? "Unable to save email" : "Impossible d’enregistrer l’email",
                        });
                        return;
                      }
                      toast({
                        title: lang === "en" ? "Email saved" : "Email enregistré",
                      });
                    }}
                  >
                    {lang === "en" ? "Save email" : "Enregistrer l’email"}
                  </Button>
                </div>
              </details>

              <details id="section-location" className="rounded-2xl border border-border bg-card">
                <summary className="px-4 py-4 cursor-pointer select-none">
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-2 text-base font-semibold text-foreground">
                        <MapPin className="w-4 h-4 text-muted-foreground" />
                        <span>{lang === "en" ? "Location" : "Localisation"}</span>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {lang === "en" ? "Nearby discovery (optional)" : "Découverte à proximité (optionnel)"}
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground">{lang === "en" ? "Open" : "Ouvrir"}</span>
                  </div>
                </summary>
                <div className="px-4 pb-4 space-y-3">
                  <Button
                    variant="secondary"
                    className="w-full h-12"
                    onClick={async () => {
                      if (!navigator.geolocation) {
                        toast({
                          title: lang === "en" ? "Geolocation unavailable" : "Géolocalisation indisponible",
                        });
                        return;
                      }

                      navigator.geolocation.getCurrentPosition(
                        async (pos) => {
                          const lat = pos.coords.latitude;
                          const lng = pos.coords.longitude;
                          setCoords({ lat, lng });
                          await apiRequest("PATCH", "/api/me/profile", { lat, lng });
                          toast({
                            title: lang === "en" ? "Location saved" : "Position enregistrée",
                          });
                        },
                        () => {
                          toast({
                            title: lang === "en" ? "Permission denied" : "Permission refusée",
                            description:
                              lang === "en"
                                ? "Allow location access to enable nearby discovery."
                                : "Autorisez la position pour activer la découverte à proximité.",
                          });
                        },
                        { enableHighAccuracy: false, timeout: 8000 },
                      );
                    }}
                  >
                    {lang === "en" ? "Use my location" : "Utiliser ma position"}
                  </Button>
                  {coords && (
                    <p className="text-xs text-muted-foreground">
                      {lang === "en" ? "Saved." : "Enregistré."}{" "}
                      <span className="font-mono">
                        {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}
                      </span>
                    </p>
                  )}
                  <div className="flex items-center justify-between pt-2">
                    <div className="text-sm text-muted-foreground">
                      {lang === "en"
                        ? "Show my exact location on map (directions)"
                        : "Afficher ma localisation précise sur la carte (itinéraire)"}
                    </div>
                    <Switch
                      checked={showLocation}
                      onCheckedChange={async (v) => {
                        const value = Boolean(v);
                        setShowLocation(value);
                        await apiRequest("PATCH", "/api/me/profile", { showLocation: value });
                        await queryClient.invalidateQueries({ queryKey: [`/api/profiles/${profileId}`] });
                      }}
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {lang === "en"
                      ? "When enabled, visitors can open a map route to you. Otherwise only the city/area is shown."
                      : "Activé, les visiteurs peuvent ouvrir un itinéraire vers toi. Sinon seule la ville / zone apparaît."}
                  </p>
                </div>
              </details>

            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <Card className="border-border mx-auto max-w-md">
            <CardHeader className="space-y-1">
              <CardTitle className="text-base flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-primary" />
                {lang === "en" ? "Help & support" : "Aide & support"}
              </CardTitle>
              <CardDescription>
                {lang === "en"
                  ? "Find answers, report an issue or reach the NIXYAH team."
                  : "Trouve des réponses, signale un bug ou contacte l’équipe NIXYAH."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                variant="outline"
                className="w-full h-11 justify-between"
                onClick={() => {
                  const email = support?.resetEmail;
                  if (!email) {
                    toast({
                      title: lang === "en" ? "No support email configured" : "Aucun email support configuré",
                    });
                    return;
                  }
                  window.location.href = `mailto:${email}?subject=${encodeURIComponent(
                    lang === "en" ? "NIXYAH – Bug report" : "NIXYAH – Signalement de bug",
                  )}`;
                }}
              >
                <span className="flex items-center gap-2 text-sm">
                  <AlertCircle className="w-4 h-4 text-destructive" />
                  {lang === "en" ? "Report a bug" : "Signaler un bug"}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {lang === "en" ? "via email" : "par email"}
                </span>
              </Button>

              <Button
                variant="outline"
                className="w-full h-11 justify-between"
                onClick={() => {
                  const telegram = support?.telegramUrl;
                  if (telegram) {
                    window.open(telegram, "_blank", "noopener,noreferrer");
                    return;
                  }
                  const email = support?.resetEmail;
                  if (email) {
                    window.location.href = `mailto:${email}?subject=${encodeURIComponent(
                      lang === "en" ? "NIXYAH – Contact" : "NIXYAH – Contact équipe",
                    )}`;
                  } else {
                    toast({
                      title: lang === "en" ? "No support channel configured" : "Aucun canal support configuré",
                    });
                  }
                }}
              >
                <span className="flex items-center gap-2 text-sm">
                  <Mail className="w-4 h-4 text-primary" />
                  {lang === "en" ? "Contact the team" : "Contacter l’équipe"}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {support?.telegramUrl ? (lang === "en" ? "via Telegram" : "via Telegram") : lang === "en" ? "via email" : "par email"}
                </span>
              </Button>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <Button
                  variant="outline"
                  className="h-10 justify-start gap-2"
                  onClick={() => setLocation("/conditions")}
                >
                  <HelpCircle className="w-4 h-4 text-muted-foreground" />
                  <span className="text-xs">
                    {lang === "en" ? "FAQ / Help" : "FAQ / Aide"}
                  </span>
                </Button>
                <Button
                  variant="outline"
                  className="h-10 justify-start gap-2"
                  onClick={() => setLocation("/conditions")}
                >
                  <Info className="w-4 h-4 text-muted-foreground" />
                  <span className="text-xs">
                    {lang === "en" ? "Terms & privacy" : "Conditions & confidentialité"}
                  </span>
                </Button>
              </div>

              <div className="pt-1">
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  {lang === "en"
                    ? "NIXYAH is a discreet platform. Never share sensitive information in public messages – use private contact only."
                    : "NIXYAH est une plateforme discrète. Ne partage jamais d’informations sensibles dans les messages publics – utilise uniquement le contact privé."}
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </main>
    </div>
  );
}


