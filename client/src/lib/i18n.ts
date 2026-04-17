import { useAppSettings } from "@/lib/appSettings";

type Lang = "fr" | "en";

const dict: Record<Lang, Record<string, string>> = {
  fr: {
    next: "Suivant",
    contact: "Contacter",
    viewProfile: "Voir le profil",
    signup: "S'inscrire",
    signIn: "Connexion",
    mySpace: "Mon espace",
    settings: "Paramètres",
    cookiesTitle: "Cookies",
    cookiesText: "Nous utilisons des cookies pour améliorer votre expérience.",
    accept: "Accepter",
    continue: "Continuer",
    explore: "Explorer",
    dashboard: "Dashboard",
    proOnly: "Afficher uniquement les pros",
    proOnlyDescription: "Afficher seulement les profils “pro”.",
    verifiedOnly: "Profils vérifiés uniquement",
    verifiedOnlyDescription: "N’afficher que les profils vérifiés.",
    vipOnly: "Salon VIP",
    vipOnlyDescription: "Découvrir uniquement les profils VIP.",
    language: "Langue",
    theme: "Thème",
    light: "Clair",
    dark: "Sombre",
    showProfile: "Afficher mon profil",
    reduceMotion: "Réduire les animations",
    reduceMotionDescription: "Limiter les effets pour un scroll plus stable.",
    resetSettings: "Réinitialiser les paramètres",
  },
  en: {
    next: "Next",
    contact: "Contact",
    viewProfile: "View profile",
    signup: "Sign up",
    signIn: "Sign in",
    mySpace: "My space",
    settings: "Settings",
    cookiesTitle: "Cookies",
    cookiesText: "We use cookies to improve your experience.",
    accept: "Accept",
    continue: "Continue",
    explore: "Explore",
    dashboard: "Dashboard",
    proOnly: "Show pros only",
    proOnlyDescription: "Only show “pro” profiles.",
    verifiedOnly: "Verified profiles only",
    verifiedOnlyDescription: "Only show verified profiles.",
    vipOnly: "VIP lounge",
    vipOnlyDescription: "Only show VIP profiles.",
    language: "Language",
    theme: "Theme",
    light: "Light",
    dark: "Dark",
    showProfile: "Show my profile",
    reduceMotion: "Reduce motion",
    reduceMotionDescription: "Limit effects for a steadier scroll.",
    resetSettings: "Reset settings",
  },
};

export function useT() {
  const [settings] = useAppSettings();
  const lang = (settings.language ?? "fr") as Lang;

  return (key: string) => dict[lang][key] ?? dict.fr[key] ?? key;
}

export function useI18n() {
  const [settings] = useAppSettings();
  const lang = (settings.language ?? "fr") as Lang;
  const t = (key: string) => dict[lang][key] ?? dict.fr[key] ?? key;
  return { lang, t };
}


