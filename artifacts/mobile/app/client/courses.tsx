import React from "react";

import CommerceCatalogScreen from "@/components/CommerceCatalogScreen";

export default function ClientCoursesScreen() {
  return (
    <CommerceCatalogScreen
      universe="courses"
      eyebrow="Service express"
      title="Courses"
      subtitle="Les petites courses du quotidien, plus rapides a demander et plus simples a relancer."
      primaryIcon="cart"
      accentColor="#C4522A"
      accentSoftColor="#FBE7DB"
      primaryActionLabel="Voir mes commandes"
      primaryActionHref="/(tabs)/orders"
    />
  );
}