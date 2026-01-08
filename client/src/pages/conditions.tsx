import { useState } from "react";
import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { 
  Shield, 
  Eye, 
  UserCheck, 
  MessageSquare, 
  AlertTriangle, 
  Lock, 
  Scale, 
  CheckCircle2,
  ChevronRight,
  Users,
  Heart,
  BadgeCheck,
  Clock,
  MapPin
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";

const features = [
  {
    icon: Eye,
    title: "Découvrez des profils exclusifs",
    description: "Parcourez des profils vérifiés avec photos et vidéos. Chaque profil est validé par notre équipe de modération."
  },
  {
    icon: Shield,
    title: "Anonymat garanti",
    description: "Votre identité réelle reste confidentielle. Utilisez un pseudonyme et communiquez en toute discrétion."
  },
  {
    icon: MessageSquare,
    title: "Contact direct et sécurisé",
    description: "Échangez via notre messagerie interne. Aucun numéro de téléphone ou email n'est exposé publiquement."
  },
  {
    icon: UserCheck,
    title: "Profils vérifiés",
    description: "Badge de vérification pour les profils authentifiés. Photos et vidéos validées manuellement."
  },
  {
    icon: Clock,
    title: "Disponibilités en temps réel",
    description: "Consultez les disponibilités, horaires et durées proposées par chaque profil."
  },
  {
    icon: MapPin,
    title: "Géolocalisation discrète",
    description: "Trouvez des profils près de chez vous sans jamais révéler votre position exacte."
  }
];

const conditions = [
  {
    id: "age",
    title: "Majorité légale",
    content: "Je certifie avoir 18 ans révolus ou l'âge de la majorité légale dans mon pays de résidence. L'accès à ce site est strictement interdit aux mineurs. Tout accès frauduleux engage ma responsabilité civile et pénale.",
    required: true
  },
  {
    id: "responsibility",
    title: "Responsabilité individuelle",
    content: "Je comprends que Djantrah.com est une plateforme de mise en relation uniquement. La plateforme n'est pas responsable des interactions entre utilisateurs. Je m'engage à faire preuve de discernement et de prudence dans mes échanges et rencontres.",
    required: true
  },
  {
    id: "identity",
    title: "Identité des membres",
    content: "Je reconnais que Djantrah.com ne peut garantir l'identité réelle des membres. Les profils sont anonymes et utilisent des pseudonymes. Je m'engage à vérifier par moi-même l'authenticité de mes interlocuteurs avant toute rencontre.",
    required: true
  },
  {
    id: "content",
    title: "Contenu approprié",
    content: "Je m'engage à ne publier que du contenu dont je suis propriétaire ou pour lequel j'ai les droits. Je ne publierai pas de contenu illégal, diffamatoire, ou portant atteinte aux droits d'autrui. Je comprends que tout contenu est soumis à modération.",
    required: true
  },
  {
    id: "safety",
    title: "Sécurité personnelle",
    content: "Je m'engage à prendre toutes les précautions nécessaires lors de mes rencontres : informer un proche, choisir des lieux publics ou sécurisés, et faire preuve de vigilance. Djantrah.com recommande la prudence en toutes circonstances.",
    required: true
  },
  {
    id: "data",
    title: "Protection des données",
    content: "J'accepte que mes données personnelles soient traitées conformément à la politique de confidentialité de Djantrah.com. Je peux exercer mes droits d'accès, de rectification et de suppression à tout moment.",
    required: true
  },
  {
    id: "terms",
    title: "Conditions générales",
    content: "J'accepte les conditions générales d'utilisation de Djantrah.com dans leur intégralité. Je reconnais avoir lu et compris l'ensemble des règles régissant l'utilisation de la plateforme.",
    required: true
  }
];

export default function Conditions() {
  const [, setLocation] = useLocation();
  const [acceptedConditions, setAcceptedConditions] = useState<Set<string>>(new Set());
  const [showConditions, setShowConditions] = useState(false);

  const allAccepted = conditions.filter(c => c.required).every(c => acceptedConditions.has(c.id));

  const toggleCondition = (id: string) => {
    const newSet = new Set(acceptedConditions);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setAcceptedConditions(newSet);
  };

  const handleAccept = () => {
    if (allAccepted) {
      setLocation("/explore");
    }
  };

  const handleRefuse = () => {
    window.location.href = "https://www.google.com";
  };

  if (!showConditions) {
    return (
      <div className="min-h-screen bg-background">
        <header className="flex items-center justify-between px-6 py-4">
          <h1 className="text-2xl font-bold text-gradient">Djantrah</h1>
        </header>

        <main className="px-6 pb-32">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-8"
          >
            <div className="text-center space-y-4 py-8">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: "spring" }}
                className="w-20 h-20 mx-auto rounded-full bg-primary/20 flex items-center justify-center"
              >
                <Heart className="w-10 h-10 text-primary" />
              </motion.div>
              <h2 className="text-3xl font-bold text-foreground">
                Comment ça marche ?
              </h2>
              <p className="text-muted-foreground max-w-sm mx-auto">
                Découvrez une nouvelle façon de créer des connexions authentiques et discrètes
              </p>
            </div>

            <div className="space-y-4">
              {features.map((feature, index) => (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 * index }}
                  className="flex gap-4 p-4 rounded-2xl bg-card border border-border"
                >
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <feature.icon className="w-6 h-6 text-primary" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="font-semibold text-foreground">{feature.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {feature.description}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="p-6 rounded-2xl bg-muted/30 border border-border space-y-4"
            >
              <div className="flex items-center gap-3">
                <Scale className="w-6 h-6 text-primary" />
                <h3 className="font-semibold text-foreground">Nos valeurs</h3>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  <span>Anonymat total</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  <span>Profils vérifiés</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  <span>Contact direct</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  <span>100% mobile</span>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </main>

        <div className="fixed bottom-0 left-0 right-0 p-6 glass border-t border-white/10">
          <Button
            onClick={() => setShowConditions(true)}
            className="w-full h-14 text-base font-semibold gap-2"
            data-testid="button-continue-conditions"
          >
            Continuer
            <ChevronRight className="w-5 h-5" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between px-6 py-4 border-b border-border">
        <h1 className="text-2xl font-bold text-gradient">Djantrah</h1>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Lock className="w-4 h-4" />
          <span>Conditions d'utilisation</span>
        </div>
      </header>

      <main className="pb-40">
        <div className="px-6 py-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
              <Scale className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">
                Conditions d'utilisation
              </h2>
              <p className="text-sm text-muted-foreground">
                Veuillez lire et accepter chaque condition
              </p>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-amber-500">Important</p>
                <p className="text-xs text-muted-foreground">
                  Vous devez accepter toutes les conditions obligatoires pour accéder à la plateforme. 
                  Le refus entraînera une redirection immédiate.
                </p>
              </div>
            </div>
          </div>
        </div>

        <ScrollArea className="h-[calc(100vh-380px)]">
          <div className="px-6 space-y-4">
            {conditions.map((condition, index) => (
              <motion.div
                key={condition.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className={`p-4 rounded-2xl border transition-all ${
                  acceptedConditions.has(condition.id)
                    ? "bg-primary/5 border-primary/30"
                    : "bg-card border-border"
                }`}
              >
                <div className="flex items-start gap-4">
                  <Checkbox
                    id={condition.id}
                    checked={acceptedConditions.has(condition.id)}
                    onCheckedChange={() => toggleCondition(condition.id)}
                    className="mt-1"
                    data-testid={`checkbox-${condition.id}`}
                  />
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center justify-between">
                      <label
                        htmlFor={condition.id}
                        className="font-semibold text-foreground cursor-pointer"
                      >
                        {condition.title}
                      </label>
                      {condition.required && (
                        <span className="text-xs text-primary font-medium">Obligatoire</span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {condition.content}
                    </p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </ScrollArea>

        <div className="px-6 py-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {acceptedConditions.size} / {conditions.length} conditions acceptées
            </span>
            {allAccepted && (
              <span className="text-emerald-500 font-medium flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" />
                Complet
              </span>
            )}
          </div>
        </div>
      </main>

      <div className="fixed bottom-0 left-0 right-0 p-6 glass border-t border-white/10">
        <div className="space-y-3">
          <Button
            onClick={handleAccept}
            disabled={!allAccepted}
            className="w-full h-14 text-base font-semibold gap-2"
            data-testid="button-accept-all"
          >
            <BadgeCheck className="w-5 h-5" />
            J'accepte toutes les conditions
          </Button>
          
          <Button
            onClick={handleRefuse}
            variant="outline"
            className="w-full h-12 text-base text-muted-foreground"
            data-testid="button-refuse-all"
          >
            Je refuse - Quitter le site
          </Button>
        </div>
      </div>
    </div>
  );
}