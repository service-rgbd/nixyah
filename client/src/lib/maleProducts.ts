import poutoulouImg from "@assets/poutoulou.png";
import vitamaxTeaImg from "@assets/the-vitamax.png";
import vitamaxCoffeeImg from "@assets/cafe-vitamax.png";
import skynPreservatifImg from "@assets/Skyn preservatif.jpg";
import lubrifiantImg from "@assets/lubrifiant.jpg";
import preservatifManixImg from "@assets/preservatifmanix.jpg";
import sextoysImg from "@assets/sextoys.jpg";
import coupletsSextoysImg from "@assets/coupletssextoys.jpg";
import resiMeublmeeImg from "@assets/resi-meublmee.jpg";

export type MaleProduct = {
  id: string;
  name: string;
  subtitle: string;
  price: string;
  size: string;
  description: string;
  imageUrl: string;
  tag: string;
};

export const maleProducts: MaleProduct[] = [
  {
    id: "poutoulou-original",
    name: "Poutoulou – Poudre l’Original",
    subtitle: "Poudre naturelle pour l’endurance masculine",
    price: "5 000 CFA",
    size: "10 g",
    description:
      "Formule 100 % naturelle pensée pour soutenir l’endurance, l’équilibre et la vitalité masculine.",
    imageUrl: poutoulouImg,
    tag: "Endurance • Naturel",
  },
  {
    id: "vitamax-energy-tea",
    name: "Vitamax Doubleshot – Energy Tea",
    subtitle: "Infusion tonique pour l’énergie et la récupération",
    price: "25 000 CFA",
    size: "10 sachets x 20 g",
    description:
      "Mélange de plantes bio pour réveiller l’énergie, aider à la circulation et accompagner les longues nuits.",
    imageUrl: vitamaxTeaImg,
    tag: "Thé énergie",
  },
  {
    id: "vitamax-energy-coffee",
    name: "Vitamax Doubleshot – Energy Coffee",
    subtitle: "Café énergisant pour les moments intenses",
    price: "25 000 CFA",
    size: "10 sachets x 20 g",
    description:
      "Café instantané bio enrichi, pour un coup de boost rapide avant ou après vos rendez‑vous.",
    imageUrl: vitamaxCoffeeImg,
    tag: "Café énergie",
  },
  {
    id: "premium-condoms",
    name: "Préservatifs Premium Nuit Intense",
    subtitle: "Boîte de préservatifs ultra fins, lubrifiés",
    price: "6 500 CFA",
    size: "12 pièces",
    description:
      "Préservatifs premium très fins (Skyn, Durex, Manix…), confort maximum et sécurité renforcée pour des nuits plus longues.",
    imageUrl: skynPreservatifImg,
    tag: "Protection",
  },
  {
    id: "massage-oil",
    name: "Huile de massage chaude",
    subtitle: "Huile de massage parfumée pour le corps",
    price: "7 000 CFA",
    size: "150 ml",
    description:
      "Huile de massage soyeuse, parfum discret, idéale pour les moments à deux et les massages prolongés.",
    imageUrl: resiMeublmeeImg,
    tag: "Massage",
  },
  {
    id: "intimate-lube",
    name: "Lubrifiant intime soyeux",
    subtitle: "Lubrifiant longue durée, compatible préservatifs",
    price: "5 500 CFA",
    size: "100 ml",
    description:
      "Textures soyeuses, non collantes (classiques, Manix…), pour plus de confort et de douceur pendant vos rencontres.",
    imageUrl: lubrifiantImg,
    tag: "Confort",
  },
  {
    id: "couple-kit",
    name: "Kit intime pour couples",
    subtitle: "Coffret découverte (accessoires & bien‑être)",
    price: "19 500 CFA",
    size: "Coffret complet",
    description:
      "Sélection d’accessoires doux et discrets pour couples (toys, huiles, préservatifs), pensée pour explorer sans vulgarité.",
    imageUrl: coupletsSextoysImg,
    tag: "Couple",
  },
  {
    id: "vibrating-ring",
    name: "Anneau vibrant premium",
    subtitle: "Stimulation douce pour lui & pour elle",
    price: "14 000 CFA",
    size: "1 unité",
    description:
      "Anneau vibrant conçu pour prolonger le plaisir et intensifier les sensations à deux.",
    imageUrl: preservatifManixImg,
    tag: "Accessoire",
  },
  {
    id: "relax-toy",
    name: "Sextoy relax massage",
    subtitle: "Accessoire doux pour massage ciblé",
    price: "16 000 CFA",
    size: "1 unité",
    description:
      "Design doux, silencieux et discret, idéal pour les préliminaires ou les moments de détente personnelle.",
    imageUrl: sextoysImg,
    tag: "Relax",
  },
];

export const adultProducts = maleProducts;


