import React from "react";

import CommerceCatalogScreen from "@/components/CommerceCatalogScreen";

export default function ClientSupermarketsScreen() {
  return (
    <CommerceCatalogScreen
      universe="supermarkets"
      eyebrow="Nouveau rayon"
      title="Supermarchés"
      subtitle="Courses complètes, essentiels du quotidien et rayons bien organisés."
      primaryIcon="storefront"
      accentColor="#0F766E"
      accentSoftColor="#DDF6F2"
      primaryActionLabel="Retour a l'explorer"
      primaryActionHref="/(tabs)/search"
    />
  );
}