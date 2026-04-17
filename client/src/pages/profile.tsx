import { useParams, useLocation } from "wouter";
import { motion } from "framer-motion";
import { ArrowLeft, BadgeCheck, MapPin, Clock, Calendar, Euro, MapPinned, MessageCircle, Share2, Heart, Play, Scale, Wine, Cigarette, Palette, PersonStanding, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import avatarUrl from "@assets/avatar.png";
import { buildContactMessage, openTelegram, openWhatsApp } from "@/lib/contact";
import { toast } from "@/hooks/use-toast";
import { useI18n } from "@/lib/i18n";
import { PhotoSwipe } from "@/components/photo-swipe";
import { useEffect, useState } from "react";
import { ApiError } from "@/lib/queryClient";

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

  return (
    <div className="min-h-screen bg-background">
      <div className="relative">
        <div className="relative h-[70vh] overflow-hidden">
          <div className="absolute inset-0">
            <PhotoSwipe
              urls={[profile.photoUrl, ...(profile.photos ?? [])]}
              alt={profile.pseudo}
              fallbackUrl={avatarUrl}
              imgClassName="w-full h-full object-cover"
              showArrows={(profile.photos?.length ?? 0) > 1}
              showDots={(profile.photos?.length ?? 0) > 1}
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
          className="relative -mt-20 px-6 pb-32"
        >
          <div className="space-y-6">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="font-display text-4xl font-semibold text-foreground" data-testid="text-profile-pseudo">
                    {profile.pseudo}
                  </h1>
                  <span className="text-3xl text-muted-foreground font-light">{profile.age}</span>
                </div>
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground" data-testid="text-profile-ville">
                      {profile.ville}
                      {profile.lieu ? ` • ${profile.lieu}` : ""}
                    </span>
                  </div>
                  {(() => {
                    const type = profile.accountType;
                    let label: string | null = null;
                    if (type === "residence") label = "Résidence meublée";
                    else if (type === "salon") label = "SPA / salon privé";
                    else if (type === "adult_shop") label = "Boutique produits adultes";
                    else label = "Escorte";
                    return (
                      <span className="px-2.5 py-1 rounded-full border border-border text-[11px] text-muted-foreground uppercase tracking-wide">
                        {label}
                      </span>
                    );
                  })()}
                  {typeof profile.distanceKm === "number" ? (
                    <div className="flex items-center gap-1 text-[11px] text-muted-foreground bg-muted/40 px-2.5 py-1 rounded-full">
                      <MapPinned className="w-3.5 h-3.5" />
                      <span>{profile.distanceKm.toFixed(1)} km de vous</span>
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-[11px] px-2 py-0"
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
                  {profile.verified && (
                    <Badge variant="secondary" className="ml-2 gap-1">
                      <BadgeCheck className="w-3 h-3 text-primary" />
                      Vérifié
                    </Badge>
                  )}
                </div>
              </div>
              <div className="text-right">
                {profile.tarif && (
                  <span className="text-2xl font-semibold text-primary" data-testid="text-profile-tarif">
                    {profile.tarif}
                  </span>
                )}
              </div>
            </div>

            {profile.description && (
              <p className="text-foreground/80 leading-relaxed" data-testid="text-profile-description">
                {profile.description}
              </p>
            )}

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
              <div className="space-y-3">
                <h3 className="text-sm text-muted-foreground">À propos</h3>
                <div className="grid grid-cols-2 gap-4">
                  {profile.corpulence && (
                    <div className="p-4 rounded-2xl bg-card border border-border">
                      <div className="flex items-center gap-2 text-muted-foreground mb-2">
                        <PersonStanding className="w-4 h-4" />
                        <span className="text-sm">Corpulence</span>
                      </div>
                      <p className="font-medium text-foreground">{profile.corpulence}</p>
                    </div>
                  )}
                  {typeof profile.poids === "number" && (
                    <div className="p-4 rounded-2xl bg-card border border-border">
                      <div className="flex items-center gap-2 text-muted-foreground mb-2">
                        <Scale className="w-4 h-4" />
                        <span className="text-sm">Poids</span>
                      </div>
                      <p className="font-medium text-foreground">{profile.poids} kg</p>
                    </div>
                  )}
                  {profile.attitude && (
                    <div className="p-4 rounded-2xl bg-card border border-border">
                      <div className="flex items-center gap-2 text-muted-foreground mb-2">
                        <Sparkles className="w-4 h-4" />
                        <span className="text-sm">Attitude</span>
                      </div>
                      <p className="font-medium text-foreground">{profile.attitude}</p>
                    </div>
                  )}
                  {profile.teintePeau && (
                    <div className="p-4 rounded-2xl bg-card border border-border">
                      <div className="flex items-center gap-2 text-muted-foreground mb-2">
                        <Palette className="w-4 h-4" />
                        <span className="text-sm">Teinte</span>
                      </div>
                      <p className="font-medium text-foreground">{profile.teintePeau}</p>
                    </div>
                  )}
                  {profile.poitrine && (
                    <div className="p-4 rounded-2xl bg-card border border-border">
                      <div className="flex items-center gap-2 text-muted-foreground mb-2">
                        <span className="text-sm">Poitrine</span>
                      </div>
                      <p className="font-medium text-foreground">{profile.poitrine}</p>
                    </div>
                  )}
                  {typeof profile.boireUnVerre === "boolean" && (
                    <div className="p-4 rounded-2xl bg-card border border-border">
                      <div className="flex items-center gap-2 text-muted-foreground mb-2">
                        <Wine className="w-4 h-4" />
                        <span className="text-sm">Partager un verre</span>
                      </div>
                      <p className="font-medium text-foreground">{profile.boireUnVerre ? "Oui" : "Non"}</p>
                    </div>
                  )}
                  {typeof profile.fume === "boolean" && (
                    <div className="p-4 rounded-2xl bg-card border border-border">
                      <div className="flex items-center gap-2 text-muted-foreground mb-2">
                        <Cigarette className="w-4 h-4" />
                        <span className="text-sm">Fume</span>
                      </div>
                      <p className="font-medium text-foreground">{profile.fume ? "Oui" : "Non"}</p>
                    </div>
                  )}
                </div>

                {(profile.traits?.length ?? 0) > 0 && (
                  <div className="space-y-2">
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Traits</div>
                    <div className="flex flex-wrap gap-2">
                      {(profile.traits ?? []).map((x) => (
                        <Badge key={x} variant="outline" className="px-3 py-1.5 text-xs">
                          {x}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {(profile.selfDescriptions?.length ?? 0) > 0 && (
                  <div className="space-y-2">
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Se décrit comme</div>
                    <div className="flex flex-wrap gap-2">
                      {(profile.selfDescriptions ?? []).map((x) => (
                        <Badge key={x} variant="outline" className="px-3 py-1.5 text-xs">
                          {x}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {(profile.positions?.length ?? 0) > 0 && (
                  <div className="space-y-2">
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Positions préférées</div>
                    <div className="flex flex-wrap gap-2">
                      {(profile.positions ?? []).map((x) => (
                        <Badge key={x} variant="outline" className="px-3 py-1.5 text-xs">
                          {x}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {profile.annonce && (
              <div className="p-4 rounded-2xl bg-primary/5 border border-primary/20">
                <p className="text-xs text-muted-foreground">Annonce</p>
                <p className="font-medium text-foreground">{profile.annonce.title}</p>
                {profile.annonce.body && (
                  <p className="text-sm text-muted-foreground mt-1">{profile.annonce.body}</p>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-2xl bg-card border border-border">
                <div className="flex items-center gap-2 text-muted-foreground mb-2">
                  <Calendar className="w-4 h-4" />
                  <span className="text-sm">Disponibilité</span>
                </div>
                <p className="font-medium text-foreground" data-testid="text-disponibilite">
                  {profile.disponibilite?.date ?? "Disponible"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {profile.disponibilite?.heureDebut ?? "--:--"} • {profile.disponibilite?.duree ?? "--"}
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-card border border-border space-y-2">
                <div className="flex items-center justify-between gap-2 text-muted-foreground mb-1">
                  <div className="flex items-center gap-2">
                    <MapPinned className="w-4 h-4" />
                    <span className="text-sm">{lang === "en" ? "Address" : "Adresse"}</span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs px-3"
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
                <p className="font-medium text-foreground" data-testid="text-lieu">
                  {profile.lieu ?? profile.ville ?? (lang === "en" ? "Not set" : "À définir")}
                </p>
                {!profile.mapUrl && (
                  <p className="text-[11px] text-muted-foreground">
                    {lang === "en"
                      ? "Exact map location is private. Use contact to organize the meeting."
                      : "La position exacte reste privée. Passe par le contact pour organiser le rendez-vous."}
                  </p>
                )}
              </div>
            </div>

            <div>
              <h3 className="text-sm text-muted-foreground mb-3">Services proposés</h3>
              <div className="flex flex-wrap gap-2">
                {(profile.services ?? []).map((service) => (
                  <Badge 
                    key={service} 
                    variant="outline" 
                    className="px-4 py-2 text-sm"
                    data-testid={`badge-service-${service}`}
                  >
                    {service}
                  </Badge>
                ))}
              </div>
            </div>

            {profile.photos.length > 1 && (
              <div>
                <h3 className="text-sm text-muted-foreground mb-3">Galerie</h3>
                <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
                  {profile.photos.map((photo, index) => (
                    <img
                      key={index}
                      src={photo}
                      alt={`${profile.pseudo} ${index + 1}`}
                      className="w-24 h-32 rounded-xl object-cover flex-shrink-0"
                      data-testid={`img-gallery-${index}`}
                    />
                  ))}
                </div>
              </div>
            )}

            <div className="p-4 rounded-2xl bg-muted/50 border border-border">
              <p className="text-xs text-muted-foreground leading-relaxed">
                ⚠️ NIXYAH.com est un espace de mise en relation. Chaque utilisateur est responsable de ses choix. 
                La plateforme ne garantit pas l'identité réelle des membres. Faites preuve de discernement.
              </p>
            </div>
          </div>
        </motion.div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 glass border-t border-white/10">
        <div className="flex items-center gap-3">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="w-12 h-12 rounded-full bg-card border border-border flex items-center justify-center"
            data-testid="button-like-profile"
          >
            <Heart className="w-5 h-5 text-primary" />
          </motion.button>
          
          <Button 
            className="flex-1 h-12 text-base font-medium gap-2"
            onClick={async () => {
              const msg = buildContactMessage({ pseudo: profile.pseudo });
              const phone = profile.contact?.phone ?? null;
              const tg = profile.contact?.telegram ?? null;

              if (phone) return openWhatsApp({ phone, message: msg });
              if (tg) return openTelegram({ usernameOrLink: tg, message: msg });

              toast({
                title: lang === "en" ? "No contact available" : "Aucun contact disponible",
                description:
                  lang === "en"
                    ? "This profile has not enabled contact details."
                    : "Ce profil n'a pas activé ses coordonnées.",
              });
            }}
            data-testid="button-contact"
          >
            <MessageCircle className="w-5 h-5" />
            {t("contact")}
          </Button>
        </div>
      </div>
    </div>
  );
}