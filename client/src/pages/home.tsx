import { useState, useRef } from "react";
import { motion, AnimatePresence, PanInfo } from "framer-motion";
import { useLocation } from "wouter";
import { BadgeCheck, MapPin, Clock, Heart, X, MessageCircle, ChevronUp, Sparkles } from "lucide-react";
import { mockProfiles, type Profile } from "@/lib/mockData";
import { Button } from "@/components/ui/button";

function ProfileCard({ 
  profile, 
  onSwipe, 
  isTop 
}: { 
  profile: Profile; 
  onSwipe: (direction: "left" | "right") => void;
  isTop: boolean;
}) {
  const [, setLocation] = useLocation();
  const [exitX, setExitX] = useState(0);
  const [showDetails, setShowDetails] = useState(false);

  const handleDragEnd = (_: any, info: PanInfo) => {
    if (Math.abs(info.offset.x) > 100) {
      setExitX(info.offset.x > 0 ? 300 : -300);
      onSwipe(info.offset.x > 0 ? "right" : "left");
    }
  };

  const handleViewProfile = () => {
    setLocation(`/profile/${profile.id}`);
  };

  return (
    <motion.div
      className="absolute inset-4 swipe-card"
      drag={isTop ? "x" : false}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.7}
      onDragEnd={handleDragEnd}
      initial={{ scale: isTop ? 1 : 0.95, opacity: isTop ? 1 : 0.5 }}
      animate={{ 
        scale: isTop ? 1 : 0.95, 
        opacity: isTop ? 1 : 0.7,
        y: isTop ? 0 : 20,
      }}
      exit={{ x: exitX, opacity: 0, rotate: exitX > 0 ? 15 : -15 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      style={{ zIndex: isTop ? 10 : 5 }}
    >
      <div 
        className="relative w-full h-full rounded-3xl overflow-hidden card-shadow cursor-pointer"
        onClick={handleViewProfile}
        data-testid={`card-profile-${profile.id}`}
      >
        <img
          src={profile.photoUrl}
          alt={profile.pseudo}
          className="absolute inset-0 w-full h-full object-cover"
          draggable={false}
        />
        
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
        
        <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
          {profile.verified && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full glass-light">
              <BadgeCheck className="w-4 h-4 text-primary" />
              <span className="text-xs font-medium text-white">Vérifié</span>
            </div>
          )}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full glass-light ml-auto">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-medium text-white">En ligne</span>
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-6">
          <div className="space-y-3">
            <div className="flex items-end gap-2">
              <h2 className="font-display text-4xl font-semibold text-white" data-testid={`text-pseudo-${profile.id}`}>
                {profile.pseudo}
              </h2>
              <span className="text-2xl text-white/80 font-light mb-1">{profile.age}</span>
            </div>

            <div className="flex items-center gap-4 text-white/70">
              <div className="flex items-center gap-1.5">
                <MapPin className="w-4 h-4" />
                <span className="text-sm" data-testid={`text-ville-${profile.id}`}>{profile.ville}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Clock className="w-4 h-4" />
                <span className="text-sm">{profile.disponibilite.date}</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 mt-2">
              {profile.services.slice(0, 2).map((service) => (
                <span 
                  key={service}
                  className="px-3 py-1 rounded-full text-xs font-medium bg-white/10 text-white/90 backdrop-blur-sm"
                >
                  {service}
                </span>
              ))}
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-primary/90 text-white">
                {profile.tarif}
              </span>
            </div>
          </div>

          <motion.div 
            className="mt-4 flex items-center justify-center gap-1 text-white/50"
            animate={{ y: [0, -5, 0] }}
            transition={{ repeat: Infinity, duration: 2 }}
          >
            <ChevronUp className="w-5 h-5" />
            <span className="text-xs">Swipe pour explorer</span>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}

export default function Home() {
  const [profiles, setProfiles] = useState(mockProfiles);
  const [, setLocation] = useLocation();

  const handleSwipe = (direction: "left" | "right") => {
    setTimeout(() => {
      setProfiles((prev) => prev.slice(1));
    }, 200);
  };

  const handleAction = (action: "pass" | "like" | "message") => {
    if (action === "message" && profiles[0]) {
      setLocation(`/profile/${profiles[0].id}`);
    } else {
      handleSwipe(action === "like" ? "right" : "left");
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="flex items-center justify-between px-6 py-4 relative z-20">
        <h1 className="font-display text-2xl font-semibold text-gradient" data-testid="text-logo">
          Djantrah
        </h1>
        <Button 
          variant="ghost" 
          size="sm"
          className="text-muted-foreground hover:text-foreground"
          onClick={() => setLocation("/signup")}
          data-testid="button-signup"
        >
          S'inscrire
        </Button>
      </header>

      <main className="flex-1 relative overflow-hidden">
        <AnimatePresence mode="popLayout">
          {profiles.length > 0 ? (
            profiles.slice(0, 2).map((profile, index) => (
              <ProfileCard
                key={profile.id}
                profile={profile}
                onSwipe={handleSwipe}
                isTop={index === 0}
              />
            ))
          ) : (
            <motion.div 
              className="absolute inset-4 flex items-center justify-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <div className="text-center space-y-4">
                <div className="w-20 h-20 mx-auto rounded-full bg-muted flex items-center justify-center">
                  <Heart className="w-10 h-10 text-muted-foreground" />
                </div>
                <h3 className="font-display text-xl text-foreground">Plus de profils</h3>
                <p className="text-muted-foreground text-sm">Revenez plus tard pour découvrir de nouveaux profils</p>
                <Button 
                  onClick={() => setProfiles(mockProfiles)}
                  className="mt-4"
                  data-testid="button-reload"
                >
                  Recharger
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {profiles.length > 0 && (
        <div className="relative z-20 px-6 pb-8 pt-4">
          <div className="flex items-center justify-center gap-6">
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => handleAction("pass")}
              className="w-14 h-14 rounded-full bg-card border border-border flex items-center justify-center shadow-lg"
              data-testid="button-pass"
            >
              <X className="w-6 h-6 text-muted-foreground" />
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => handleAction("like")}
              className="w-16 h-16 rounded-full bg-primary flex items-center justify-center shadow-lg glow-red animate-pulse-glow"
              data-testid="button-like"
            >
              <Heart className="w-7 h-7 text-white" fill="white" />
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => handleAction("message")}
              className="w-14 h-14 rounded-full bg-card border border-border flex items-center justify-center shadow-lg"
              data-testid="button-message"
            >
              <MessageCircle className="w-6 h-6 text-primary" />
            </motion.button>
          </div>
        </div>
      )}
    </div>
  );
}