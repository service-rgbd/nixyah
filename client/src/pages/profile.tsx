import { useParams, useLocation } from "wouter";
import { motion } from "framer-motion";
import { ArrowLeft, BadgeCheck, MapPin, Calendar, MapPinned, MessageCircle, Share2, Heart, Play, Scale, Wine, Cigarette, Palette, PersonStanding, Sparkles, PhoneCall, Send, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import avatarUrl from "@assets/avatar.png";
import { buildContactMessage, openTelegram, openWhatsApp } from "@/lib/contact";
import { toast } from "@/hooks/use-toast";
import { useI18n } from "@/lib/i18n";
import { PhotoSwipe } from "@/components/photo-swipe";
import { useEffect, useMemo, useState } from "react";
import { ApiError } from "@/lib/queryClient";
import { StoryReel, type StoryReelGroup } from "@/components/story-reel";

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
  } | null;
};

export default function ProfileDetail() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { lang, t } = useI18n();
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [geoAsked, setGeoAsked] = useState(false);
  const [activeMediaIndex, setActiveMediaIndex] = useState(0);

  useEffect(() => {
    if (geoAsked) return;
    if (!navigator.geolocation) return;
    setGeoAsked(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => {
        // ignore
      },
      { enableHighAccuracy: false, timeout: 8000 },
    );
  }, [geoAsked]);

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

  return (
    <div className="min-h-screen bg-background">
      <div className="relative">
        <div className="relative h-[70vh] overflow-hidden">
          <div className="absolute inset-0">
            <PhotoSwipe
              urls={galleryUrls}
              alt={profile.pseudo}
              fallbackUrl={avatarUrl}
              imgClassName="w-full h-full object-cover"
              showArrows={galleryUrls.length > 1}
              showDots={galleryUrls.length > 1}
              currentIndex={activeMediaIndex}
              onIndexChange={setActiveMediaIndex}
            />
          </div>
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/25 to-transparent" />
          
          <motion.button
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            onClick={() => setLocation("/explore")}
            className="absolute top-4 left-4 w-10 h-10 rounded-full bg-black/55 border border-white/25 flex items-center justify-center shadow-md"
            data-testid="button-back"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </motion.button>

          <motion.button
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-black/55 border border-white/25 flex items-center justify-center shadow-md"
            data-testid="button-share"
          >
            <Share2 className="w-5 h-5 text-white" />
          </motion.button>

          {profile.videoUrl && (
            <div className="absolute bottom-24 right-4">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="w-14 h-14 rounded-full bg-black/65 border border-white/30 flex items-center justify-center shadow-lg"
                data-testid="button-play-video"
              >
                <Play className="w-6 h-6 text-white ml-1" fill="white" />
              </motion.button>
            </div>
          )}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="relative -mt-20 pb-32"
        >
          <div className="mx-auto w-full max-w-[1440px] px-4 sm:px-6 lg:px-10">
            <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_360px]">
              <div className="space-y-8">
                <section className="space-y-5 border-b border-border/70 pb-8">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="space-y-4">
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="rounded-full border border-border bg-background/80 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                          {accountLabel}
                        </span>
                        {profile.verified && (
                          <Badge variant="secondary" className="gap-1 border border-primary/20 bg-primary/10 text-primary">
                            <BadgeCheck className="w-3 h-3" />
                            Vérifié
                          </Badge>
                        )}
                        {typeof profile.distanceKm === "number" ? (
                          <div className="flex items-center gap-1 rounded-full border border-border bg-background/80 px-3 py-1 text-[11px] text-foreground/80">
                            <MapPinned className="w-3.5 h-3.5" />
                            <span>{profile.distanceKm.toFixed(1)} km de vous</span>
                          </div>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 rounded-full px-3 text-[11px]"
                            onClick={() => {
                              if (!navigator.geolocation) {
                                toast({
                                  title:
                                    lang === "en"
                                      ? "Geolocation unavailable"
                                      : "Géolocalisation indisponible",
                                });
                                return;
                              }
                              navigator.geolocation.getCurrentPosition(
                                (pos) => {
                                  setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
                                },
                                () => {
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
                                },
                                { enableHighAccuracy: false, timeout: 8000 },
                              );
                            }}
                          >
                            {lang === "en" ? "See distance" : "Voir la distance"}
                          </Button>
                        )}
                      </div>

                      <div className="space-y-3">
                        <div className="flex flex-wrap items-end gap-3">
                          <h1 className="font-display text-4xl font-semibold tracking-tight text-foreground sm:text-5xl" data-testid="text-profile-pseudo">
                            {profile.pseudo}
                          </h1>
                          <span className="pb-1 text-2xl font-light text-muted-foreground sm:text-3xl">{profile.age} ans</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-sm text-foreground/80">
                          <MapPin className="h-4 w-4 text-muted-foreground" />
                          <span data-testid="text-profile-ville">
                            {profile.ville}
                            {profile.lieu ? ` • ${profile.lieu}` : ""}
                          </span>
                        </div>
                      </div>
                    </div>

                    {profile.tarif && (
                      <div className="min-w-[180px] rounded-[28px] border border-primary/20 bg-primary/5 px-5 py-4 text-left shadow-[0_20px_60px_-40px_rgba(0,0,0,0.45)] sm:text-right">
                        <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">Tarif</p>
                        <span className="mt-2 block text-3xl font-semibold text-primary" data-testid="text-profile-tarif">
                          {profile.tarif}
                        </span>
                      </div>
                    )}
                  </div>

                  {profile.description && (
                    <p className="max-w-4xl text-base leading-8 text-foreground/88 sm:text-[1.05rem]" data-testid="text-profile-description">
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
                  <section className="space-y-5">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">Présentation</p>
                      <h2 className="mt-2 text-2xl font-semibold text-foreground">Repères essentiels</h2>
                      <p className="mt-2 max-w-3xl text-sm leading-7 text-muted-foreground">
                        Une lecture claire, raffinée et directe des éléments qui comptent le plus avant de prendre contact.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                      {profile.corpulence && (
                        <div className="rounded-[28px] border border-border/80 bg-gradient-to-br from-background via-card to-card/70 p-5 shadow-sm">
                          <div className="mb-3 flex items-center gap-2 text-muted-foreground">
                            <PersonStanding className="w-4 h-4" />
                            <span className="text-[11px] uppercase tracking-[0.22em]">Corpulence</span>
                          </div>
                          <p className="text-lg font-semibold text-foreground">{profile.corpulence}</p>
                        </div>
                      )}
                      {typeof profile.poids === "number" && (
                        <div className="rounded-[28px] border border-border/80 bg-gradient-to-br from-background via-card to-card/70 p-5 shadow-sm">
                          <div className="mb-3 flex items-center gap-2 text-muted-foreground">
                            <Scale className="w-4 h-4" />
                            <span className="text-[11px] uppercase tracking-[0.22em]">Poids</span>
                          </div>
                          <p className="text-lg font-semibold text-foreground">{profile.poids} kg</p>
                        </div>
                      )}
                      {profile.attitude && (
                        <div className="rounded-[28px] border border-border/80 bg-gradient-to-br from-background via-card to-card/70 p-5 shadow-sm md:col-span-2 xl:col-span-1">
                          <div className="mb-3 flex items-center gap-2 text-muted-foreground">
                            <Sparkles className="w-4 h-4" />
                            <span className="text-[11px] uppercase tracking-[0.22em]">Attitude</span>
                          </div>
                          <p className="text-lg font-semibold text-foreground">{profile.attitude}</p>
                        </div>
                      )}
                      {profile.teintePeau && (
                        <div className="rounded-[28px] border border-border/80 bg-gradient-to-br from-background via-card to-card/70 p-5 shadow-sm">
                          <div className="mb-3 flex items-center gap-2 text-muted-foreground">
                            <Palette className="w-4 h-4" />
                            <span className="text-[11px] uppercase tracking-[0.22em]">Teinte</span>
                          </div>
                          <p className="text-lg font-semibold text-foreground">{profile.teintePeau}</p>
                        </div>
                      )}
                      {profile.poitrine && (
                        <div className="rounded-[28px] border border-border/80 bg-gradient-to-br from-background via-card to-card/70 p-5 shadow-sm">
                          <div className="mb-3 flex items-center gap-2 text-muted-foreground">
                            <span className="text-[11px] uppercase tracking-[0.22em]">Poitrine</span>
                          </div>
                          <p className="text-lg font-semibold text-foreground">{profile.poitrine}</p>
                        </div>
                      )}
                      {typeof profile.boireUnVerre === "boolean" && (
                        <div className="rounded-[28px] border border-border/80 bg-gradient-to-br from-background via-card to-card/70 p-5 shadow-sm">
                          <div className="mb-3 flex items-center gap-2 text-muted-foreground">
                            <Wine className="w-4 h-4" />
                            <span className="text-[11px] uppercase tracking-[0.22em]">Partager un verre</span>
                          </div>
                          <p className="text-lg font-semibold text-foreground">{profile.boireUnVerre ? "Oui" : "Non"}</p>
                        </div>
                      )}
                      {typeof profile.fume === "boolean" && (
                        <div className="rounded-[28px] border border-border/80 bg-gradient-to-br from-background via-card to-card/70 p-5 shadow-sm">
                          <div className="mb-3 flex items-center gap-2 text-muted-foreground">
                            <Cigarette className="w-4 h-4" />
                            <span className="text-[11px] uppercase tracking-[0.22em]">Fume</span>
                          </div>
                          <p className="text-lg font-semibold text-foreground">{profile.fume ? "Oui" : "Non"}</p>
                        </div>
                      )}
                    </div>

                    {(profile.traits?.length ?? 0) > 0 && (
                      <div className="space-y-2">
                        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Traits</div>
                        <div className="flex flex-wrap gap-2">
                          {(profile.traits ?? []).map((x) => (
                            <Badge key={x} variant="outline" className="rounded-full px-3 py-1.5 text-xs">
                              {x}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {(profile.selfDescriptions?.length ?? 0) > 0 && (
                      <div className="space-y-2">
                        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Se décrit comme</div>
                        <div className="flex flex-wrap gap-2">
                          {(profile.selfDescriptions ?? []).map((x) => (
                            <Badge key={x} variant="outline" className="rounded-full px-3 py-1.5 text-xs">
                              {x}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {(profile.positions?.length ?? 0) > 0 && (
                      <div className="space-y-2">
                        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Positions préférées</div>
                        <div className="flex flex-wrap gap-2">
                          {(profile.positions ?? []).map((x) => (
                            <Badge key={x} variant="outline" className="rounded-full px-3 py-1.5 text-xs">
                              {x}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </section>
                )}

                {profile.annonce && (
                  <section className="rounded-[28px] border border-primary/20 bg-primary/5 p-5 sm:p-6">
                    <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">Annonce</p>
                    <p className="mt-3 text-xl font-semibold text-foreground">{profile.annonce.title}</p>
                    {profile.annonce.body && (
                      <p className="mt-2 max-w-3xl text-sm leading-7 text-muted-foreground">{profile.annonce.body}</p>
                    )}
                  </section>
                )}

                {storyGroups.length > 0 && (
                  <section className="space-y-4 rounded-[28px] border border-border/80 bg-card/60 p-5 sm:p-6">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">Stories</p>
                      <h2 className="mt-2 text-2xl font-semibold text-foreground">Stories du moment</h2>
                      <p className="mt-2 max-w-3xl text-sm leading-7 text-muted-foreground">
                        Capsules vidéo visibles pendant 24h, au format court.
                      </p>
                    </div>
                    <StoryReel groups={storyGroups} onOpenProfile={() => undefined} />
                  </section>
                )}

                {(profile.privateVideos?.length ?? 0) > 0 && (
                  <section className="space-y-4 rounded-[28px] border border-border/80 bg-card/60 p-5 sm:p-6">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">Privé</p>
                      <h2 className="mt-2 text-2xl font-semibold text-foreground">Vidéos privées & ventes</h2>
                      <p className="mt-2 max-w-3xl text-sm leading-7 text-muted-foreground">
                        Vidéos longues ou contenus réservés, avec prix et contact direct si ce profil les propose.
                      </p>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      {(profile.privateVideos ?? []).map((item) => (
                        <div key={item.id} className="rounded-[24px] border border-border bg-background/70 p-4 shadow-sm">
                          {item.mediaUrl ? (
                            <video src={item.mediaUrl} controls className="mb-4 h-56 w-full rounded-[18px] bg-black object-cover" />
                          ) : (
                            <div className="mb-4 flex h-56 w-full items-center justify-center rounded-[18px] border border-dashed border-border bg-muted/20 text-center">
                              <div>
                                <Lock className="mx-auto h-6 w-6 text-muted-foreground" />
                                <div className="mt-3 text-sm font-medium text-foreground">Contenu privé</div>
                                <div className="mt-1 text-xs text-muted-foreground">Contact direct requis pour débloquer cette offre.</div>
                              </div>
                            </div>
                          )}
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full border border-amber-500/20 px-2 py-0.5 text-[10px] text-amber-400">Privée</span>
                            <span className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground">{item.durationSeconds}s</span>
                            {item.salePrice ? (
                              <span className="rounded-full border border-primary/20 px-2 py-0.5 text-[10px] text-primary">{item.salePrice}</span>
                            ) : null}
                          </div>
                          <div className="mt-3 text-lg font-semibold text-foreground">{item.saleTitle || item.caption || "Vidéo privée"}</div>
                          {item.saleDescription ? (
                            <p className="mt-2 text-sm leading-7 text-muted-foreground">{item.saleDescription}</p>
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

                <section className="space-y-4">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">Services</p>
                    <h2 className="mt-2 text-2xl font-semibold text-foreground">Services proposés</h2>
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
                  <section className="space-y-4">
                    <div className="flex flex-wrap items-end justify-between gap-3">
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">Galerie</p>
                        <h2 className="mt-2 text-2xl font-semibold text-foreground">Plus de visuels</h2>
                      </div>
                      <span className="text-[11px] text-muted-foreground">Glisse pour voir toutes les photos</span>
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

                <section className="rounded-[24px] border border-border bg-muted/40 p-4">
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    ⚠️ NIXYAH.com est une plateforme d'annonces et de visibilité. Chaque annonce reste sous la responsabilité de son auteur.
                    La plateforme ne garantit pas l'identité réelle des membres ni le contenu réel publié. Faites preuve de discernement.
                  </p>
                </section>
              </div>

              <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
                <section className="rounded-[28px] border border-border bg-card/90 p-5 shadow-[0_24px_70px_-45px_rgba(0,0,0,0.45)]">
                  <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">Contact</p>
                  <h2 className="mt-2 text-2xl font-semibold text-foreground">Modalités de contact</h2>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {hasContact
                      ? `Ce profil accepte les échanges via ${contactSummary}. Choisis le canal le plus direct pour organiser le rendez-vous.`
                      : "Les coordonnées directes ne sont pas encore activées pour ce profil."}
                  </p>

                  <div className="mt-5 space-y-3">
                    {phone && (
                      <button
                        type="button"
                        onClick={() => openWhatsApp({ phone, message: contactMessage })}
                        className="flex w-full items-center justify-between rounded-[20px] border border-border bg-background px-4 py-3 text-left transition hover:border-primary/40 hover:bg-primary/5"
                        data-testid="button-contact-whatsapp"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                            <PhoneCall className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-foreground">WhatsApp</p>
                            <p className="text-xs text-muted-foreground">Canal direct pour échanger rapidement</p>
                          </div>
                        </div>
                        <span className="text-xs uppercase tracking-wide text-muted-foreground">Ouvrir</span>
                      </button>
                    )}

                    {telegram && (
                      <button
                        type="button"
                        onClick={() => openTelegram({ usernameOrLink: telegram, message: contactMessage })}
                        className="flex w-full items-center justify-between rounded-[20px] border border-border bg-background px-4 py-3 text-left transition hover:border-primary/40 hover:bg-primary/5"
                        data-testid="button-contact-telegram"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                            <Send className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-foreground">Telegram</p>
                            <p className="text-xs text-muted-foreground">Message privé en un clic</p>
                          </div>
                        </div>
                        <span className="text-xs uppercase tracking-wide text-muted-foreground">Ouvrir</span>
                      </button>
                    )}

                    {!hasContact && (
                      <div className="rounded-[20px] border border-dashed border-border bg-background px-4 py-4 text-sm text-muted-foreground">
                        Utilise le bouton principal dès que les coordonnées sont activées.
                      </div>
                    )}
                  </div>

                  <Button className="mt-5 h-12 w-full gap-2 text-base font-medium" onClick={openPreferredContact} data-testid="button-contact-primary">
                    <MessageCircle className="w-5 h-5" />
                    {t("contact")}
                  </Button>
                </section>

                <section className="rounded-[28px] border border-border bg-card/80 p-5 shadow-sm">
                  <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">Disponibilité</p>
                  <div className="mt-4 flex items-start gap-3">
                    <div className="mt-1 flex h-10 w-10 items-center justify-center rounded-full bg-muted text-foreground">
                      <Calendar className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground" data-testid="text-disponibilite">
                        {profile.disponibilite?.date ?? "Disponible"}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {profile.disponibilite?.heureDebut ?? "--:--"} • {profile.disponibilite?.duree ?? "--"}
                      </p>
                    </div>
                  </div>
                </section>

                <section className="rounded-[28px] border border-border bg-card/80 p-5 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">Localisation</p>
                      <h3 className="mt-2 text-lg font-semibold text-foreground">Adresse</h3>
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
                    <p className="mt-2 text-xs leading-6 text-muted-foreground">
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

      <div className="fixed bottom-0 left-0 right-0 border-t border-border/70 bg-background/88 p-4 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1440px] items-center gap-3 px-0 sm:px-2 lg:px-6">
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
            <p className="mt-2 truncate text-[11px] text-muted-foreground">
              {hasContact ? `Modalités actives: ${contactSummary}` : "Modalités de contact non activées pour le moment"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}