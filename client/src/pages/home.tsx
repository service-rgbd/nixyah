import { useState, useEffect } from "react";
import { motion, AnimatePresence, PanInfo } from "framer-motion";
import { useLocation } from "wouter";
import { BadgeCheck, MapPin, Clock, Heart, X, MessageCircle, ChevronDown, Sparkles, Shield } from "lucide-react";
import { mockProfiles, type Profile } from "@/lib/mockData";
import { Button } from "@/components/ui/button";
import img1 from "@assets/c57a31df-9f73-42e9-bfe8-8181654b6932_1767904353125.png";
import img2 from "@assets/1e504b33-1c82-480a-b5ee-310fc690a3e2_1767904894440.png";

function SplashScreen({ onEnter }: { onEnter: () => void }) {
  const [currentImage, setCurrentImage] = useState(0);
  const images = [img1, img2];

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentImage((prev) => (prev + 1) % images.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-background">
      <AnimatePresence mode="wait">
        <motion.div
          key={currentImage}
          initial={{ opacity: 0, scale: 1.1 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 1.2, ease: "easeOut" }}
          className="absolute inset-0"
        >
          <img
            src={images[currentImage]}
            alt="Djantrah"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />
        </motion.div>
      </AnimatePresence>

      <div className="absolute inset-0 flex flex-col justify-end p-8 pb-16">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.8 }}
          className="space-y-6"
        >
          <div className="space-y-3">
            <h1 className="text-5xl font-bold text-white tracking-tight">
              Djantrah
            </h1>
            <p className="text-xl text-white/80 font-light leading-relaxed max-w-xs">
              L'art de la rencontre réinventé. Connexions exclusives, anonymat absolu.
            </p>
          </div>

          <div className="flex items-center gap-4 text-white/60 text-sm">
            <div className="flex items-center gap-2">
              <BadgeCheck className="w-4 h-4 text-primary" />
              <span>Profils vérifiés</span>
            </div>
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-primary" />
              <span>100% anonyme</span>
            </div>
          </div>

          <div className="space-y-3 pt-4">
            <Button
              onClick={onEnter}
              className="w-full h-14 text-lg font-semibold gap-2 glow-red"
              data-testid="button-enter"
            >
              Découvrir les profils
            </Button>
            
            <p className="text-center text-xs text-white/40">
              Réservé aux +18 ans • En continuant, vous acceptez nos conditions
            </p>
          </div>

          <div className="flex justify-center gap-2 pt-4">
            {images.map((_, idx) => (
              <div
                key={idx}
                className={`h-1 rounded-full transition-all duration-500 ${
                  idx === currentImage ? "w-8 bg-primary" : "w-2 bg-white/30"
                }`}
              />
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}

function ProfileCard({ 
  profile, 
  index,
  total,
  onSwipe, 
  isTop 
}: { 
  profile: Profile; 
  index: number;
  total: number;
  onSwipe: (direction: "left" | "right") => void;
  isTop: boolean;
}) {
  const [, setLocation] = useLocation();
  const [exitX, setExitX] = useState(0);

  const handleDragEnd = (_: any, info: PanInfo) => {
    if (Math.abs(info.offset.x) > 120) {
      setExitX(info.offset.x > 0 ? 400 : -400);
      onSwipe(info.offset.x > 0 ? "right" : "left");
    }
  };

  const handleViewProfile = () => {
    setLocation(`/profile/${profile.id}`);
  };

  const stackOffset = Math.min(index, 2);
  const scale = 1 - stackOffset * 0.05;
  const yOffset = stackOffset * 12;
  const opacity = 1 - stackOffset * 0.2;

  return (
    <motion.div
      className="absolute inset-0 swipe-card"
      style={{ 
        zIndex: total - index,
        transformOrigin: "center bottom"
      }}
      drag={isTop ? "x" : false}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.9}
      onDragEnd={handleDragEnd}
      initial={{ 
        scale: scale, 
        y: yOffset,
        opacity: opacity,
      }}
      animate={{ 
        scale: isTop ? 1 : scale, 
        y: isTop ? 0 : yOffset,
        opacity: isTop ? 1 : opacity,
        rotateZ: 0,
      }}
      exit={{ 
        x: exitX, 
        opacity: 0, 
        rotateZ: exitX > 0 ? 20 : -20,
        transition: { duration: 0.4, ease: "easeOut" }
      }}
      transition={{ type: "spring", stiffness: 260, damping: 26 }}
      whileDrag={{ 
        cursor: "grabbing",
        scale: 1.02,
      }}
    >
      <div 
        className="relative w-full h-full rounded-3xl overflow-hidden card-shadow cursor-pointer"
        onClick={isTop ? handleViewProfile : undefined}
        data-testid={`card-profile-${profile.id}`}
      >
        <img
          src={profile.photoUrl}
          alt={profile.pseudo}
          className="absolute inset-0 w-full h-full object-cover"
          draggable={false}
        />
        
        <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/30 to-transparent" />
        
        <div className="absolute top-5 left-5 right-5 flex items-center justify-between">
          {profile.verified && (
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
              className="flex items-center gap-2 px-4 py-2 rounded-full glass-light border border-white/10"
            >
              <BadgeCheck className="w-4 h-4 text-primary" />
              <span className="text-xs font-medium text-white">Profil Vérifié</span>
            </motion.div>
          )}
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
            className="flex items-center gap-2 px-4 py-2 rounded-full glass-light border border-white/10 ml-auto"
          >
            <Sparkles className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-medium text-white">En ligne</span>
          </motion.div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-6">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="space-y-4"
          >
            <div className="flex items-end gap-3">
              <h2 className="text-4xl font-bold text-white tracking-tight" data-testid={`text-pseudo-${profile.id}`}>
                {profile.pseudo}
              </h2>
              <span className="text-2xl text-white/70 font-light pb-0.5">{profile.age}</span>
            </div>

            <div className="flex items-center gap-5 text-white/70">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                <span className="text-sm font-medium" data-testid={`text-ville-${profile.id}`}>{profile.ville}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                <span className="text-sm font-medium">{profile.disponibilite.date}</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {profile.services.map((service) => (
                <span 
                  key={service}
                  className="px-4 py-1.5 rounded-full text-xs font-medium bg-white/10 text-white/90 border border-white/10"
                >
                  {service}
                </span>
              ))}
              <span className="px-4 py-1.5 rounded-full text-xs font-bold bg-primary text-white">
                {profile.tarif}
              </span>
            </div>

            {isTop && (
              <motion.div 
                className="flex items-center justify-center gap-2 text-white/40 pt-2"
                animate={{ y: [0, 8, 0] }}
                transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
              >
                <ChevronDown className="w-5 h-5" />
                <span className="text-xs font-medium">Glissez pour voir plus</span>
              </motion.div>
            )}
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}

export default function Home() {
  const [showSplash, setShowSplash] = useState(true);
  const [profiles, setProfiles] = useState(mockProfiles);
  const [, setLocation] = useLocation();

  const handleSwipe = (direction: "left" | "right") => {
    setTimeout(() => {
      setProfiles((prev) => prev.slice(1));
    }, 300);
  };

  const handleAction = (action: "pass" | "like" | "message") => {
    if (action === "message" && profiles[0]) {
      setLocation(`/profile/${profiles[0].id}`);
    } else {
      handleSwipe(action === "like" ? "right" : "left");
    }
  };

  if (showSplash) {
    return <SplashScreen onEnter={() => setShowSplash(false)} />;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="flex items-center justify-between px-6 py-4 relative z-20">
        <h1 className="text-2xl font-bold text-gradient" data-testid="text-logo">
          Djantrah
        </h1>
        <Button 
          variant="ghost" 
          size="sm"
          className="text-muted-foreground hover:text-foreground font-medium"
          onClick={() => setLocation("/signup")}
          data-testid="button-signup"
        >
          S'inscrire
        </Button>
      </header>

      <main className="flex-1 relative overflow-hidden px-4 pb-4">
        <div className="relative h-full">
          <AnimatePresence mode="popLayout">
            {profiles.length > 0 ? (
              profiles.slice(0, 3).map((profile, index) => (
                <ProfileCard
                  key={profile.id}
                  profile={profile}
                  index={index}
                  total={Math.min(profiles.length, 3)}
                  onSwipe={handleSwipe}
                  isTop={index === 0}
                />
              ))
            ) : (
              <motion.div 
                className="absolute inset-0 flex items-center justify-center"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
              >
                <div className="text-center space-y-5">
                  <div className="w-24 h-24 mx-auto rounded-full bg-muted/50 flex items-center justify-center">
                    <Heart className="w-12 h-12 text-primary/50" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-2xl font-semibold text-foreground">Plus de profils</h3>
                    <p className="text-muted-foreground text-sm max-w-xs mx-auto">
                      Revenez plus tard pour découvrir de nouveaux profils exclusifs
                    </p>
                  </div>
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
        </div>
      </main>

      {profiles.length > 0 && (
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="relative z-20 px-6 pb-8 pt-4"
        >
          <div className="flex items-center justify-center gap-8">
            <motion.button
              whileHover={{ scale: 1.15 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => handleAction("pass")}
              className="w-16 h-16 rounded-full bg-card border border-border flex items-center justify-center shadow-xl"
              data-testid="button-pass"
            >
              <X className="w-7 h-7 text-muted-foreground" />
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.15 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => handleAction("like")}
              className="w-20 h-20 rounded-full bg-primary flex items-center justify-center shadow-xl animate-pulse-glow"
              data-testid="button-like"
            >
              <Heart className="w-9 h-9 text-white" fill="white" />
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.15 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => handleAction("message")}
              className="w-16 h-16 rounded-full bg-card border border-border flex items-center justify-center shadow-xl"
              data-testid="button-message"
            >
              <MessageCircle className="w-7 h-7 text-primary" />
            </motion.button>
          </div>
        </motion.div>
      )}
    </div>
  );
}