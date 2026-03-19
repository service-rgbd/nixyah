import { db } from "@workspace/db";
import { dishesTable, chefProfilesTable, ordersTable, notificationsTable, reviewsTable, usersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

async function seedChefData() {
  try {
    // Get the first chef (Chef Youssouf)
    const chef = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.type, "chef"))
      .limit(1);

    if (chef.length === 0) {
      console.log("No chef found. Creating sample chef data first.");
      return;
    }

    const chefUser = chef[0];
    console.log(`Seeding data for chef: ${chefUser.name}`);

    // Get chef profile
    const chefProfiles = await db
      .select()
      .from(chefProfilesTable)
      .where(eq(chefProfilesTable.userId, chefUser.id));

    if (chefProfiles.length === 0) {
      console.log("No chef profile found.");
      return;
    }

    const chefProfile = chefProfiles[0];

    // Add dishes if not already present
    const existingDishes = await db
      .select()
      .from(dishesTable)
      .where(eq(dishesTable.chefProfileId, chefProfile.id));

    if (existingDishes.length === 0) {
      console.log("Creating dishes...");
      const dishCategories = [
        {
          name: "Attiéké",
          description: "Attiéké frais garni de sauce arachide et protéine au choix",
          price: 2500,
          category: "Plat principal",
          prepTime: "20 min",
          isPopular: true,
        },
        {
          name: "Sauce arachide",
          description: "Sauce riche aux cacahuètes avec viande ou poisson",
          price: 3000,
          category: "Sauce",
          prepTime: "30 min",
          isPopular: true,
        },
        {
          name: "Aloco",
          description: "Banane plantain frite croustillante",
          price: 1500,
          category: "Accompagnement",
          prepTime: "15 min",
          isPopular: false,
        },
        {
          name: "Foutou",
          description: "Foutou plantain ou igname avec sauce à votre choix",
          price: 2000,
          category: "Plat principal",
          prepTime: "25 min",
          isPopular: false,
        },
        {
          name: "Kedjenou de poulet",
          description: "Poulet cuit à l'étouffée avec légumes traditionnel",
          price: 4000,
          category: "Plat principal",
          prepTime: "45 min",
          isPopular: true,
        },
      ];

      for (const dish of dishCategories) {
        await db.insert(dishesTable).values({
          chefProfileId: chefProfile.id,
          ...dish,
        });
      }
      console.log(`✓ Created ${dishCategories.length} dishes`);
    }

    // Get or create client for orders and reviews
    const clients = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.type, "client"));

    if (clients.length === 0) {
      console.log("No clients found. Please register a client first.");
      return;
    }

    const client = clients[0];

    // Create sample orders and reviews
    const existingOrders = await db
      .select()
      .from(ordersTable)
      .where(eq(ordersTable.chefProfileId, chefProfile.id));

    if (existingOrders.length === 0) {
      console.log("Creating sample orders and reviews...");
      
      const orderStatuses = ["delivered", "delivered", "delivered", "ready", "preparing"];
      const reviewRatings = [5, 5, 4, 4, 3];

      for (let i = 0; i < 5; i++) {
        const order = await db
          .insert(ordersTable)
          .values({
            clientId: client.id,
            chefProfileId: chefProfile.id,
            status: orderStatuses[i] as any,
            total: 5000 + i * 500,
            occasion: i === 0 ? "Livraison personnelle" : undefined,
            persons: 2 + i,
            notes: `Test order ${i + 1}`,
          })
          .returning();

        if (i < 4) {
          // Create reviews for delivered orders
          await db.insert(reviewsTable).values({
            orderId: order[0].id,
            clientId: client.id,
            chefProfileId: chefProfile.id,
            rating: reviewRatings[i],
            comment: [
              "Excellent! Très délicieux, je recommande vivement!",
              "Très bon, portions généreuses",
              "Bon, mais un peu trop salé",
              "Acceptable, à améliorer",
            ][i],
          });
        }
      }

      console.log("✓ Created sample orders and reviews");
    }

    // Create notifications
    const existingNotifs = await db
      .select()
      .from(notificationsTable)
      .where(eq(notificationsTable.userId, chefUser.id));

    if (existingNotifs.length === 0) {
      console.log("Creating sample notifications...");
      const notifications = [
        {
          type: "order" as const,
          title: "Nouvelle commande",
          message: "Alice a commandé de l'Attiéké et de la sauce arachide",
        },
        {
          type: "review" as const,
          title: "Nouvel avis 5⭐",
          message: "Alice: Excellent! Très délicieux, je recommande vivement!",
        },
        {
          type: "message" as const,
          title: "Message de Jean",
          message: "Pouvez-vous préparer une commande sans sel?",
        },
        {
          type: "payment" as const,
          title: "Paiement reçu",
          message: "14,500 CFA reçus - Commande #102",
        },
      ];

      for (const notif of notifications) {
        await db.insert(notificationsTable).values({
          userId: chefUser.id,
          ...notif,
        });
      }
      console.log(`✓ Created ${notifications.length} notifications`);
    }

    console.log("✅ Seed data completed successfully!");
  } catch (error) {
    console.error("Error seeding data:", error);
    throw error;
  }
}

// Run the seed
seedChefData().then(() => process.exit(0)).catch((error) => {
  console.error(error);
  process.exit(1);
});
