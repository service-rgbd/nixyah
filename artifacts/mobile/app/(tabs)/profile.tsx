import { Feather, Ionicons } from "@expo/vector-icons";
import Gradient from "@/components/SafeGradient";
import { router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CachedRemoteImage } from "@/components/CachedRemoteImage";
import Colors from "@/constants/colors";
import { uploadFile } from "@/constants/api";
import { useApp } from "@/contexts/AppContext";

const guestProfileIllustration = require("../../assets/images/login-cashier-illustration.png");

const MENU_ITEMS_CLIENT = [
  { icon: "shopping-bag" as const, label: "Mes commandes", sub: "Suivre mes commandes en cours" },
  { icon: "bell" as const, label: "Notifications", sub: "Alertes commandes, stories et promos suivies" },
  { icon: "map-pin" as const, label: "Mes adresses", sub: "Enregistrer ma dernière position" },
  { icon: "search" as const, label: "Cuisinieres", sub: "Voir les restaurants et leurs plats" },
  { icon: "shopping-cart" as const, label: "Courses", sub: "Voir les essentiels en express" },
  { icon: "shopping-bag" as const, label: "Supermarches", sub: "Explorer les rayons disponibles" },
  { icon: "gift" as const, label: "Boutiques", sub: "Voir les selections et achats specialises" },
  { icon: "gift" as const, label: "Offres du moment", sub: "Profiter des offres et stories" },
  { icon: "help-circle" as const, label: "Aide & Support", sub: "FAQ, Contact" },
];

const MENU_ITEMS_CHEF = [
  { icon: "shopping-bag" as const, label: "Commandes reçues", sub: "Pilotage cuisine et livraison" },
  { icon: "package" as const, label: "Mes plats", sub: "Créer, modifier ou supprimer" },
  { icon: "camera" as const, label: "Publier une story", sub: "Montrer le service du jour" },
  { icon: "bar-chart-2" as const, label: "Statistiques", sub: "Ventes, panier moyen, avis" },
  { icon: "bell" as const, label: "Notifications", sub: "Nouvelles commandes et retours" },
  { icon: "help-circle" as const, label: "Aide & Support", sub: "FAQ, Contact" },
];

const MENU_ITEMS_COURIER = [
  { icon: "truck" as const, label: "Mes missions", sub: "Livraisons disponibles et en cours" },
  { icon: "map-pin" as const, label: "Zone de livraison", sub: "Disponibilité et zone active" },
  { icon: "bell" as const, label: "Notifications", sub: "Missions et mises à jour" },
  { icon: "help-circle" as const, label: "Aide & Support", sub: "FAQ, Contact" },
];

type MenuItem =
  | (typeof MENU_ITEMS_CLIENT)[number]
  | (typeof MENU_ITEMS_CHEF)[number]
  | (typeof MENU_ITEMS_COURIER)[number];

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const {
    chefs,
    favorites,
    orders,
    chefOrders,
    user,
    token,
    logout,
    updateCurrentUser,
  } = useApp();
  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const [loggingOut, setLoggingOut] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const favoriteChefs = chefs.filter((c) => favorites.includes(c.id));
  const isChef = user?.type === "chef";
  const isCourier = user?.type === "courier";
  const isClient = user?.type === "client";
  const menuItems = isChef ? MENU_ITEMS_CHEF : isCourier ? MENU_ITEMS_COURIER : MENU_ITEMS_CLIENT;
  const roleLabel = isChef ? "Cuisinière" : isCourier ? "Livreur" : "Client";
  const roleAccent = isChef ? Colors.light.tint : isCourier ? "#0F766E" : "#8B5CF6";
  const courierVehicleLabel = useMemo(() => {
    const value = user?.courierProfile?.vehicleType;
    if (!value) {
      return "Moto";
    }

    if (value === "moto") {
      return "Moto";
    }

    if (value === "velo") {
      return "Vélo";
    }

    return value.charAt(0).toUpperCase() + value.slice(1);
  }, [user?.courierProfile?.vehicleType]);
  const courierStatusLabel = user?.courierProfile?.isAvailable ? "Disponible" : "Hors ligne";
  const courierDossierCompletedCount = useMemo(() => {
    const documents = user?.courierProfile?.verificationDocuments;
    if (!documents) {
      return 0;
    }

    return [
      documents.identityDocumentUrl,
      documents.driverLicenseUrl,
      documents.vehicleRegistrationUrl,
      documents.vehiclePhotoUrl,
      documents.selfiePhotoUrl,
    ].filter(Boolean).length;
  }, [user?.courierProfile?.verificationDocuments]);
  const courierDossierIsComplete = Boolean(user?.courierProfile?.isDossierComplete);

  const initials = user
    ? user.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
    : "?";
  const avatarColor = user?.coverColor ?? Colors.light.tint;
  const chefSummary = useMemo(() => ({
    totalOrders: chefOrders.length,
    pendingOrders: chefOrders.filter((order) => order.status === "pending").length,
    readyOrders: chefOrders.filter((order) => order.status === "ready").length,
    deliveredOrders: chefOrders.filter((order) => order.status === "delivered").length,
  }), [chefOrders]);
  const chefDashboardGroups = useMemo(() => ([
    {
      title: "Pilotage",
      items: [
        { icon: "shopping-bag" as const, label: "Commandes", sub: `${chefSummary.pendingOrders} a traiter maintenant`, onPress: () => router.push("/(tabs)/orders") },
        { icon: "bar-chart-2" as const, label: "Performance", sub: `${chefSummary.deliveredOrders} finalisees`, onPress: () => router.push("/chef/stats") },
      ],
    },
    {
      title: "Catalogue",
      items: [
        { icon: "package" as const, label: "Menu", sub: "Plats, prix et visuels", onPress: () => router.push("/chef/my-dishes") },
        { icon: "camera" as const, label: "Story du jour", sub: "Image ou video 30 sec", onPress: () => router.push("/chef/post-story") },
      ],
    },
    {
      title: "Relation client",
      items: [
        { icon: "bell" as const, label: "Notifications", sub: "Push, alertes et centre de notifications", onPress: () => router.push("/settings/notifications") },
        { icon: "help-circle" as const, label: "Aide", sub: "Questions frequentes et support", onPress: () => router.push("/(tabs)/help") },
      ],
    },
  ]), [chefSummary.deliveredOrders, chefSummary.pendingOrders]);

  const handleMenuPress = (item: MenuItem) => {
    if (item.label === "Publier une story") {
      router.push("/chef/post-story");
    } else if (item.label === "Mes commandes") {
      router.push("/(tabs)/orders");
    } else if (item.label === "Mes adresses") {
      router.push("/client/addresses");
    } else if (item.label === "Restaurants" || item.label === "Cuisinieres") {
      router.push("/(tabs)/search");
    } else if (item.label === "Courses") {
      router.push("/client/courses");
    } else if (item.label === "Supermarches") {
      router.push("/client/supermarkets");
    } else if (item.label === "Boutiques") {
      router.push("/client/boutiques");
    } else if (item.label === "Offres du moment") {
      router.push("/stories");
    } else if (item.label === "Mes plats") {
      router.push("/chef/my-dishes");
    } else if (item.label === "Statistiques") {
      router.push("/chef/stats");
    } else if (item.label === "Notifications") {
      router.push("/notifications");
    } else if (item.label === "Commandes reçues" || item.label === "Mes missions") {
      router.push("/(tabs)/orders");
    } else if (item.label === "Aide & Support") {
      router.push("/(tabs)/help");
    }
  };

  const handleAvatarUpload = async () => {
    if (!user) return;
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Permission requise", "Autorisez l'accès aux photos pour ajouter une vitrine à votre restaurant.");
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.82,
        allowsEditing: true,
        aspect: [1, 1],
      });
      if (res.canceled || !res.assets?.[0]?.uri) return;

      const asset = res.assets[0];
      const filename = asset.fileName ?? asset.uri.split("/").pop() ?? `restaurant-${Date.now()}.jpg`;
      const extension = filename.split(".").pop()?.toLowerCase();
      const contentType = asset.mimeType ?? (
        extension === "png"
          ? "image/png"
          : extension === "webp"
            ? "image/webp"
            : extension === "heic"
              ? "image/heic"
              : extension === "heif"
                ? "image/heif"
                : extension === "jpg"
                  ? "image/jpg"
                  : "image/jpeg"
      );

      setUploadingAvatar(true);
      const { publicUrl } = await uploadFile({
        fileUri: asset.uri,
        filename,
        contentType,
        purpose: "avatar",
        token: token ?? undefined,
      });
      if (!publicUrl) {
        throw new Error("URL d'image invalide");
      }
      await updateCurrentUser({ avatarUrl: publicUrl });
    } catch (error: any) {
      Alert.alert("Erreur", error?.message ?? "Impossible de mettre à jour la photo du restaurant");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleLogout = () => {
    Alert.alert("Se déconnecter", "Voulez-vous vraiment vous déconnecter ?", [
      { text: "Annuler", style: "cancel" },
      {
        text: "Se déconnecter",
        style: "destructive",
        onPress: async () => {
          setLoggingOut(true);
          await logout();
          setLoggingOut(false);
        },
      },
    ]);
  };

  if (!user) {
    return (
      <ScrollView
        style={[styles.container, { paddingTop: topInset }]}
        contentContainerStyle={styles.guestScrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.guestContent}>
          <Gradient colors={[Colors.light.tint, Colors.light.tintDark]} style={styles.guestHero}>
            <View style={styles.guestHeroMedia} pointerEvents="none">
              <Image source={guestProfileIllustration} style={styles.guestIllustration} resizeMode="cover" />
              <View style={styles.guestHeroOverlay} />
            </View>
            <View style={styles.guestHeroContent}>
              <Text style={styles.guestHeroTitle}>Connectez-vous</Text>
              <Text style={styles.guestHeroSub}>Accédez à vos commandes, favoris et profil depuis un espace unifié.</Text>
            </View>
          </Gradient>

          <Pressable style={styles.loginBtn} onPress={() => router.push("/auth/login")}>
            <Text style={styles.loginBtnText}>Se connecter</Text>
          </Pressable>

          <Pressable style={styles.registerBtn} onPress={() => router.push("/auth/register-client")}>
            <Text style={styles.registerBtnText}>Créer un compte client</Text>
          </Pressable>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>Vous cuisinez ?</Text>
            <View style={styles.dividerLine} />
          </View>

          <Pressable style={styles.chefBtn} onPress={() => router.push("/auth/register-chef")}>
            <Ionicons name="restaurant-outline" size={18} color={Colors.light.tint} />
            <Text style={styles.chefBtnText}>Rejoindre comme cuisinière</Text>
          </Pressable>

          <Pressable style={styles.courierBtn} onPress={() => router.push("/auth/register-courier")}>
            <Ionicons name="bicycle-outline" size={18} color="#0F766E" />
            <Text style={styles.courierBtnText}>Rejoindre comme livreur</Text>
          </Pressable>
        </View>
      </ScrollView>
    );
  }

  if (isClient) {
    const clientSections = [
      {
        title: "Compte",
        items: [
          { icon: "shopping-bag" as const, label: "Historique des commandes", sub: `${orders.length} commande${orders.length > 1 ? "s" : ""}`, onPress: () => router.push("/(tabs)/orders") },
          { icon: "map-pin" as const, label: "Mes adresses", sub: "Enregistrer votre derniere position", onPress: () => router.push("/client/addresses") },
        ],
      },
      {
        title: "Preferences",
        items: [
          { icon: "search" as const, label: "Cuisinieres", sub: "Explorer les restaurants et leurs plats", onPress: () => router.push("/(tabs)/search") },
          { icon: "shopping-cart" as const, label: "Courses", sub: "Acceder aux petites courses et depannages", onPress: () => router.push("/client/courses") },
          { icon: "shopping-bag" as const, label: "Supermarches", sub: "Parcourir les rayons et paniers famille", onPress: () => router.push("/client/supermarkets") },
          { icon: "gift" as const, label: "Boutiques", sub: "Decouvrir les achats specialises et selections premium", onPress: () => router.push("/client/boutiques") },
          { icon: "gift" as const, label: "Offres et stories", sub: "Promotions et plats du moment", onPress: () => router.push("/stories") },
          { icon: "help-circle" as const, label: "Centre d'aide", sub: "Commandes, support et boite de reception", onPress: () => router.push("/(tabs)/help") },
        ],
      },
    ];

    return (
      <View style={[styles.clientContainer, { paddingTop: topInset }]}> 
        <ScrollView contentContainerStyle={styles.clientContent} showsVerticalScrollIndicator={false}>
          <View style={styles.clientHeroCard}>
            <View style={styles.clientHeroTopRow}>
              <View style={styles.clientHeroBadge}>
                <Feather name="user" size={14} color={Colors.light.tint} />
                <Text style={styles.clientHeroBadgeText}>Mon compte</Text>
              </View>
              <Pressable style={styles.clientHelpBtn} onPress={() => router.push("/(tabs)/help")}>
                <Text style={styles.clientHelpText}>Aide</Text>
              </Pressable>
            </View>

            <View style={styles.clientHeroIdentity}>
              <View style={[styles.clientAvatar, { backgroundColor: avatarColor }]}>
                {user.avatarUrl ? (
                  <CachedRemoteImage uri={user.avatarUrl} style={styles.clientAvatarImage} contentFit="cover" />
                ) : (
                  <Text style={styles.clientAvatarText}>{initials}</Text>
                )}
              </View>
              <View style={styles.clientIdentityTextWrap}>
                <Text style={styles.clientName}>{user.name}</Text>
                <Text style={styles.clientSubtitle}>{user.email ?? user.phone ?? "Compte Nixyah"}</Text>
                <View style={styles.clientLocationRow}>
                  <Feather name="map-pin" size={12} color={Colors.light.textTertiary} />
                  <Text style={styles.clientHeroLocation}>{user.location || "Abidjan"}</Text>
                </View>
              </View>
            </View>

            <View style={styles.clientMiniStats}>
              <View style={styles.clientMiniStatItem}>
                <Text style={styles.clientMiniStatValue}>{orders.length}</Text>
                <Text style={styles.clientMiniStatLabel}>Commandes</Text>
              </View>
              <View style={styles.clientMiniStatDivider} />
              <View style={styles.clientMiniStatItem}>
                <Text style={styles.clientMiniStatValue}>{favorites.length}</Text>
                <Text style={styles.clientMiniStatLabel}>Favoris</Text>
              </View>
              <View style={styles.clientMiniStatDivider} />
              <View style={styles.clientMiniStatItem}>
                <Text style={styles.clientMiniStatValue}>{user.freeDeliveryCredits ?? 0}</Text>
                <Text style={styles.clientMiniStatLabel}>Livraisons offertes</Text>
              </View>
            </View>
          </View>

          {clientSections.map((section) => (
            <View key={section.title} style={styles.clientSectionBlock}>
              <Text style={styles.clientSectionHeading}>{section.title}</Text>
              <View style={styles.clientSectionCard}>
                {section.items.map((item, index) => (
                  <Pressable
                    key={item.label}
                    style={[styles.clientMenuItem, index === section.items.length - 1 && styles.clientMenuItemLast]}
                    onPress={item.onPress}
                  >
                    <View style={styles.clientMenuLeft}>
                      <View style={styles.clientMenuIconWrap}>
                        <Feather name={item.icon} size={18} color={Colors.light.tint} />
                      </View>
                      <View style={styles.clientMenuTextWrap}>
                        <Text style={styles.clientMenuLabel}>{item.label}</Text>
                        <Text style={styles.clientMenuSub}>{item.sub}</Text>
                      </View>
                    </View>
                    <Feather name="chevron-right" size={18} color={Colors.light.textTertiary} />
                  </Pressable>
                ))}
              </View>
            </View>
          ))}

          <View style={styles.clientMetaCard}>
            <Text style={styles.clientMetaLabel}>Adresse actuelle</Text>
            <Text style={styles.clientMetaValue}>{user.location || "Aucune adresse enregistree"}</Text>
          </View>

          {favoriteChefs.length > 0 ? (
            <View style={styles.clientSectionBlock}>
              <Text style={styles.clientSectionHeading}>Favoris</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.clientFavoritesRow}>
                {favoriteChefs.map((chef) => (
                  <Pressable
                    key={chef.id}
                    style={styles.clientFavoriteChip}
                    onPress={() => router.push({ pathname: "/chef/[id]", params: { id: chef.id } })}
                  >
                    {chef.avatarUrl ? (
                      <CachedRemoteImage uri={chef.avatarUrl} style={styles.clientFavoriteAvatarImage} />
                    ) : (
                      <View style={[styles.clientFavoriteAvatar, { backgroundColor: chef.coverColor }]}> 
                        <Text style={styles.clientFavoriteAvatarText}>{chef.name.slice(0, 2).toUpperCase()}</Text>
                      </View>
                    )}
                    <Text style={styles.clientFavoriteName} numberOfLines={1}>{chef.name}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          ) : null}

          <Pressable style={styles.clientLogoutBtn} onPress={handleLogout} disabled={loggingOut}>
            {loggingOut ? <ActivityIndicator color={Colors.light.textSecondary} size="small" /> : <>
              <Feather name="log-out" size={16} color={Colors.light.textSecondary} />
              <Text style={styles.clientLogoutText}>Déconnexion</Text>
            </>}
          </Pressable>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: topInset }]}> 
      <ScrollView
        contentContainerStyle={{ paddingBottom: Platform.OS === "web" ? 120 : 100 }}
        showsVerticalScrollIndicator={false}
      >
        <Gradient
          colors={[Colors.light.backgroundSecondary, Colors.light.background]}
          style={styles.profileHeader}
        >
          <View style={[styles.profileGlow, { backgroundColor: `${roleAccent}22` }]} />
          <View style={styles.heroTopRow}>
            {isChef ? (
              <Pressable style={styles.avatarWrapper} onPress={handleAvatarUpload} disabled={uploadingAvatar}>
                {user.avatarUrl ? (
                  <CachedRemoteImage uri={user.avatarUrl} style={styles.avatarImage} />
                ) : (
                  <View style={[styles.avatar, { backgroundColor: avatarColor }]}> 
                    <Text style={styles.avatarText}>{initials}</Text>
                  </View>
                )}
                <View style={styles.editAvatarBtn}>
                  {uploadingAvatar ? <ActivityIndicator size="small" color="#fff" /> : <Feather name="camera" size={12} color="#fff" />}
                </View>
              </Pressable>
            ) : user.avatarUrl ? (
              <View style={styles.avatarWrapper}>
                <CachedRemoteImage uri={user.avatarUrl} style={styles.avatarImage} />
              </View>
            ) : (
              <View style={styles.avatarWrapper}>
                <View style={[styles.avatar, { backgroundColor: avatarColor }]}> 
                  <Text style={styles.avatarText}>{initials}</Text>
                </View>
              </View>
            )}

            <View style={styles.identityBlock}>
              <View style={[styles.rolePill, { backgroundColor: `${roleAccent}16`, borderColor: `${roleAccent}2E` }]}>
                <View style={[styles.rolePillDot, { backgroundColor: roleAccent }]} />
                <Text style={[styles.rolePillText, { color: roleAccent }]}>{roleLabel}</Text>
              </View>
              <Text style={styles.profileName}>{user.name}</Text>
              <Text style={styles.profileEmail}>{user.email ?? user.phone ?? "Compte Nixyah"}</Text>
              <Text style={styles.profileLocation}>📍 {user.location}</Text>
              <Text style={styles.profilePhotoHint}>
                {isChef
                  ? "Ajoutez la photo du restaurant et gardez un tableau de bord simple, centré sur l'essentiel."
                  : "Votre espace client est limité aux commandes, adresses, offres et support."}
              </Text>
            </View>
          </View>

          {isChef ? (
            <View style={styles.chefHeroCard}>
              <View style={styles.chefHeroHead}>
                <View>
                  <Text style={styles.chefHeroEyebrow}>Dashboard cuisine</Text>
                  <Text style={styles.chefHeroTitle}>{user.chefProfile?.specialty ?? "Votre cuisine"}</Text>
                </View>
                <View style={styles.verifiedBadge}>
                  <Ionicons name={user.chefProfile?.isFeatured ? "sparkles" : "restaurant"} size={14} color={Colors.light.tint} />
                  <Text style={styles.verifiedBadgeText}>{user.chefProfile?.isVerified ? "Vérifiée" : "En construction"}</Text>
                </View>
              </View>

              <Text style={styles.chefHeroDescription} numberOfLines={2}>
                {user.chefProfile?.bio || "Pilotez les commandes, le menu et la story du jour depuis des groupes d'actions plus clairs."}
              </Text>

              <View style={styles.insightBanner}>
                <Feather name={user.chefProfile?.isFeatured ? "award" : "bar-chart-2"} size={16} color={Colors.light.tint} />
                <Text style={styles.insightBannerText}>
                  {user.chefProfile?.isFeatured
                    ? "Votre cuisine est mise en premier plan grâce à vos étoiles."
                    : `${Math.max(0, 200 - (user.chefProfile?.stars ?? 0))} étoiles restantes pour passer en premier plan.`}
                </Text>
              </View>

              <View style={styles.chefMetricRow}>
                <View style={styles.chefMetricCard}>
                  <Text style={styles.chefMetricValue}>{chefSummary.pendingOrders}</Text>
                  <Text style={styles.chefMetricLabel}>En attente</Text>
                </View>
                <View style={styles.chefMetricCard}>
                  <Text style={styles.chefMetricValue}>{user.chefProfile?.stars ?? 0}</Text>
                  <Text style={styles.chefMetricLabel}>Étoiles</Text>
                </View>
                <View style={styles.chefMetricCard}>
                  <Text style={styles.chefMetricValue}>{user.chefProfile?.activeInvestigationCount ?? 0}</Text>
                  <Text style={styles.chefMetricLabel}>Enquêtes</Text>
                </View>
              </View>
            </View>
          ) : null}

          <View style={styles.clientMetaCard}>
            <Text style={styles.clientMetaLabel}>Parrainage</Text>
            <Text style={styles.clientMetaValue}>{user.referralCode || "Code bientôt disponible"}</Text>
            <Text style={styles.clientMetaSub}>{`${user.freeDeliveryCredits ?? 0} livraison(s) offerte(s) disponible(s)`}</Text>
          </View>

          <Pressable style={styles.securityCard} onPress={() => router.push("/settings/passkeys")}>
            <View style={styles.securityCardIcon}>
              <Feather name="shield" size={18} color="#0F766E" />
            </View>
            <View style={styles.securityCardBody}>
              <Text style={styles.securityCardTitle}>Passkeys & sécurité</Text>
              <Text style={styles.securityCardText}>Ajoutez une connexion biométrique sans mot de passe et gardez votre email comme solution de secours.</Text>
            </View>
            <Feather name="chevron-right" size={18} color={Colors.light.textTertiary} />
          </Pressable>

          <View style={styles.statsRow}>
            <View style={styles.statItemCard}>
              <View style={styles.statItem}>
              <Text style={styles.statValue}>{isChef ? chefSummary.totalOrders : orders.length}</Text>
              <Text style={styles.statLabel}>{isChef ? "Commandes" : isCourier ? "Missions" : "Commandes"}</Text>
              </View>
            </View>
            <View style={styles.statItemCard}>
              <View style={styles.statItem}>
              <Text style={styles.statValue}>{favorites.length}</Text>
              <Text style={styles.statLabel}>Favoris</Text>
              </View>
            </View>
            <View style={styles.statItemCard}>
              <View style={styles.statItem}>
              <Text style={styles.statValue}>{isChef ? chefSummary.deliveredOrders : 0}</Text>
              <Text style={styles.statLabel}>{isChef ? "Finalisées" : "Avis"}</Text>
              </View>
            </View>
          </View>
        </Gradient>

        {isChef ? (
          <View style={styles.chefDashboardWrap}>
            {chefDashboardGroups.map((group) => (
              <View key={group.title} style={styles.clientSectionBlock}>
                <Text style={styles.clientSectionHeading}>{group.title}</Text>
                <View style={styles.clientSectionCard}>
                  {group.items.map((item, index) => (
                    <Pressable
                      key={item.label}
                      style={[styles.clientMenuItem, index === group.items.length - 1 && styles.clientMenuItemLast]}
                      onPress={item.onPress}
                    >
                      <View style={styles.clientMenuLeft}>
                        <View style={styles.clientMenuIconWrap}>
                          <Feather name={item.icon} size={18} color={Colors.light.tint} />
                        </View>
                        <View style={styles.clientMenuTextWrap}>
                          <Text style={styles.clientMenuLabel}>{item.label}</Text>
                          <Text style={styles.clientMenuSub}>{item.sub}</Text>
                        </View>
                      </View>
                      <Feather name="chevron-right" size={18} color={Colors.light.textTertiary} />
                    </Pressable>
                  ))}
                </View>
              </View>
            ))}
          </View>
        ) : isCourier ? (
          <View style={styles.courierDashboardWrap}>
            <View style={styles.courierHeroCard}>
              <View style={styles.courierHeroTopRow}>
                <View>
                  <Text style={styles.courierHeroEyebrow}>Tableau de bord livraison</Text>
                  <Text style={styles.courierHeroTitle}>{courierStatusLabel}</Text>
                </View>
                <View style={[styles.courierStatusPill, { backgroundColor: `${roleAccent}18` }]}>
                  <View style={[styles.rolePillDot, { backgroundColor: roleAccent }]} />
                  <Text style={[styles.courierStatusPillText, { color: roleAccent }]}>{user.courierProfile?.isVerified ? "Vérifié" : "En revue"}</Text>
                </View>
              </View>

              <Text style={styles.courierHeroDescription}>
                Retrouvez vos missions, votre zone active et votre statut de disponibilité dans un espace plus net.
              </Text>

              <View style={styles.courierInfoGrid}>
                <View style={styles.courierInfoCard}>
                  <Text style={styles.courierInfoValue}>{courierStatusLabel}</Text>
                  <Text style={styles.courierInfoLabel}>Disponibilité</Text>
                </View>
                <View style={styles.courierInfoCard}>
                  <Text style={styles.courierInfoValue} numberOfLines={1}>{user.courierProfile?.zone || "Abidjan"}</Text>
                  <Text style={styles.courierInfoLabel}>Zone active</Text>
                </View>
                <View style={styles.courierInfoCard}>
                  <Text style={styles.courierInfoValue}>{courierVehicleLabel}</Text>
                  <Text style={styles.courierInfoLabel}>Véhicule</Text>
                </View>
              </View>

              <View style={styles.courierInfoGrid}>
                <View style={styles.courierInfoCard}>
                  <Text style={styles.courierInfoValue}>{user.courierProfile?.stars ?? 0}</Text>
                  <Text style={styles.courierInfoLabel}>Étoiles</Text>
                </View>
                <View style={styles.courierInfoCard}>
                  <Text style={styles.courierInfoValue}>{user.courierProfile?.activeInvestigationCount ?? 0}</Text>
                  <Text style={styles.courierInfoLabel}>Enquêtes</Text>
                </View>
                <View style={styles.courierInfoCard}>
                  <Text style={styles.courierInfoValue}>{`${Math.round(user.courierProfile?.bonusEarnedAmount ?? 0).toLocaleString("fr-FR")} F`}</Text>
                  <Text style={styles.courierInfoLabel}>Bonus cumulés</Text>
                </View>
              </View>

              <View style={styles.insightBanner}>
                <Feather name={(user.courierProfile?.bonusUnlockedAt ?? null) ? "award" : "truck"} size={16} color="#0F766E" />
                <Text style={[styles.insightBannerText, { color: "#0F766E" }]}> 
                  {(user.courierProfile?.bonusUnlockedAt ?? null)
                    ? "Bonus de 10 000 XOF débloqué. Continuez pour rester parmi les meilleurs livreurs."
                    : `${Math.max(0, 250 - (user.courierProfile?.stars ?? 0))} étoiles restantes avant le bonus de 10 000 XOF.`}
                </Text>
              </View>

              <View style={styles.courierDossierCard}>
                <View style={styles.courierDossierHead}>
                  <View>
                    <Text style={styles.courierDossierTitle}>Dossier de vérification</Text>
                    <Text style={styles.courierDossierSubtitle}>{courierDossierCompletedCount}/5 pièces ajoutées</Text>
                  </View>
                  <View style={[styles.courierDossierBadge, courierDossierIsComplete ? styles.courierDossierBadgeReady : styles.courierDossierBadgePending]}>
                    <Text style={[styles.courierDossierBadgeText, courierDossierIsComplete ? styles.courierDossierBadgeTextReady : styles.courierDossierBadgeTextPending]}>
                      {courierDossierIsComplete ? "Prêt" : "À compléter"}
                    </Text>
                  </View>
                </View>
                <Text style={styles.courierDossierBody}>
                  {courierDossierIsComplete
                    ? "Votre dossier est complet. L'équipe peut maintenant vérifier votre profil avant d'ouvrir l'accès aux nouvelles missions."
                    : "Ajoutez vos 5 pièces justificatives depuis votre espace livreur pour débloquer la validation admin."}
                </Text>
                <Pressable style={styles.courierDossierButton} onPress={() => router.push("/courier/verification" as any)}>
                  <Text style={styles.courierDossierButtonText}>{courierDossierIsComplete ? "Voir le dossier" : "Compléter mon dossier"}</Text>
                  <Feather name="arrow-right" size={16} color="#0F766E" />
                </Pressable>
              </View>
            </View>

            <View style={styles.clientSectionBlock}>
              <Text style={styles.clientSectionHeading}>Raccourcis</Text>
              <View style={styles.courierActionPanel}>
                <Pressable style={styles.courierActionCard} onPress={() => router.push("/(tabs)/orders")}>
                  <View style={[styles.courierActionIconWrap, { backgroundColor: "#FFF2ED" }]}>
                    <Feather name="truck" size={20} color={Colors.light.tint} />
                  </View>
                  <Text style={styles.courierActionTitle}>Mes missions</Text>
                  <Text style={styles.courierActionSub}>Voir les courses en cours, disponibles et archivées</Text>
                </Pressable>

                <Pressable style={styles.courierActionCard} onPress={() => router.push("/(tabs)/help")}>
                  <View style={[styles.courierActionIconWrap, { backgroundColor: "#EEF8F5" }]}>
                    <Feather name="help-circle" size={20} color="#0F766E" />
                  </View>
                  <Text style={styles.courierActionTitle}>Support</Text>
                  <Text style={styles.courierActionSub}>Aide, incidents et accompagnement sur les livraisons</Text>
                </Pressable>

                <Pressable style={styles.courierActionCard} onPress={() => router.push("/courier/verification" as any)}>
                  <View style={[styles.courierActionIconWrap, { backgroundColor: "#EEF6FF" }]}> 
                    <Feather name="file-text" size={20} color="#2563EB" />
                  </View>
                  <Text style={styles.courierActionTitle}>Mon dossier</Text>
                  <Text style={styles.courierActionSub}>Ajouter les pièces requises pour l'accès aux missions</Text>
                </Pressable>
              </View>
            </View>
          </View>
        ) : !isCourier ? (
          <View style={styles.actionPanel}>
            <Pressable style={styles.actionCard} onPress={() => router.push("/(tabs)/search") }>
              <Gradient colors={[Colors.light.tint, Colors.light.tintDark]} style={styles.actionIconWrap}>
                <Feather name="search" size={18} color="#fff" />
              </Gradient>
              <Text style={styles.actionTitle}>Restaurants</Text>
              <Text style={styles.actionSub}>Voir les restaurants et leurs plats</Text>
            </Pressable>

            <Pressable style={styles.actionCard} onPress={() => router.push("/(tabs)/orders") }>
              <Gradient colors={["#8B5CF6", "#6D28D9"]} style={styles.actionIconWrap}>
                <Feather name="shopping-bag" size={18} color="#fff" />
              </Gradient>
              <Text style={styles.actionTitle}>Mes commandes</Text>
              <Text style={styles.actionSub}>Suivre les commandes déjà passées</Text>
            </Pressable>

            <Pressable style={styles.actionCard} onPress={() => router.push("/client/addresses") }>
              <Gradient colors={["#059669", "#047857"]} style={styles.actionIconWrap}>
                <Feather name="map-pin" size={18} color="#fff" />
              </Gradient>
              <Text style={styles.actionTitle}>Mes adresses</Text>
              <Text style={styles.actionSub}>Enregistrer ma position de livraison</Text>
            </Pressable>

            <Pressable style={styles.actionCard} onPress={() => router.push("/stories") }>
              <Gradient colors={["#D97706", "#B45309"]} style={styles.actionIconWrap}>
                <Feather name="gift" size={18} color="#fff" />
              </Gradient>
              <Text style={styles.actionTitle}>Offres</Text>
              <Text style={styles.actionSub}>Profiter des stories et offres du moment</Text>
            </Pressable>
          </View>
        ) : null}

        {!isChef && favoriteChefs.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Mes cuisinières favorites</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.favoritesRow}>
              {favoriteChefs.map((chef) => (
                <Pressable
                  key={chef.id}
                  style={styles.favoriteChip}
                  onPress={() => router.push({ pathname: "/chef/[id]", params: { id: chef.id } })}
                >
                  {chef.avatarUrl ? (
                    <CachedRemoteImage uri={chef.avatarUrl} style={styles.favoriteAvatarImage} />
                  ) : (
                    <View style={[styles.favoriteAvatar, { backgroundColor: chef.coverColor }]}> 
                      <Text style={styles.favoriteAvatarText}>
                        {chef.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                      </Text>
                    </View>
                  )}
                  <Text style={styles.favoriteName} numberOfLines={1}>{chef.name.split(" ")[0]}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}

        {!isChef ? <View style={styles.menuSection}>
          {menuItems.map((item, idx) => (
            <Pressable
              key={idx}
              style={[styles.menuItem, idx === menuItems.length - 1 && { borderBottomWidth: 0 }]}
              onPress={() => handleMenuPress(item)}
            >
              <View style={styles.menuIconWrapper}>
                <Feather name={item.icon} size={18} color={Colors.light.tint} />
              </View>
              <View style={styles.menuContent}>
                <Text style={styles.menuLabel}>{item.label}</Text>
                <Text style={styles.menuSub}>{item.sub}</Text>
              </View>
              <Feather name="chevron-right" size={16} color={Colors.light.tabIconDefault} />
            </Pressable>
          ))}
        </View> : null}

        <Pressable style={styles.logoutBtn} onPress={handleLogout} disabled={loggingOut}>
          {loggingOut ? (
            <ActivityIndicator color={Colors.light.error} size="small" />
          ) : (
            <>
              <Feather name="log-out" size={16} color={Colors.light.error} />
              <Text style={styles.logoutText}>Se déconnecter</Text>
            </>
          )}
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.background },
  clientContainer: { flex: 1, backgroundColor: Colors.light.background },
  clientContent: { paddingBottom: Platform.OS === "web" ? 120 : 100 },
  clientHeroCard: {
    marginHorizontal: 20,
    marginTop: 10,
    paddingHorizontal: 2,
    paddingTop: 8,
    paddingBottom: 18,
  },
  clientHeroTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  clientHeroBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "transparent",
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(196,82,42,0.16)",
  },
  clientHeroBadgeText: { color: Colors.light.tint, fontFamily: "Poppins_600SemiBold", fontSize: 12 },
  clientHelpBtn: {
    backgroundColor: "transparent",
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.light.divider,
  },
  clientHelpText: { color: Colors.light.textSecondary, fontFamily: "Poppins_600SemiBold", fontSize: 13 },
  clientHeroIdentity: { flexDirection: "row", alignItems: "center", gap: 16, marginTop: 18 },
  clientAvatar: { width: 76, height: 76, borderRadius: 38, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  clientAvatarText: { color: "#fff", fontFamily: "Poppins_700Bold", fontSize: 28 },
  clientAvatarImage: { width: 76, height: 76, borderRadius: 38 },
  clientIdentityTextWrap: { flex: 1 },
  clientName: { color: Colors.light.text, fontFamily: "Poppins_700Bold", fontSize: 20 },
  clientSubtitle: { color: Colors.light.textSecondary, fontFamily: "Poppins_400Regular", fontSize: 13, marginTop: 2 },
  clientLocationRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6 },
  clientHeroLocation: { color: Colors.light.textTertiary, fontFamily: "Poppins_400Regular", fontSize: 12 },
  clientMiniStats: {
    marginTop: 18,
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "rgba(104,83,69,0.10)",
  },
  clientMiniStatItem: { flex: 1, alignItems: "center", gap: 2 },
  clientMiniStatDivider: { width: 1, height: 28, backgroundColor: Colors.light.divider },
  clientMiniStatValue: { color: Colors.light.text, fontFamily: "Poppins_700Bold", fontSize: 18 },
  clientMiniStatLabel: { color: Colors.light.textSecondary, fontFamily: "Poppins_400Regular", fontSize: 11 },
  clientSectionBlock: { marginTop: 20, paddingHorizontal: 20 },
  clientSectionHeading: { color: Colors.light.text, fontFamily: "Poppins_600SemiBold", fontSize: 18, marginBottom: 10 },
  clientSectionCard: {
    backgroundColor: "transparent",
  },
  clientMenuItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
    paddingHorizontal: 0,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(104,83,69,0.10)",
  },
  clientMenuItemLast: { borderBottomWidth: 0 },
  clientMenuLeft: { flexDirection: "row", alignItems: "center", gap: 16, flex: 1 },
  clientMenuIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  clientMenuTextWrap: { flex: 1 },
  clientMenuLabel: { color: Colors.light.text, fontFamily: "Poppins_500Medium", fontSize: 15 },
  clientMenuSub: { color: Colors.light.textSecondary, fontFamily: "Poppins_400Regular", fontSize: 12, marginTop: 2 },
  clientMetaCard: {
    marginTop: 20,
    marginHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "rgba(104,83,69,0.10)",
  },
  clientMetaLabel: { color: Colors.light.textSecondary, fontFamily: "Poppins_400Regular", fontSize: 12 },
  clientMetaValue: { color: Colors.light.text, fontFamily: "Poppins_600SemiBold", fontSize: 15, marginTop: 6 },
  clientMetaSub: { color: Colors.light.textSecondary, fontFamily: "Poppins_400Regular", fontSize: 12, marginTop: 6 },
  securityCard: {
    marginTop: 18,
    marginHorizontal: 20,
    minHeight: 78,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: Colors.light.card,
    borderWidth: 1,
    borderColor: Colors.light.divider,
  },
  securityCardIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ECFDF5",
  },
  securityCardBody: { flex: 1, gap: 4 },
  securityCardTitle: { fontSize: 14, fontFamily: "Poppins_600SemiBold", color: Colors.light.text },
  securityCardText: { fontSize: 12, lineHeight: 18, fontFamily: "Poppins_400Regular", color: Colors.light.textSecondary },
  clientFavoritesRow: { gap: 12 },
  clientFavoriteChip: { width: 112, gap: 10, paddingVertical: 8 },
  clientFavoriteAvatar: { width: 54, height: 54, borderRadius: 27, alignItems: "center", justifyContent: "center" },
  clientFavoriteAvatarImage: { width: 54, height: 54, borderRadius: 27, backgroundColor: Colors.light.backgroundSecondary },
  clientFavoriteAvatarText: { color: "#fff", fontFamily: "Poppins_700Bold", fontSize: 16 },
  clientFavoriteName: { color: Colors.light.text, fontFamily: "Poppins_400Regular", fontSize: 12 },
  clientLogoutBtn: { marginTop: 20, marginBottom: 12, marginHorizontal: 20, backgroundColor: "transparent", borderRadius: 16, minHeight: 52, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, borderWidth: 1, borderColor: Colors.light.divider },
  clientLogoutText: { color: Colors.light.textSecondary, fontFamily: "Poppins_500Medium", fontSize: 14 },
  guestScrollContent: { paddingBottom: Platform.OS === "web" ? 120 : 100 },
  guestContent: { padding: 16, alignItems: "center", gap: 10, width: "100%", maxWidth: 520, alignSelf: "center" },
  guestHero: { width: "100%", minHeight: 360, overflow: "hidden", justifyContent: "flex-end", marginBottom: 10 },
  guestHeroMedia: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "flex-start" },
  guestHeroOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(70, 32, 12, 0.14)" },
  guestHeroContent: { position: "relative", zIndex: 1, gap: 8, width: "100%", paddingHorizontal: 22, paddingTop: 110, paddingBottom: 20 },
  guestHeroTitle: { fontSize: 28, fontFamily: "Poppins_700Bold", color: "#fff" },
  guestHeroSub: { fontSize: 14, fontFamily: "Poppins_400Regular", color: "rgba(255,255,255,0.9)", lineHeight: 21 },
  guestIllustration: { width: "138%", height: "138%", marginTop: -26 },
  loginBtn: { width: "100%", backgroundColor: Colors.light.tint, borderRadius: 999, paddingVertical: 15, alignItems: "center" },
  loginBtnText: { fontSize: 16, fontFamily: "Poppins_600SemiBold", color: "#fff" },
  registerBtn: { width: "100%", borderWidth: 1, borderColor: Colors.light.tint, borderRadius: 999, paddingVertical: 14, alignItems: "center" },
  registerBtnText: { fontSize: 15, fontFamily: "Poppins_600SemiBold", color: Colors.light.tint },
  divider: { flexDirection: "row", alignItems: "center", gap: 12, width: "100%", marginVertical: 4 },
  dividerLine: { flex: 1, height: 1, backgroundColor: Colors.light.divider },
  dividerText: { fontSize: 12, fontFamily: "Poppins_400Regular", color: Colors.light.textTertiary },
  chefBtn: { width: "100%", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "transparent", borderRadius: 16, paddingVertical: 14, borderWidth: 1, borderColor: Colors.light.cardBorder },
  chefBtnText: { fontSize: 15, fontFamily: "Poppins_600SemiBold", color: Colors.light.tint },
  courierBtn: { width: "100%", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "transparent", borderRadius: 16, paddingVertical: 14, borderWidth: 1, borderColor: "#A7F3D0" },
  courierBtnText: { fontSize: 15, fontFamily: "Poppins_600SemiBold", color: "#0F766E" },
  profileHeader: { marginTop: 10, paddingHorizontal: 20, paddingTop: 18, paddingBottom: 22, gap: 18, overflow: "hidden" },
  profileGlow: { position: "absolute", top: -48, right: -20, width: 180, height: 180, borderRadius: 90 },
  heroTopRow: { flexDirection: "row", gap: 16, alignItems: "center" },
  avatarWrapper: { position: "relative", padding: 0, borderRadius: 999, backgroundColor: "transparent" },
  avatar: { width: 90, height: 90, borderRadius: 45, alignItems: "center", justifyContent: "center" },
  avatarImage: { width: 90, height: 90, borderRadius: 45, backgroundColor: Colors.light.backgroundSecondary },
  avatarText: { fontSize: 32, fontFamily: "Poppins_700Bold", color: "#fff" },
  editAvatarBtn: { position: "absolute", bottom: 0, right: 0, backgroundColor: Colors.light.text, width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "#fff" },
  identityBlock: { flex: 1, gap: 4 },
  rolePill: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 7, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, marginBottom: 4 },
  rolePillDot: { width: 8, height: 8, borderRadius: 4 },
  rolePillText: { fontSize: 11, fontFamily: "Poppins_700Bold", textTransform: "uppercase", letterSpacing: 0.4 },
  profileName: { fontSize: 21, fontFamily: "Poppins_700Bold", color: Colors.light.text },
  profileEmail: { fontSize: 13, fontFamily: "Poppins_400Regular", color: Colors.light.textSecondary },
  profileLocation: { fontSize: 12, fontFamily: "Poppins_400Regular", color: Colors.light.textTertiary },
  profilePhotoHint: { marginTop: 4, fontSize: 12, lineHeight: 18, fontFamily: "Poppins_400Regular", color: Colors.light.textSecondary },
  chefHeroCard: { paddingVertical: 8, gap: 12, borderTopWidth: 1, borderBottomWidth: 1, borderColor: "rgba(104,83,69,0.10)" },
  chefHeroHead: { flexDirection: "row", justifyContent: "space-between", gap: 12, alignItems: "flex-start" },
  chefHeroEyebrow: { fontSize: 11, fontFamily: "Poppins_600SemiBold", color: Colors.light.tint, textTransform: "uppercase" },
  chefHeroTitle: { fontSize: 18, fontFamily: "Poppins_700Bold", color: Colors.light.text },
  chefHeroDescription: { fontSize: 13, lineHeight: 20, fontFamily: "Poppins_400Regular", color: Colors.light.textSecondary },
  verifiedBadge: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "transparent", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7, borderWidth: 1, borderColor: "rgba(104,83,69,0.10)" },
  verifiedBadgeText: { fontSize: 11, fontFamily: "Poppins_600SemiBold", color: Colors.light.tint },
  chefMetricRow: { flexDirection: "row", gap: 10 },
  chefMetricCard: { flex: 1, paddingVertical: 12, paddingHorizontal: 4, gap: 4, alignItems: "center" },
  chefMetricValue: { fontSize: 20, fontFamily: "Poppins_700Bold", color: Colors.light.text },
  chefMetricLabel: { fontSize: 11, fontFamily: "Poppins_400Regular", color: Colors.light.textSecondary },
  insightBanner: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 0, paddingVertical: 8, borderBottomWidth: 1, borderTopWidth: 1, borderColor: "rgba(196,82,42,0.10)" },
  insightBannerText: { flex: 1, fontSize: 12, lineHeight: 18, fontFamily: "Poppins_500Medium", color: Colors.light.tint },
  statsRow: { flexDirection: "row", gap: 10 },
  statItemCard: { flex: 1, paddingVertical: 14, paddingHorizontal: 10 },
  statItem: { flex: 1, alignItems: "center", gap: 3 },
  statValue: { fontSize: 20, fontFamily: "Poppins_700Bold", color: Colors.light.text },
  statLabel: { fontSize: 11, fontFamily: "Poppins_400Regular", color: Colors.light.textTertiary, textAlign: "center" },
  actionPanel: { paddingHorizontal: 20, paddingTop: 18, gap: 12 },
  chefDashboardWrap: { paddingTop: 10 },
  courierDashboardWrap: { paddingTop: 10 },
  actionCard: { paddingVertical: 16, gap: 10, borderBottomWidth: 1, borderBottomColor: "rgba(104,83,69,0.10)" },
  courierHeroCard: { marginHorizontal: 20, paddingVertical: 18, gap: 14 },
  courierHeroTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 12 },
  courierHeroEyebrow: { fontSize: 11, fontFamily: "Poppins_700Bold", textTransform: "uppercase", letterSpacing: 0.5, color: "#A36A46" },
  courierHeroTitle: { fontSize: 22, fontFamily: "Poppins_700Bold", color: "#1F1A17", marginTop: 4 },
  courierStatusPill: { flexDirection: "row", alignItems: "center", gap: 7, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7, borderWidth: 1, borderColor: "rgba(15,118,110,0.12)" },
  courierStatusPillText: { fontSize: 11, fontFamily: "Poppins_700Bold", textTransform: "uppercase", letterSpacing: 0.4 },
  courierHeroDescription: { fontSize: 13, lineHeight: 20, fontFamily: "Poppins_400Regular", color: "#7B7068" },
  courierInfoGrid: { flexDirection: "row", gap: 10 },
  courierInfoCard: { flex: 1, paddingHorizontal: 4, paddingVertical: 14, gap: 4, alignItems: "center" },
  courierInfoValue: { fontSize: 15, fontFamily: "Poppins_600SemiBold", color: "#1F1A17" },
  courierInfoLabel: { fontSize: 11, fontFamily: "Poppins_400Regular", color: "#8C827B" },
  courierDossierCard: { paddingVertical: 14, gap: 10, borderTopWidth: 1, borderBottomWidth: 1, borderColor: "rgba(104,83,69,0.10)" },
  courierDossierHead: { flexDirection: "row", justifyContent: "space-between", gap: 12, alignItems: "flex-start" },
  courierDossierTitle: { fontSize: 15, fontFamily: "Poppins_600SemiBold", color: "#1F1A17" },
  courierDossierSubtitle: { marginTop: 4, fontSize: 12, fontFamily: "Poppins_400Regular", color: "#7B7068" },
  courierDossierBody: { fontSize: 12, lineHeight: 18, fontFamily: "Poppins_400Regular", color: "#7B7068" },
  courierDossierBadge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7 },
  courierDossierBadgeReady: { backgroundColor: "#DCFCE7" },
  courierDossierBadgePending: { backgroundColor: "#FEF3C7" },
  courierDossierBadgeText: { fontSize: 10, fontFamily: "Poppins_700Bold", textTransform: "uppercase" },
  courierDossierBadgeTextReady: { color: "#166534" },
  courierDossierBadgeTextPending: { color: "#92400E" },
  courierDossierButton: { minHeight: 44, paddingHorizontal: 0, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  courierDossierButtonText: { fontSize: 13, fontFamily: "Poppins_600SemiBold", color: "#0F766E" },
  courierActionPanel: { gap: 12 },
  courierActionCard: { paddingVertical: 16, gap: 10, borderBottomWidth: 1, borderBottomColor: "rgba(104,83,69,0.10)" },
  courierActionIconWrap: { width: 48, height: 48, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  courierActionTitle: { fontSize: 15, fontFamily: "Poppins_600SemiBold", color: "#1F1A17" },
  courierActionSub: { fontSize: 12, lineHeight: 18, fontFamily: "Poppins_400Regular", color: "#7B7068" },
  actionIconWrap: { width: 48, height: 48, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  actionTitle: { fontSize: 15, fontFamily: "Poppins_600SemiBold", color: Colors.light.text },
  actionSub: { fontSize: 12, lineHeight: 18, fontFamily: "Poppins_400Regular", color: Colors.light.textSecondary },
  section: { paddingTop: 20 },
  sectionTitle: { fontSize: 15, fontFamily: "Poppins_600SemiBold", color: Colors.light.text, paddingHorizontal: 20, marginBottom: 12 },
  favoritesRow: { paddingHorizontal: 20, gap: 12 },
  favoriteChip: { alignItems: "center", gap: 5, width: 70 },
  favoriteAvatar: { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center" },
  favoriteAvatarImage: { width: 56, height: 56, borderRadius: 28, backgroundColor: Colors.light.backgroundSecondary },
  favoriteAvatarText: { fontSize: 18, fontFamily: "Poppins_700Bold", color: "rgba(255,255,255,0.9)" },
  favoriteName: { fontSize: 10, fontFamily: "Poppins_500Medium", color: Colors.light.textSecondary, textAlign: "center" },
  menuSection: { marginHorizontal: 20, marginTop: 20 },
  menuItem: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 18, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.light.divider },
  menuIconWrapper: { width: 38, height: 38, borderRadius: 11, backgroundColor: "transparent", alignItems: "center", justifyContent: "center" },
  menuContent: { flex: 1 },
  menuLabel: { fontSize: 14, fontFamily: "Poppins_500Medium", color: Colors.light.text },
  menuSub: { fontSize: 11, fontFamily: "Poppins_400Regular", color: Colors.light.textTertiary },
  becomeChefBanner: { paddingHorizontal: 20, marginTop: 20 },
  becomeChefGradient: { borderRadius: 18, overflow: "hidden" },
  becomeChefContent: { flexDirection: "row", alignItems: "center", gap: 14, padding: 16 },
  becomeChefText: { flex: 1 },
  becomeChefTitle: { fontSize: 15, fontFamily: "Poppins_600SemiBold", color: "#fff" },
  becomeChefDesc: { fontSize: 12, fontFamily: "Poppins_400Regular", color: "rgba(255,255,255,0.8)", marginTop: 2 },
  becomeChefBtn: { backgroundColor: "#fff", marginHorizontal: 16, marginBottom: 16, borderRadius: 12, paddingVertical: 10, alignItems: "center" },
  becomeChefBtnText: { fontSize: 13, fontFamily: "Poppins_600SemiBold", color: Colors.light.tint },
  logoutBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 20, marginHorizontal: 20, paddingVertical: 14 },
  logoutText: { fontSize: 14, fontFamily: "Poppins_500Medium", color: Colors.light.error },
});