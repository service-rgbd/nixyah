import { useParams, useLocation } from "wouter";
import { motion } from "framer-motion";
import { ArrowLeft, BadgeCheck, MapPin, Clock, Calendar, Euro, MapPinned, MessageCircle, Share2, Heart, Play } from "lucide-react";
import { mockProfiles } from "@/lib/mockData";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function ProfileDetail() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  
  const profile = mockProfiles.find((p) => p.id === params.id);

  if (!profile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <h2 className="font-display text-2xl text-foreground">Profil introuvable</h2>
          <Button onClick={() => setLocation("/")} data-testid="button-back-home">
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
          <img
            src={profile.photoUrl}
            alt={profile.pseudo}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent" />
          
          <motion.button
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            onClick={() => setLocation("/")}
            className="absolute top-4 left-4 w-10 h-10 rounded-full glass flex items-center justify-center"
            data-testid="button-back"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </motion.button>

          <motion.button
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="absolute top-4 right-4 w-10 h-10 rounded-full glass flex items-center justify-center"
            data-testid="button-share"
          >
            <Share2 className="w-5 h-5 text-white" />
          </motion.button>

          {profile.videoUrl && (
            <div className="absolute bottom-24 right-4">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="w-14 h-14 rounded-full bg-primary/90 flex items-center justify-center shadow-lg"
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
                <div className="flex items-center gap-2 mt-2">
                  <MapPin className="w-4 h-4 text-muted-foreground" />
                  <span className="text-muted-foreground" data-testid="text-profile-ville">{profile.ville}</span>
                  {profile.verified && (
                    <Badge variant="secondary" className="ml-2 gap-1">
                      <BadgeCheck className="w-3 h-3 text-primary" />
                      Vérifié
                    </Badge>
                  )}
                </div>
              </div>
              <div className="text-right">
                <span className="text-2xl font-semibold text-primary" data-testid="text-profile-tarif">
                  {profile.tarif}
                </span>
              </div>
            </div>

            {profile.description && (
              <p className="text-foreground/80 leading-relaxed" data-testid="text-profile-description">
                {profile.description}
              </p>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-2xl bg-card border border-border">
                <div className="flex items-center gap-2 text-muted-foreground mb-2">
                  <Calendar className="w-4 h-4" />
                  <span className="text-sm">Disponibilité</span>
                </div>
                <p className="font-medium text-foreground" data-testid="text-disponibilite">
                  {profile.disponibilite.date}
                </p>
                <p className="text-sm text-muted-foreground">
                  {profile.disponibilite.heureDebut} • {profile.disponibilite.duree}
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-card border border-border">
                <div className="flex items-center gap-2 text-muted-foreground mb-2">
                  <MapPinned className="w-4 h-4" />
                  <span className="text-sm">Lieu</span>
                </div>
                <p className="font-medium text-foreground" data-testid="text-lieu">
                  {profile.lieu}
                </p>
              </div>
            </div>

            <div>
              <h3 className="text-sm text-muted-foreground mb-3">Services proposés</h3>
              <div className="flex flex-wrap gap-2">
                {profile.services.map((service) => (
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
                ⚠️ Djantrah.com est un espace de mise en relation. Chaque utilisateur est responsable de ses choix. 
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
            data-testid="button-contact"
          >
            <MessageCircle className="w-5 h-5" />
            Contacter
          </Button>
        </div>
      </div>
    </div>
  );
}