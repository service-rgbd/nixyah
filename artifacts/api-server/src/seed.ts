import { db } from "@workspace/db";
import { usersTable, chefProfilesTable, dishesTable, storiesTable } from "@workspace/db/schema";
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

async function seed() {
  console.log("🌱 Seeding Nixyah database...");

  const existingUsers = await db.select().from(usersTable);
  if (existingUsers.length > 0) {
    console.log("✅ Database already seeded, skipping...");
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

  console.log("🎉 Seeding complete!");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
