import { useParams, useLocation } from "wouter";
import { motion } from "framer-motion";
import { ArrowLeft, BadgeCheck, MapPin, Calendar, MapPinned, MessageCircle, Share2, Heart, Scale, Wine, Cigarette, Palette, PersonStanding, Sparkles, PhoneCall, Send, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { buildContactMessage, openTelegram, openWhatsApp } from "@/lib/contact";
import { toast } from "@/hooks/use-toast";
import { useI18n } from "@/lib/i18n";
import { PhotoSwipe } from "@/components/photo-swipe";
import { useEffect, useMemo, useState } from "react";
import { ApiError } from "@/lib/queryClient";
import { StoryReel, type StoryReelGroup } from "@/components/story-reel";
import { getStoredBrowserCoords, requestBrowserCoords } from "@/lib/browserLocation";
import { getDefaultProfilePhoto } from "@/lib/profile-photo";
import { SeoHead, buildBreadcrumbJsonLd } from "@/components/seo-head";

function dedupeMedia(urls: Array<string | null | undefined>) {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const url of urls) {
    if (!url) continue;
    const stable = url.split("#")[0]?.split("?")[0] ?? url;
    if (seen.has(stable)) continue;
    seen.add(stable);
    out.push(url);
  }
  return out;
}

function getAccountTypeLabel(accountType: ApiProfileDetail["accountType"]) {
  if (accountType === "residence") return "Résidence meublée";
  if (accountType === "salon") return "SPA / salon privé";
  if (accountType === "adult_shop") return "Boutique produits adultes";
  return "Escorte";
}

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
  disponibilite: { date: string; heureDebut: string; duree: string } | null;
  services: string[] | null;
  lieu: string | null;
  tarif: string | null;
  description: string | null;
  corpulence?: string | null;
  poids?: number | null;
  attitude?: string | null;
  boireUnVerre?: boolean | null;
  fume?: boolean | null;
  teintePeau?: string | null;
  traits?: string[] | null;
  poitrine?: string | null;
  positions?: string[] | null;
  selfDescriptions?: string[] | null;
  distanceKm?: number | null;
  showLocation?: boolean;
  mapUrl?: string | null;
  stories?: Array<{
    id: string;
    visibility: "public" | "private";
    mediaUrl: string | null;
    durationSeconds: number;
    caption: string | null;
    createdAt?: string;
    expiresAt?: string | null;
  }>;
  privateVideos?: Array<{
    id: string;
    visibility: "private";
    mediaUrl: string | null;
    durationSeconds: number;
    caption: string | null;
    saleKind?: "none" | "video" | "product";
    saleTitle?: string | null;
    salePrice?: string | null;
    saleDescription?: string | null;
    createdAt?: string;
    active: boolean;
  }>;
  annonce: { id: string; title: string; body: string | null } | null;
  contact?: {
    phone: string | null;
    telegram: string | null;
    preference?: "whatsapp" | "telegram" | null;
  } | null;
};

export default function ProfileDetail() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { lang, t } = useI18n();
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [activeMediaIndex, setActiveMediaIndex] = useState(0);

  useEffect(() => {
    setCoords(getStoredBrowserCoords());
  }, []);

  const queryPath =
    coords && coords.lat && coords.lng
      ? `/api/profiles/${params.id}?lat=${coords.lat}&lng=${coords.lng}`
      : `/api/profiles/${params.id}`;

  const {
    data: profile,
    isLoading,
    error,
    refetch,
  } = useQuery<ApiProfileDetail>({
    queryKey: [queryPath],
  });

  const galleryUrls = useMemo(
    () => dedupeMedia([profile?.photoUrl, ...(profile?.photos ?? [])]),
    [profile?.photoUrl, profile?.photos],
  );

  useEffect(() => {
    setActiveMediaIndex((current) => {
      if (galleryUrls.length === 0) return 0;
      return Math.min(current, galleryUrls.length - 1);
    });
  }, [galleryUrls]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-2">
          <p className="text-muted-foreground">Chargement du profil…</p>
        </div>
      </div>
    );
  }

  if (error) {
    const status = error instanceof ApiError ? error.status : null;
    if (status === 404) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="text-center space-y-4">
            <h2 className="font-display text-2xl text-foreground">Profil introuvable</h2>
            <Button onClick={() => setLocation("/explore")} data-testid="button-back-home">
              Retour
            </Button>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4 max-w-md px-6">
          <h2 className="font-display text-2xl text-foreground">Erreur serveur</h2>
          <p className="text-muted-foreground">
            Impossible de charger ce profil pour le moment. Réessaie dans quelques instants.
          </p>
          <div className="flex items-center justify-center gap-3">
            <Button variant="outline" onClick={() => setLocation("/explore")} data-testid="button-back-home">
              Retour
            </Button>
            <Button onClick={() => refetch()} data-testid="button-retry">
              Réessayer
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <h2 className="font-display text-2xl text-foreground">Profil introuvable</h2>
          <Button onClick={() => setLocation("/explore")} data-testid="button-back-home">
            Retour
          </Button>
        </div>
      </div>
    );
  }

  const accountLabel = getAccountTypeLabel(profile.accountType);
  const isResidence = profile.accountType === "residence";
  const phone = profile.contact?.phone ?? null;
  const telegram = profile.contact?.telegram ?? null;
  const hasContact = Boolean(phone || telegram);
  const contactSummary = [phone ? "WhatsApp" : null, telegram ? "Telegram" : null].filter(Boolean).join(" • ");
  const contactMessage = buildContactMessage({ pseudo: profile.pseudo });
  const storyGroups: StoryReelGroup[] = [
    {
      profile: {
        id: profile.id,
        pseudo: profile.pseudo,
        ville: profile.ville,
        photoUrl: profile.photoUrl,
        accountType: profile.accountType,
        contact: {
          phone,
          telegram,
          preference: profile.contact?.preference ?? null,
        },
      },
      items: profile.stories ?? [],
    },
  ].filter((group) => group.items.length > 0);

  const openPreferredContact = async () => {
    if (phone) return openWhatsApp({ phone, message: contactMessage });
    if (telegram) return openTelegram({ usernameOrLink: telegram, message: contactMessage });

    toast({
      title: lang === "en" ? "No contact available" : "Aucun contact disponible",
      description:
        lang === "en"
          ? "This profile has not enabled contact details."
          : "Ce profil n'a pas activé ses coordonnées.",
    });
  };

  const essentialFacts = [
    profile.corpulence
      ? { icon: PersonStanding, label: "Corpulence", value: profile.corpulence }
      : null,
    typeof profile.poids === "number"
      ? { icon: Scale, label: "Poids", value: `${profile.poids} kg` }
      : null,
    profile.attitude
      ? { icon: Sparkles, label: "Attitude", value: profile.attitude }
      : null,
    profile.teintePeau
      ? { icon: Palette, label: "Teinte", value: profile.teintePeau }
      : null,
    profile.poitrine
      ? { icon: null, label: "Poitrine", value: profile.poitrine }
      : null,
    typeof profile.boireUnVerre === "boolean"
      ? { icon: Wine, label: "Partager un verre", value: profile.boireUnVerre ? "Oui" : "Non" }
      : null,
    typeof profile.fume === "boolean"
      ? { icon: Cigarette, label: "Fume", value: profile.fume ? "Oui" : "Non" }
      : null,
  ].filter(Boolean) as Array<{
    icon: typeof PersonStanding | typeof Scale | typeof Sparkles | typeof Palette | typeof Wine | typeof Cigarette | null;
    label: string;
    value: string;
  }>;

  const presentationEyebrow = isResidence ? "Résidence" : "Présentation";
  const presentationTitle = isResidence ? "Repères du lieu" : "Repères essentiels";
  const annonceEyebrow = isResidence ? "Lieu" : "Annonce";
  const storiesTitle = isResidence ? "Visites & stories" : "Stories du moment";
  const storiesDescription = isResidence
    ? "Capsules courtes pour montrer l'ambiance et les espaces disponibles."
    : "Capsules vidéo visibles pendant 24h, au format court.";
  const privateTitle = isResidence ? "Vidéos privées & réservations" : "Vidéos privées & ventes";
  const privateDescription = isResidence
    ? "Contenus réservés et échanges directs pour organiser une réservation."
    : "Vidéos longues ou contenus réservés, avec prix et contact direct si ce profil les propose.";
  const servicesTitle = isResidence ? "Équipements & services" : "Services proposés";
  const contactTitle = isResidence ? "Réservation & contact" : "Modalités de contact";
  const contactDescription = hasContact
    ? isResidence
      ? `Cette résidence échange via ${contactSummary}. Utilise le canal le plus direct pour organiser ton passage.`
      : `Ce profil accepte les échanges via ${contactSummary}. Choisis le canal le plus direct pour organiser le rendez-vous.`
    : isResidence
      ? "Les coordonnées directes de cette résidence ne sont pas encore activées."
      : "Les coordonnées directes ne sont pas encore activées pour ce profil.";
  const availabilityLabel = isResidence ? "Disponibilité du lieu" : "Disponibilité";
  const locationTitle = isResidence ? "Adresse du lieu" : "Adresse";
  const structuredData = (() => {
    const origin = typeof window !== "undefined" ? window.location.origin : "https://www.nixyah.com";
    const profileUrl = `${origin}/profile/${profile.id}`;
    const imageUrl = galleryUrls[0] ?? profile.photoUrl ?? getDefaultProfilePhoto(profile.accountType);
    const breadcrumb = buildBreadcrumbJsonLd(
      [
        { name: "Accueil", path: "/start" },
        { name: "Explore", path: "/explore" },
        { name: profile.pseudo, path: `/profile/${profile.id}` },
      ],
      origin,
    );

    if (profile.accountType === "residence" || profile.accountType === "salon" || profile.accountType === "adult_shop") {
      return [
        breadcrumb,
        {
          "@context": "https://schema.org",
          "@type": "LocalBusiness",
          name: profile.pseudo,
          description: profile.description || undefined,
          image: imageUrl,
          url: profileUrl,
          telephone: phone || undefined,
          address: {
            "@type": "PostalAddress",
            addressLocality: profile.ville,
            streetAddress: profile.lieu || undefined,
          },
          areaServed: profile.ville,
        },
      ];
    }

    return [
      breadcrumb,
      {
        "@context": "https://schema.org",
        "@type": "ProfilePage",
        name: profile.pseudo,
        url: profileUrl,
        mainEntity: {
          "@type": "Person",
          name: profile.pseudo,
          description: profile.description || undefined,
          image: imageUrl,
          homeLocation: {
            "@type": "Place",
            address: {
              "@type": "PostalAddress",
              addressLocality: profile.ville,
            },
          },
          knowsAbout: profile.services ?? undefined,
        },
      },
    ];
  })();

  return (
    <div className="min-h-screen bg-background">
      <SeoHead
        title={`${profile.pseudo} à ${profile.ville}`}
        description={
          profile.description ||
          `${profile.pseudo} à ${profile.ville}. Consulte les disponibilités, services, médias et informations de contact sur NIXYAH.`
        }
        canonicalPath={`/profile/${profile.id}`}
        image={galleryUrls[0] ?? profile.photoUrl ?? undefined}
        keywords={[
          `${profile.pseudo} ${profile.ville}`,
          "profil adulte premium",
          "services privés francophones",
          getAccountTypeLabel(profile.accountType),
        ]}
        type="profile"
        structuredData={structuredData}
      />
      <div className="relative">
        <div className={`relative overflow-hidden ${isResidence ? "h-[58vh]" : "h-[70vh]"}`}>
          <div className="absolute inset-0">
            <PhotoSwipe
              urls={galleryUrls}
              alt={profile.pseudo}
              fallbackUrl={getDefaultProfilePhoto(profile.accountType)}
              imgClassName="w-full h-full object-cover"
              showArrows={galleryUrls.length > 1}
              showDots={galleryUrls.length > 1}
              currentIndex={activeMediaIndex}
              onIndexChange={setActiveMediaIndex}
            />
          </div>
          <div className={`absolute inset-0 ${isResidence ? "bg-gradient-to-t from-black/58 via-black/10 to-transparent" : "bg-gradient-to-t from-black/90 via-black/25 to-transparent"}`} />
          
          <motion.button
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            onClick={() => setLocation("/explore")}
            className={`absolute left-4 top-4 flex h-10 w-10 items-center justify-center rounded-full ${isResidence ? "border border-border/70 bg-background/85" : "border border-white/25 bg-black/55 shadow-md"}`}
            data-testid="button-back"
          >
            <ArrowLeft className={`w-5 h-5 ${isResidence ? "text-foreground" : "text-white"}`} />
          </motion.button>

          <motion.button
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className={`absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full ${isResidence ? "border border-border/70 bg-background/85" : "border border-white/25 bg-black/55 shadow-md"}`}
            data-testid="button-share"
          >
            <Share2 className={`w-5 h-5 ${isResidence ? "text-foreground" : "text-white"}`} />
          </motion.button>

        </div>

        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
            className={`relative ${isResidence ? "-mt-10 pb-10" : "-mt-16 pb-32"}`}
        >
          <div className="mx-auto w-full max-w-[1120px] px-4 sm:px-6 lg:px-8">
            <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
              <div className="space-y-7">
                <section className="space-y-4 border-b border-border/70 pb-7">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="space-y-4">
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="rounded-full bg-muted/40 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-foreground/70">
                          {accountLabel}
                        </span>
                        {profile.verified && (
                          <Badge variant="secondary" className="gap-1 bg-primary/10 text-primary">
                            <BadgeCheck className="w-3 h-3" />
                            Vérifié
                          </Badge>
                        )}
                        {typeof profile.distanceKm === "number" ? (
                          <div className="flex items-center gap-1 rounded-full bg-muted/40 px-3 py-1 text-[11px] text-foreground/80">
                            <MapPinned className="w-3.5 h-3.5" />
                            <span>{profile.distanceKm.toFixed(1)} km de vous</span>
                          </div>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 rounded-full px-3 text-[11px]"
                            onClick={async () => {
                              if (!navigator.geolocation) {
                                toast({
                                  title:
                                    lang === "en"
                                      ? "Geolocation unavailable"
                                      : "Géolocalisation indisponible",
                                });
                                return;
                              }
                              const nextCoords = await requestBrowserCoords();
                              if (nextCoords) {
                                setCoords(nextCoords);
                                return;
                              }
                              toast({
                                title:
                                  lang === "en"
                                    ? "Permission denied"
                                    : "Permission localisation refusée",
                                description:
                                  lang === "en"
                                    ? "Allow location access to estimate the distance."
                                    : "Autorise la position pour estimer la distance.",
                              });
                            }}
                          >
                            {lang === "en" ? "See distance" : "Voir la distance"}
                          </Button>
                        )}
                      </div>

                      <div className="space-y-3">
                        <div className="flex flex-wrap items-end gap-3">
                          <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl" data-testid="text-profile-pseudo">
                            {profile.pseudo}
                          </h1>
                          <span className="pb-1 text-xl font-light text-muted-foreground sm:text-2xl">{profile.age} ans</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-sm text-foreground/85">
                          <MapPin className="h-4 w-4 text-foreground/55" />
                          <span data-testid="text-profile-ville">
                            {profile.ville}
                            {profile.lieu ? ` • ${profile.lieu}` : ""}
                          </span>
                        </div>
                      </div>
                    </div>

                    {profile.tarif && (
                      <div className="min-w-[150px] text-left sm:text-right">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-foreground/65">Tarif</p>
                        <span className="mt-1 block text-2xl font-semibold text-primary" data-testid="text-profile-tarif">
                          {profile.tarif}
                        </span>
                      </div>
                    )}
                  </div>

                  {profile.description && (
                    <p className="max-w-4xl text-[15px] leading-7 text-foreground/82 sm:text-base" data-testid="text-profile-description">
                      {profile.description}
                    </p>
                  )}
                </section>

                {(profile.corpulence ||
                  profile.poids ||
                  profile.attitude ||
                  profile.boireUnVerre !== null ||
                  profile.fume !== null ||
                  profile.teintePeau ||
                  (profile.traits?.length ?? 0) > 0 ||
                  profile.poitrine ||
                  (profile.positions?.length ?? 0) > 0 ||
                  (profile.selfDescriptions?.length ?? 0) > 0) && (
                  <section className="space-y-4 border-b border-border/70 pb-7">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.18em] text-foreground/60">{presentationEyebrow}</p>
                      <h2 className="mt-1 text-xl font-semibold text-foreground">{presentationTitle}</h2>
                    </div>

                    <div className="flex flex-wrap gap-2.5">
                      {essentialFacts.map((fact) => {
                        const Icon = fact.icon;
                        return (
                          <div key={fact.label} className="inline-flex items-center gap-2 rounded-full bg-muted/35 px-3 py-2 text-sm text-foreground">
                            {Icon ? <Icon className="h-4 w-4 text-foreground/55" /> : null}
                            <span className="text-foreground/65">{fact.label}</span>
                            <span className="font-medium text-foreground">{fact.value}</span>
                          </div>
                        );
                      })}
                    </div>

                    {(profile.traits?.length ?? 0) > 0 && (
                      <div className="space-y-2">
                        <div className="text-xs font-semibold uppercase tracking-wide text-foreground/60">Traits</div>
                        <div className="flex flex-wrap gap-2">
                          {(profile.traits ?? []).map((x) => (
                            <Badge key={x} variant="outline" className="rounded-full border-border/70 px-3 py-1.5 text-xs">
                              {x}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {(profile.selfDescriptions?.length ?? 0) > 0 && (
                      <div className="space-y-2">
                        <div className="text-xs font-semibold uppercase tracking-wide text-foreground/60">Se décrit comme</div>
                        <div className="flex flex-wrap gap-2">
                          {(profile.selfDescriptions ?? []).map((x) => (
                            <Badge key={x} variant="outline" className="rounded-full border-border/70 px-3 py-1.5 text-xs">
                              {x}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {(profile.positions?.length ?? 0) > 0 && (
                      <div className="space-y-2">
                        <div className="text-xs font-semibold uppercase tracking-wide text-foreground/60">Positions préférées</div>
                        <div className="flex flex-wrap gap-2">
                          {(profile.positions ?? []).map((x) => (
                            <Badge key={x} variant="outline" className="rounded-full border-border/70 px-3 py-1.5 text-xs">
                              {x}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </section>
                )}

                {profile.annonce && (
                  <section className="space-y-3 border-b border-border/70 pb-7">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-foreground/60">{annonceEyebrow}</p>
                    <p className="text-xl font-semibold text-foreground">{profile.annonce.title}</p>
                    {profile.annonce.body && (
                      <p className="max-w-3xl text-sm leading-7 text-foreground/72">{profile.annonce.body}</p>
                    )}
                  </section>
                )}

                {storyGroups.length > 0 && (
                  <section className="space-y-4 border-b border-border/70 pb-7">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.18em] text-foreground/60">Stories</p>
                      <h2 className="mt-1 text-xl font-semibold text-foreground">{storiesTitle}</h2>
                      <p className="mt-1 max-w-3xl text-sm leading-7 text-foreground/72">
                        {storiesDescription}
                      </p>
                    </div>
                    <StoryReel groups={storyGroups} />
                  </section>
                )}

                {(profile.privateVideos?.length ?? 0) > 0 && (
                  <section className="space-y-4 border-b border-border/70 pb-7">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.18em] text-foreground/60">Privé</p>
                      <h2 className="mt-1 text-xl font-semibold text-foreground">{privateTitle}</h2>
                      <p className="mt-1 max-w-3xl text-sm leading-7 text-foreground/72">
                        {privateDescription}
                      </p>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      {(profile.privateVideos ?? []).map((item) => (
                        <div key={item.id} className="border-b border-border/70 pb-4 last:border-b-0 last:pb-0">
                          {item.mediaUrl ? (
                            <video src={item.mediaUrl} controls className="mb-4 h-56 w-full rounded-[18px] bg-black object-cover" />
                          ) : (
                            <div className="mb-4 flex h-56 w-full items-center justify-center rounded-[18px] bg-muted/20 text-center">
                              <div>
                                <Lock className="mx-auto h-6 w-6 text-foreground/55" />
                                <div className="mt-3 text-sm font-medium text-foreground">Contenu privé</div>
                                <div className="mt-1 text-xs text-foreground/65">Contact direct requis pour débloquer cette offre.</div>
                              </div>
                            </div>
                          )}
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-400">Privée</span>
                            <span className="rounded-full bg-muted/35 px-2 py-0.5 text-[10px] text-foreground/65">{item.durationSeconds}s</span>
                            {item.salePrice ? (
                              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] text-primary">{item.salePrice}</span>
                            ) : null}
                          </div>
                          <div className="mt-3 text-lg font-semibold text-foreground">{item.saleTitle || item.caption || "Vidéo privée"}</div>
                          {item.saleDescription ? (
                            <p className="mt-2 text-sm leading-7 text-foreground/72">{item.saleDescription}</p>
                          ) : null}
                          <Button className="mt-4 w-full gap-2" onClick={openPreferredContact}>
                            <MessageCircle className="h-4 w-4" />
                            {item.saleKind === "product" ? "Demander ce produit" : "Demander cette vidéo"}
                          </Button>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                <section className="space-y-4 border-b border-border/70 pb-7">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.18em] text-foreground/60">Services</p>
                    <h2 className="mt-1 text-xl font-semibold text-foreground">{servicesTitle}</h2>
                  </div>
                  <div className="flex flex-wrap gap-2.5">
                    {(profile.services ?? []).map((service) => (
                      <Badge
                        key={service}
                        variant="outline"
                        className="rounded-full border-border px-4 py-2 text-sm"
                        data-testid={`badge-service-${service}`}
                      >
                        {service}
                      </Badge>
                    ))}
                  </div>
                </section>

                {galleryUrls.length > 1 && (
                  <section className="space-y-4 border-b border-border/70 pb-7">
                    <div className="flex flex-wrap items-end justify-between gap-3">
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.18em] text-foreground/60">Galerie</p>
                        <h2 className="mt-1 text-xl font-semibold text-foreground">Plus de visuels</h2>
                      </div>
                      <span className="text-[11px] text-foreground/60">Glisse pour voir toutes les photos</span>
                    </div>
                    <div className="flex gap-3 overflow-x-auto no-scrollbar snap-x snap-mandatory pb-2">
                      {galleryUrls.map((photo, index) => (
                        <button
                          key={index}
                          type="button"
                          onClick={() => setActiveMediaIndex(index)}
                          className={`relative h-40 w-32 flex-shrink-0 snap-start overflow-hidden rounded-[22px] border transition sm:h-48 sm:w-36 ${
                            index === activeMediaIndex
                              ? "border-primary shadow-[0_18px_45px_-28px_rgba(0,0,0,0.5)]"
                              : "border-border"
                          }`}
                          data-testid={`img-gallery-${index}`}
                        >
                          <img
                            src={photo}
                            alt={`${profile.pseudo} ${index + 1}`}
                            className="h-full w-full object-cover"
                          />
                          <div className={`absolute inset-0 transition ${index === activeMediaIndex ? "ring-1 ring-primary/70" : "bg-black/10"}`} />
                          <div className="absolute bottom-2 left-2 rounded-full bg-black/55 px-2 py-1 text-[11px] text-white backdrop-blur">
                            Photo {index + 1}
                          </div>
                        </button>
                      ))}
                    </div>
                  </section>
                )}

                <section className="pb-2">
                  <p className="text-xs leading-relaxed text-foreground/65">
                    ⚠️ NIXYAH.com est une plateforme d'annonces et de visibilité. Chaque annonce reste sous la responsabilité de son auteur.
                    La plateforme ne garantit pas l'identité réelle des membres ni le contenu réel publié. Faites preuve de discernement.
                  </p>
                </section>
              </div>

              <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
                <section className="border-b border-border/70 pb-5">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-foreground/60">Contact</p>
                  <h2 className="mt-1 text-xl font-semibold text-foreground">{contactTitle}</h2>
                  <p className="mt-2 text-sm leading-6 text-foreground/72">
                    {contactDescription}
                  </p>

                  <div className="mt-5 space-y-3">
                    {phone && (
                      <button
                        type="button"
                        onClick={() => openWhatsApp({ phone, message: contactMessage })}
                        className="flex w-full items-center justify-between rounded-[18px] bg-muted/25 px-4 py-3 text-left transition hover:bg-primary/5"
                        data-testid="button-contact-whatsapp"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                            <PhoneCall className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-foreground">WhatsApp</p>
                            <p className="text-xs text-foreground/60">Canal direct pour échanger rapidement</p>
                          </div>
                        </div>
                        <span className="text-xs uppercase tracking-wide text-foreground/55">Ouvrir</span>
                      </button>
                    )}

                    {telegram && (
                      <button
                        type="button"
                        onClick={() => openTelegram({ usernameOrLink: telegram, message: contactMessage })}
                        className="flex w-full items-center justify-between rounded-[18px] bg-muted/25 px-4 py-3 text-left transition hover:bg-primary/5"
                        data-testid="button-contact-telegram"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                            <Send className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-foreground">Telegram</p>
                            <p className="text-xs text-foreground/60">Message privé en un clic</p>
                          </div>
                        </div>
                        <span className="text-xs uppercase tracking-wide text-foreground/55">Ouvrir</span>
                      </button>
                    )}

                    {!hasContact && (
                      <div className="rounded-[18px] bg-muted/25 px-4 py-4 text-sm text-foreground/65">
                        Utilise le bouton principal dès que les coordonnées sont activées.
                      </div>
                    )}
                  </div>

                  <Button className="mt-5 h-12 w-full gap-2 text-base font-medium" onClick={openPreferredContact} data-testid="button-contact-primary">
                    <MessageCircle className="w-5 h-5" />
                    {t("contact")}
                  </Button>
                </section>

                <section className="border-b border-border/70 pb-5">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-foreground/60">{availabilityLabel}</p>
                  <div className="mt-4 flex items-start gap-3">
                    <div className="mt-1 flex h-10 w-10 items-center justify-center rounded-full bg-muted/45 text-foreground">
                      <Calendar className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground" data-testid="text-disponibilite">
                        {profile.disponibilite?.date ?? "Disponible"}
                      </p>
                      <p className="mt-1 text-sm text-foreground/65">
                        {profile.disponibilite?.heureDebut ?? "--:--"} • {profile.disponibilite?.duree ?? "--"}
                      </p>
                    </div>
                  </div>
                </section>

                <section className="pb-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.18em] text-foreground/60">Localisation</p>
                      <h3 className="mt-1 text-lg font-semibold text-foreground">{locationTitle}</h3>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 rounded-full px-3 text-xs"
                      onClick={() => {
                        if (profile.mapUrl) {
                          window.open(profile.mapUrl, "_blank", "noopener,noreferrer");
                        } else {
                          toast({
                            title:
                              lang === "en"
                                ? "Location not shared"
                                : "Localisation non partagée",
                            description:
                              lang === "en"
                                ? "This profile does not share precise location. Ask for direct contact."
                                : "Ce profil ne souhaite pas partager sa localisation précise pour l’instant. Demande ses coordonnées directes.",
                          });
                        }
                      }}
                    >
                      {lang === "en" ? "Directions" : "Itinéraire"}
                    </Button>
                  </div>
                  <p className="mt-4 text-base font-medium text-foreground" data-testid="text-lieu">
                    {profile.lieu ?? profile.ville ?? (lang === "en" ? "Not set" : "À définir")}
                  </p>
                  {!profile.mapUrl && (
                    <p className="mt-2 text-xs leading-6 text-foreground/65">
                      {lang === "en"
                        ? "Exact map location is private. Use contact to organize the meeting."
                        : "La position exacte reste privée. Passe par le contact pour organiser le rendez-vous."}
                    </p>
                  )}
                </section>
              </aside>
            </div>
          </div>
        </motion.div>
      </div>

      <div className={`${isResidence ? "border-t border-border/70 bg-background px-4 py-4" : "fixed bottom-0 left-0 right-0 border-t border-border/70 bg-background/88 p-4 backdrop-blur-xl"}`}>
        <div className="mx-auto flex max-w-[1120px] items-center gap-3 px-0 sm:px-2 lg:px-4">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-card"
            data-testid="button-like-profile"
          >
            <Heart className="w-5 h-5 text-primary" />
          </motion.button>

          <div className="min-w-0 flex-1">
            <Button className="h-12 w-full gap-2 text-base font-medium" onClick={openPreferredContact} data-testid="button-contact">
              <MessageCircle className="w-5 h-5" />
              {t("contact")}
            </Button>
            <p className="mt-2 truncate text-[11px] text-foreground/60">
              {hasContact ? `Modalités actives: ${contactSummary}` : "Modalités de contact non activées pour le moment"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}