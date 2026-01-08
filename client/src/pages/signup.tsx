import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { ArrowLeft, ArrowRight, User, Calendar, MapPin, Lock, Camera, Check, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";

type Gender = "homme" | "femme" | null;

interface FormData {
  gender: Gender;
  age: string;
  ville: string;
  pseudo: string;
  password: string;
  photo: string | null;
}

const steps = [
  { id: 1, title: "Genre", icon: User },
  { id: 2, title: "Profil", icon: Calendar },
  { id: 3, title: "Compte", icon: Lock },
  { id: 4, title: "Photo", icon: Camera },
];

export default function Signup() {
  const [, setLocation] = useLocation();
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<FormData>({
    gender: null,
    age: "",
    ville: "",
    pseudo: "",
    password: "",
    photo: null,
  });
  const [ageConfirmed, setAgeConfirmed] = useState(false);

  const progress = (currentStep / steps.length) * 100;

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return formData.gender !== null && ageConfirmed;
      case 2:
        return formData.age && formData.ville;
      case 3:
        return formData.pseudo && formData.password.length >= 6;
      case 4:
        return formData.photo !== null;
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (currentStep < 4) {
      setCurrentStep(currentStep + 1);
    } else {
      setLocation("/");
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    } else {
      setLocation("/");
    }
  };

  const handlePhotoUpload = () => {
    setFormData({ ...formData, photo: "https://via.placeholder.com/400" });
  };

  const slideVariants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 300 : -300,
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (direction: number) => ({
      x: direction < 0 ? 300 : -300,
      opacity: 0,
    }),
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="flex items-center justify-between px-6 py-4">
        <button 
          onClick={handleBack}
          className="w-10 h-10 rounded-full bg-card flex items-center justify-center"
          data-testid="button-back-signup"
        >
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>
        <h1 className="font-display text-xl font-semibold text-gradient">Djantrah</h1>
        <div className="w-10" />
      </header>

      <div className="px-6 py-2">
        <Progress value={progress} className="h-1" />
        <div className="flex justify-between mt-3">
          {steps.map((step) => (
            <div 
              key={step.id}
              className={`flex items-center gap-1.5 ${
                currentStep >= step.id ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <step.icon className="w-4 h-4" />
              <span className="text-xs hidden sm:inline">{step.title}</span>
            </div>
          ))}
        </div>
      </div>

      <main className="flex-1 px-6 py-8 overflow-hidden">
        <AnimatePresence mode="wait" custom={1}>
          {currentStep === 1 && (
            <motion.div
              key="step1"
              custom={1}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="space-y-8"
            >
              <div className="text-center space-y-2">
                <h2 className="font-display text-3xl font-semibold text-foreground">
                  Bienvenue
                </h2>
                <p className="text-muted-foreground">
                  Choisissez votre profil pour commencer
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setFormData({ ...formData, gender: "femme" })}
                  className={`p-6 rounded-2xl border-2 transition-all ${
                    formData.gender === "femme"
                      ? "border-primary bg-primary/10"
                      : "border-border bg-card hover:border-primary/50"
                  }`}
                  data-testid="button-gender-femme"
                >
                  <div className="text-4xl mb-2">👩</div>
                  <span className="font-medium text-foreground">Femme</span>
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setFormData({ ...formData, gender: "homme" })}
                  className={`p-6 rounded-2xl border-2 transition-all ${
                    formData.gender === "homme"
                      ? "border-primary bg-primary/10"
                      : "border-border bg-card hover:border-primary/50"
                  }`}
                  data-testid="button-gender-homme"
                >
                  <div className="text-4xl mb-2">👨</div>
                  <span className="font-medium text-foreground">Homme</span>
                </motion.button>
              </div>

              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={() => setAgeConfirmed(!ageConfirmed)}
                className={`w-full p-4 rounded-2xl border-2 flex items-center gap-3 transition-all ${
                  ageConfirmed
                    ? "border-primary bg-primary/10"
                    : "border-border bg-card"
                }`}
                data-testid="button-age-confirm"
              >
                <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center ${
                  ageConfirmed ? "border-primary bg-primary" : "border-muted-foreground"
                }`}>
                  {ageConfirmed && <Check className="w-4 h-4 text-white" />}
                </div>
                <div className="flex-1 text-left">
                  <span className="text-foreground font-medium">Je confirme avoir +18 ans</span>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Plateforme réservée aux adultes
                  </p>
                </div>
                <Shield className="w-5 h-5 text-primary" />
              </motion.button>
            </motion.div>
          )}

          {currentStep === 2 && (
            <motion.div
              key="step2"
              custom={1}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="space-y-8"
            >
              <div className="text-center space-y-2">
                <h2 className="font-display text-3xl font-semibold text-foreground">
                  Votre profil
                </h2>
                <p className="text-muted-foreground">
                  Quelques informations de base
                </p>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="age" className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    Âge
                  </Label>
                  <Input
                    id="age"
                    type="number"
                    min="18"
                    max="99"
                    placeholder="Votre âge"
                    value={formData.age}
                    onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                    className="h-14 text-lg"
                    data-testid="input-age"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ville" className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-muted-foreground" />
                    Ville
                  </Label>
                  <Input
                    id="ville"
                    type="text"
                    placeholder="Votre ville"
                    value={formData.ville}
                    onChange={(e) => setFormData({ ...formData, ville: e.target.value })}
                    className="h-14 text-lg"
                    data-testid="input-ville"
                  />
                </div>
              </div>
            </motion.div>
          )}

          {currentStep === 3 && (
            <motion.div
              key="step3"
              custom={1}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="space-y-8"
            >
              <div className="text-center space-y-2">
                <h2 className="font-display text-3xl font-semibold text-foreground">
                  Votre compte
                </h2>
                <p className="text-muted-foreground">
                  Créez votre identité anonyme
                </p>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="pseudo" className="flex items-center gap-2">
                    <User className="w-4 h-4 text-muted-foreground" />
                    Pseudo
                  </Label>
                  <Input
                    id="pseudo"
                    type="text"
                    placeholder="Choisissez un pseudo"
                    value={formData.pseudo}
                    onChange={(e) => setFormData({ ...formData, pseudo: e.target.value })}
                    className="h-14 text-lg"
                    data-testid="input-pseudo"
                  />
                  <p className="text-xs text-muted-foreground">
                    Ce nom sera visible publiquement
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" className="flex items-center gap-2">
                    <Lock className="w-4 h-4 text-muted-foreground" />
                    Mot de passe
                  </Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Minimum 6 caractères"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="h-14 text-lg"
                    data-testid="input-password"
                  />
                </div>
              </div>
            </motion.div>
          )}

          {currentStep === 4 && (
            <motion.div
              key="step4"
              custom={1}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="space-y-8"
            >
              <div className="text-center space-y-2">
                <h2 className="font-display text-3xl font-semibold text-foreground">
                  Votre photo
                </h2>
                <p className="text-muted-foreground">
                  Ajoutez votre photo principale
                </p>
              </div>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handlePhotoUpload}
                className={`w-full aspect-[3/4] rounded-3xl border-2 border-dashed flex flex-col items-center justify-center transition-all ${
                  formData.photo
                    ? "border-primary bg-primary/5"
                    : "border-border bg-card hover:border-primary/50"
                }`}
                data-testid="button-upload-photo"
              >
                {formData.photo ? (
                  <div className="relative w-full h-full">
                    <img
                      src={formData.photo}
                      alt="Preview"
                      className="w-full h-full object-cover rounded-3xl"
                    />
                    <div className="absolute inset-0 bg-black/40 rounded-3xl flex items-center justify-center">
                      <div className="text-center">
                        <Check className="w-12 h-12 text-primary mx-auto mb-2" />
                        <span className="text-white font-medium">Photo ajoutée</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <Camera className="w-16 h-16 text-muted-foreground mb-4" />
                    <span className="text-foreground font-medium">Ajouter une photo</span>
                    <span className="text-sm text-muted-foreground mt-1">
                      Cliquez pour sélectionner
                    </span>
                  </>
                )}
              </motion.button>

              <p className="text-xs text-center text-muted-foreground">
                Votre photo sera vérifiée avant publication
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <div className="px-6 pb-8 pt-4">
        <Button
          onClick={handleNext}
          disabled={!canProceed()}
          className="w-full h-14 text-base font-medium gap-2"
          data-testid="button-next"
        >
          {currentStep === 4 ? "Créer mon profil" : "Continuer"}
          <ArrowRight className="w-5 h-5" />
        </Button>
      </div>
    </div>
  );
}