import { db } from "@workspace/db";
import { usersTable, chefProfilesTable, dishesTable, storiesTable, commerceProductsTable, commerceStoresTable } from "@workspace/db/schema";
import { hashPassword } from "./lib/auth.js";

const CHEFS = [
  {
    name: "Ama Coulibaly",
    email: "ama@nixyah.ci",
    phone: "+22507000001",
    coverColor: "#C4522A",
    specialty: "Cuisine Ivoirienne",
    location: "Cocody, Abidjan",
    zone: "Cocody, Riviera, Plateau",
    bio: "Cuisinière passionnée depuis 15 ans, spécialiste de la cuisine traditionnelle ivoirienne. Je prépare avec amour les plats que nos mamans nous ont appris.",
    priceRange: "2 000 – 8 000 FCFA",
    rating: 4.9,
    reviewCount: 124,
    specialties: ["Attiéké", "Kedjenou", "Sauce graine"],
    dishes: [
      { name: "Kedjenou de poulet", description: "Poulet fermier mijoté aux épices dans une canari", price: 4500, category: "Plats Principaux", prepTime: "45 min", isPopular: true },
      { name: "Attiéké poisson braisé", description: "Attiéké frais avec poisson braisé, oignons et piments", price: 2500, category: "Plats Principaux", prepTime: "30 min", isPopular: true },
      { name: "Sauce graine riz", description: "Sauce à base de noix de palme avec riz blanc", price: 3000, category: "Plats Principaux", prepTime: "60 min", isPopular: false },
      { name: "Aloco", description: "Banane plantain frite dorée, croustillante", price: 1000, category: "Accompagnements", prepTime: "15 min", isPopular: true },
    ],
    stories: [
      { caption: "Mon kedjenou du weekend 🔥 Réservez maintenant!", dishName: "Kedjenou de poulet", price: 4500, emoji: "🍗", bgColor: "#C4522A" },
    ],
  },
  {
    name: "Fatou Diallo",
    email: "fatou@nixyah.ci",
    phone: "+22507000002",
    coverColor: "#8B5CF6",
    specialty: "Cuisine Sénégalaise",
    location: "Yopougon, Abidjan",
    zone: "Yopougon, Abobo, Attécoubé",
    bio: "Originaire de Dakar, je partage les saveurs du Sénégal à Abidjan depuis 8 ans. Mon thiébou dieun est légendaire dans le quartier!",
    priceRange: "3 000 – 12 000 FCFA",
    rating: 4.8,
    reviewCount: 89,
    specialties: ["Thiébou dieun", "Yassa", "Mafé"],
    dishes: [
      { name: "Thiébou dieun", description: "Le plat national sénégalais — riz au poisson, légumes, tamarin", price: 5000, category: "Plats Principaux", prepTime: "90 min", isPopular: true },
      { name: "Yassa poulet", description: "Poulet mariné aux citrons et oignons confits", price: 4000, category: "Plats Principaux", prepTime: "60 min", isPopular: true },
      { name: "Mafé bœuf", description: "Ragoût de bœuf à la pâte d'arachide avec légumes", price: 4500, category: "Plats Principaux", prepTime: "75 min", isPopular: false },
    ],
    stories: [
      { caption: "Thiébou dieun frais du jour 🐟 Livraison possible!", dishName: "Thiébou dieun", price: 5000, emoji: "🐟", bgColor: "#8B5CF6" },
    ],
  },
  {
    name: "Marie-Claire Bah",
    email: "marie@nixyah.ci",
    phone: "+22507000003",
    coverColor: "#059669",
    specialty: "Traiteur & Événements",
    location: "Marcory, Abidjan",
    zone: "Marcory, Koumassi, Treichville",
    bio: "Traiteur professionnelle pour mariages, baptêmes et anniversaires. Plus de 200 événements organisés. La qualité avant tout!",
    priceRange: "3 000 – 15 000 FCFA",
    rating: 5.0,
    reviewCount: 203,
    specialties: ["Buffets", "Traiteur événement", "Cuisine fusion"],
    dishes: [
      { name: "Buffet mariage (par pers.)", description: "Menu complet avec entrée, plat, dessert pour événements", price: 15000, category: "Événements", prepTime: "Sur commande", isPopular: true },
      { name: "Fufu soupe de veau", description: "Fufu traditionnel avec soupe de veau aux épices", price: 5000, category: "Plats Principaux", prepTime: "60 min", isPopular: true },
      { name: "Riz gras", description: "Riz cuit dans la sauce tomate avec viande et légumes", price: 3500, category: "Plats Principaux", prepTime: "45 min", isPopular: false },
    ],
    stories: [],
  },
  {
    name: "Adjoa Mensah",
    email: "adjoa@nixyah.ci",
    phone: "+22507000004",
    coverColor: "#D97706",
    specialty: "Pâtisserie & Desserts",
    location: "Angré, Abidjan",
    zone: "Angré, Cocody, Riviera",
    bio: "Pâtissière formée à Paris, je crée des gâteaux personnalisés et desserts africains réinventés. Commandez vos gâteaux 48h à l'avance.",
    priceRange: "5 000 – 50 000 FCFA",
    rating: 4.7,
    reviewCount: 56,
    specialties: ["Gâteaux", "Pâtisserie", "Desserts africains"],
    dishes: [
      { name: "Gâteau anniversaire personnalisé", description: "Gâteau sur mesure pour vos occasions spéciales", price: 25000, category: "Pâtisserie", prepTime: "48h", isPopular: true },
      { name: "Beignets soufflés au miel", description: "Beignets moelleux nappés de miel et sésame", price: 2000, category: "Desserts", prepTime: "30 min", isPopular: true },
      { name: "Cake manioc noix de coco", description: "Cake traditionnel à base de manioc et noix de coco", price: 5000, category: "Pâtisserie", prepTime: "60 min", isPopular: false },
    ],
    stories: [
      { caption: "Nouveau gâteau manioc-coco 🥥 Commandez maintenant!", dishName: "Cake manioc noix de coco", price: 5000, emoji: "🎂", bgColor: "#D97706" },
    ],
  },
  {
    name: "Sophie Gnahoré",
    email: "sophie@nixyah.ci",
    phone: "+22507000005",
    coverColor: "#DC2626",
    specialty: "Cuisine de Brousse",
    location: "Plateau, Abidjan",
    zone: "Plateau, Adjamé, Treichville",
    bio: "Spécialiste des plats du terroir ivoirien méconnus. Je cuisine les recettes de nos grands-mères avec les ingrédients du village.",
    priceRange: "2 500 – 10 000 FCFA",
    rating: 4.9,
    reviewCount: 78,
    specialties: ["Plats du terroir", "Cuisine brousse", "Épices locales"],
    dishes: [
      { name: "Garba", description: "Attiéké thon frit avec légumes pimentés — plat de rue iconic", price: 1500, category: "Plats Populaires", prepTime: "20 min", isPopular: true },
      { name: "Sauce feuille", description: "Sauce aux feuilles de manioc, poisson fumé et palme", price: 3500, category: "Plats Principaux", prepTime: "90 min", isPopular: true },
      { name: "Klui klui", description: "Beignets d'arachide croustillants, collation traditionnelle", price: 500, category: "Snacks", prepTime: "30 min", isPopular: false },
    ],
    stories: [
      { caption: "Garba tout chaud disponible 🌶️ Venez ou faites livrer!", dishName: "Garba", price: 1500, emoji: "🌶️", bgColor: "#DC2626" },
      { caption: "Sauce feuille de grand-mère prête! 🌿", dishName: "Sauce feuille", price: 3500, emoji: "🌿", bgColor: "#059669" },
    ],
  },
  {
    name: "Reine Konaté",
    email: "reine@nixyah.ci",
    phone: "+22507000006",
    coverColor: "#BE185D",
    specialty: "Cuisine Dioulabougou",
    location: "Abobo, Abidjan",
    zone: "Abobo, Yopougon, Attécoubé",
    bio: "Cuisine du Nord de la Côte d'Ivoire et du Mali. Mes plats sont généreux et parfumés. Grande spécialiste du tô et du babenda.",
    priceRange: "1 500 – 7 000 FCFA",
    rating: 4.6,
    reviewCount: 44,
    specialties: ["Cuisine nordiste", "Tô", "Babenda"],
    dishes: [
      { name: "Tô avec sauce gombo", description: "Pâte de mil avec sauce gombo au poisson fumé", price: 2000, category: "Plats Principaux", prepTime: "45 min", isPopular: true },
      { name: "Babenda", description: "Feuilles de haricot séchées en sauce épicée", price: 2500, category: "Plats Principaux", prepTime: "60 min", isPopular: false },
      { name: "Dégué", description: "Yaourt de mil sucré avec couscous de mil", price: 1000, category: "Desserts", prepTime: "10 min", isPopular: true },
    ],
    stories: [],
  },
];

type SeedCommerceProduct = {
  name: string;
  description: string;
  category: string;
  price: number;
  originalPrice?: number;
  badge?: string;
  unitLabel: string;
  visualKey: string;
};

type SeedCommerceStore = {
  universe: "courses" | "supermarkets" | "boutiques";
  name: string;
  tagline: string;
  description: string;
  location: string;
  zone: string;
  accentColor: string;
  visualKey: string;
  etaMinMinutes: number;
  etaMaxMinutes: number;
  products: SeedCommerceProduct[];
};

const COMMERCE_STORES: SeedCommerceStore[] = [
  {
    universe: "courses" as const,
    name: "Course Express Cocody",
    tagline: "Essentiels rapides, retrait et depannage du quotidien.",
    description: "Une enseigne urbaine pour les petites courses utiles dans l'heure.",
    location: "Cocody Angre",
    zone: "Cocody, Angre, Riviera",
    accentColor: "#C4522A",
    visualKey: "course-express",
    etaMinMinutes: 18,
    etaMaxMinutes: 25,
    products: [
      { name: "Pack eau minerale", description: "Lot express pour maison ou bureau.", category: "Boissons", price: 2500, originalPrice: 2900, badge: "Express", unitLabel: "6 x 1,5L", visualKey: "cashier" },
      { name: "Pain + oeufs", description: "Le basique du matin en une seule course.", category: "Depannage", price: 1800, unitLabel: "kit", visualKey: "market-fresh" },
    ],
  },
  {
    universe: "courses" as const,
    name: "Minute Plateau",
    tagline: "Petites courses urbaines et paniers express.",
    description: "Parfait pour les bureaux et depannages de derniere minute.",
    location: "Plateau",
    zone: "Plateau, Treichville",
    accentColor: "#D97706",
    visualKey: "minute-plateau",
    etaMinMinutes: 20,
    etaMaxMinutes: 28,
    products: [
      { name: "Pause bureau", description: "Biscuits, jus et encas pour l'apres-midi.", category: "Pause bureau", price: 3200, badge: "Top demande", unitLabel: "box", visualKey: "sweet" },
      { name: "Kit hygiene", description: "Savon, dentifrice et lingettes pour depannage rapide.", category: "Hygiene", price: 4100, unitLabel: "kit", visualKey: "courier" },
    ],
  },
  {
    universe: "supermarkets" as const,
    name: "Marche Riviera",
    tagline: "Rayons frais, epicerie et maison sous un meme panier.",
    description: "Un supermarche de proximite avec produits du quotidien et frais.",
    location: "Riviera 2",
    zone: "Cocody, Riviera",
    accentColor: "#0F766E",
    visualKey: "super-riviera",
    etaMinMinutes: 35,
    etaMaxMinutes: 45,
    products: [
      { name: "Bananes plantain fraiches", description: "Selection du jour pour alloco, foutou ou accompagnement.", category: "Fruits & legumes", price: 2200, unitLabel: "kg", visualKey: "market-fresh" },
      { name: "Riz parfume famille", description: "Sac pratique pour la semaine, cuisson reguliere.", category: "Epicerie", price: 8900, originalPrice: 9500, badge: "Promo", unitLabel: "5 kg", visualKey: "comfort" },
    ],
  },
  {
    universe: "supermarkets" as const,
    name: "Fresh Abi",
    tagline: "Produits frais et paniers famille avec suivi propre.",
    description: "Une enseigne large pour les paniers de semaine et les besoins famille.",
    location: "Marcory",
    zone: "Marcory, Zone 4",
    accentColor: "#047857",
    visualKey: "fresh-abi",
    etaMinMinutes: 30,
    etaMaxMinutes: 40,
    products: [
      { name: "Jus multi-fruits", description: "Pack familial refrigere, ideal petit-dejeuner.", category: "Boissons", price: 5400, unitLabel: "6 bouteilles", visualKey: "sweet" },
      { name: "Pack bebe essentiel", description: "Couches, lingettes et creme pour la semaine.", category: "Bebe", price: 12800, badge: "Famille", unitLabel: "pack", visualKey: "courier" },
    ],
  },
  {
    universe: "boutiques" as const,
    name: "Atelier Cadeaux",
    tagline: "Coffrets, senteurs et idees a offrir sans perdre du temps.",
    description: "Une vitrine orientee cadeaux, maison et bien-etre.",
    location: "Deux Plateaux",
    zone: "Deux Plateaux, Cocody",
    accentColor: "#8B5E3C",
    visualKey: "atelier-cadeaux",
    etaMinMinutes: 40,
    etaMaxMinutes: 55,
    products: [
      { name: "Coffret bougie & senteur", description: "Petit coffret cadeau pour ambiance chic a la maison.", category: "Maison", price: 9600, badge: "Cadeau", unitLabel: "coffret", visualKey: "sweet" },
      { name: "Box self-care", description: "Selection bien-etre avec savon, creme et tisane.", category: "Bien-etre", price: 14500, unitLabel: "box", visualKey: "comfort" },
    ],
  },
  {
    universe: "boutiques" as const,
    name: "Select Store",
    tagline: "Achats specialises, vitrine plus premium et plus discrete.",
    description: "Une boutique plus premium avec selections lifestyle et achats prives.",
    location: "Zone 4",
    zone: "Zone 4, Marcory",
    accentColor: "#7C3F1D",
    visualKey: "select-store",
    etaMinMinutes: 45,
    etaMaxMinutes: 60,
    products: [
      { name: "Emballage premium", description: "Presentation soignee pour achats personnels ou cadeaux.", category: "Lifestyle", price: 3900, unitLabel: "service", visualKey: "grill" },
      { name: "Commande privee", description: "Traitement discret pour produits sensibles et retrait controle.", category: "Prive", price: 17500, badge: "Discret", unitLabel: "selection", visualKey: "cashier" },
    ],
  },
];

async function seedCommerceCatalog() {
  const existingStores = await db.select().from(commerceStoresTable);
  if (existingStores.length > 0) {
    console.log("✅ Commerce catalog already seeded, skipping...");
    return;
  }

  for (const store of COMMERCE_STORES) {
    const [createdStore] = await db.insert(commerceStoresTable).values({
      universe: store.universe,
      name: store.name,
      tagline: store.tagline,
      description: store.description,
      location: store.location,
      zone: store.zone,
      accentColor: store.accentColor,
      visualKey: store.visualKey,
      etaMinMinutes: store.etaMinMinutes,
      etaMaxMinutes: store.etaMaxMinutes,
      isActive: true,
    }).returning();

    for (const product of store.products) {
      await db.insert(commerceProductsTable).values({
        storeId: createdStore.id,
        name: product.name,
        description: product.description,
        category: product.category,
        price: product.price,
        originalPrice: product.originalPrice ?? null,
        badge: product.badge ?? null,
        unitLabel: product.unitLabel,
        visualKey: product.visualKey,
        inStock: true,
      });
    }

    console.log(`✅ Created commerce store: ${store.name}`);
  }
}

async function seed() {
  console.log("🌱 Seeding Nixyah database...");

  const existingUsers = await db.select().from(usersTable);
  if (existingUsers.length > 0) {
    console.log("✅ User data already seeded, skipping chef bootstrap...");
    await seedCommerceCatalog();
    process.exit(0);
  }

  for (const chefData of CHEFS) {
    const [user] = await db.insert(usersTable).values({
      name: chefData.name,
      email: chefData.email,
      phone: chefData.phone,
      passwordHash: hashPassword("nixyah2026"),
      type: "chef",
      location: chefData.location,
      coverColor: chefData.coverColor,
    }).returning();

    const [profile] = await db.insert(chefProfilesTable).values({
      userId: user.id,
      specialty: chefData.specialty,
      location: chefData.location,
      zone: chefData.zone,
      bio: chefData.bio,
      priceRange: chefData.priceRange,
      rating: chefData.rating,
      reviewCount: chefData.reviewCount,
      isVerified: true,
      isOnline: true,
      specialties: chefData.specialties,
      responseTime: "< 10 min",
    }).returning();

    for (const dish of chefData.dishes) {
      await db.insert(dishesTable).values({
        chefProfileId: profile.id,
        name: dish.name,
        description: dish.description,
        price: dish.price,
        category: dish.category,
        prepTime: dish.prepTime,
        isPopular: dish.isPopular,
      });
    }

    for (const story of chefData.stories) {
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await db.insert(storiesTable).values({
        chefProfileId: profile.id,
        caption: story.caption,
        dishName: story.dishName,
        price: story.price,
        emoji: story.emoji,
        bgColor: story.bgColor,
        createdAt: new Date(),
        expiresAt,
      });
    }

    console.log(`✅ Created chef: ${chefData.name}`);
  }

  await seedCommerceCatalog();

  console.log("🎉 Seeding complete!");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
