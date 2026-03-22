import React from "react";

import CommerceCatalogScreen from "@/components/CommerceCatalogScreen";

export default function ClientBoutiquesScreen() {
  return (
    <CommerceCatalogScreen
      universe="boutiques"
      eyebrow="Nouvelle vitrine"
      title="Boutiques"
      subtitle="Une navigation dédiée pour les boutiques locales, cadeaux et achats spécialisés."
      primaryIcon="gift"
      accentColor="#8B5E3C"
      accentSoftColor="#F7ECE1"
      primaryActionLabel="Voir les stories du moment"
      primaryActionHref="/stories"
    />
  );
}