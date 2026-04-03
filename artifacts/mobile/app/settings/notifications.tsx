import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Colors from "@/constants/colors";
import {
  getExpoProjectId,
  getPushNotificationsEnabled,
  getPushPermissionStatus,
  isRemotePushSupportedInCurrentRuntime,
  registerExpoPushSubscription,
  unregisterExpoPushSubscription,
} from "@/constants/push-notifications";
import { useApp } from "@/contexts/AppContext";

export default function NotificationSettingsScreen() {
  const insets = useSafeAreaInsets();
  const { token, user } = useApp();
  const [enabled, setEnabled] = useState(true);
  const [permissionStatus, setPermissionStatus] = useState<"undetermined" | "denied" | "granted" | "unsupported">("undetermined");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const supportsRemotePush = isRemotePushSupportedInCurrentRuntime();
  const projectId = getExpoProjectId();
  const topInset = Platform.OS === "web" ? 48 : insets.top + 12;

  useEffect(() => {
    let isMounted = true;

    const loadState = async () => {
      try {
        const [storedEnabled, storedPermission] = await Promise.all([
          getPushNotificationsEnabled(),
          getPushPermissionStatus(),
        ]);

        if (!isMounted) {
          return;
        }

        setEnabled(storedEnabled);
        setPermissionStatus(storedPermission);
      } catch (error) {
        console.warn("notification settings load failed", error);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadState();

    return () => {
      isMounted = false;
    };
  }, []);

  const permissionLabel = useMemo(() => {
    if (permissionStatus === "granted") {
      return "Autorisees";
    }

    if (permissionStatus === "denied") {
      return "Bloquees";
    }

    if (permissionStatus === "unsupported") {
      return "Limitees dans Expo Go";
    }

    return "A confirmer";
  }, [permissionStatus]);

  const handleOpenDeviceSettings = async () => {
    try {
      await Linking.openSettings();
    } catch {
      Alert.alert("Réglages", "Ouvrez les réglages du téléphone puis Notifications > Nixyah.");
    }
  };

  const handleToggle = async (nextValue: boolean) => {
    if (isSaving) {
      return;
    }

    if (!token || !user) {
      Alert.alert("Connexion requise", "Connectez-vous d'abord pour gérer vos notifications push.");
      return;
    }

    setIsSaving(true);

    try {
      if (nextValue) {
        if (!supportsRemotePush) {
          Alert.alert(
            "Build requis",
            "Les notifications push réelles ne sont pas entièrement prises en charge dans Expo Go sur cet appareil. Utilisez un development build pour les tester proprement.",
          );
          setPermissionStatus(await getPushPermissionStatus());
          setEnabled(false);
          return;
        }

        const result = await registerExpoPushSubscription(token);
        const refreshedPermissionStatus = await getPushPermissionStatus();
        setPermissionStatus(refreshedPermissionStatus);

        if (!result.ok) {
          setEnabled(false);

          if (result.reason === "missing-project-id") {
            Alert.alert("Project ID manquant", "Ajoutez EXPO_PUBLIC_EXPO_PROJECT_ID dans la configuration mobile avant d'activer les notifications.");
          } else if (result.reason === "permission-denied") {
            Alert.alert("Autorisation refusée", "Activez les notifications dans les réglages de votre téléphone pour recevoir les alertes Nixyah.");
          } else if (result.reason === "unsupported-runtime") {
            Alert.alert("Build requis", "Passez par un development build pour tester les notifications push sur cet appareil.");
          } else {
            Alert.alert("Activation impossible", "Le token push n'a pas pu être généré. Réessayez après avoir relancé l'application.");
          }

          return;
        }

        setEnabled(true);
        Alert.alert("Notifications activées", "Les nouvelles commandes, missions et mises à jour seront envoyées sur cet appareil.");
        return;
      }

      await unregisterExpoPushSubscription(token);
      setEnabled(false);
      setPermissionStatus(await getPushPermissionStatus());
    } catch (error) {
      console.warn("notification settings update failed", error);
      Alert.alert("Erreur", "Impossible de mettre à jour les notifications pour le moment.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={[styles.content, { paddingTop: topInset, paddingBottom: insets.bottom + 24 }]}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Feather name="arrow-left" size={18} color={Colors.light.text} />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>Parametres</Text>
          <Text style={styles.title}>Notifications</Text>
          <Text style={styles.subtitle}>Activez ou coupez les alertes push pour cet appareil.</Text>
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.settingRow}>
          <View style={styles.settingCopy}>
            <Text style={styles.settingTitle}>Notifications push</Text>
            <Text style={styles.settingDescription}>Commandes, missions livreur, progression de livraison et alertes importantes.</Text>
          </View>
          {isLoading ? (
            <ActivityIndicator color={Colors.light.tint} />
          ) : (
            <Switch
              value={enabled}
              onValueChange={(value) => void handleToggle(value)}
              disabled={isSaving}
              trackColor={{ false: Colors.light.backgroundTertiary, true: Colors.light.tintLight }}
              thumbColor={enabled ? Colors.light.tint : "#FFFFFF"}
            />
          )}
        </View>

        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Etat systeme</Text>
          <View style={[styles.badge, permissionStatus === "granted" ? styles.badgeSuccess : styles.badgeWarning]}>
            <Text style={[styles.badgeText, permissionStatus === "granted" ? styles.badgeTextSuccess : styles.badgeTextWarning]}>{permissionLabel}</Text>
          </View>
        </View>

        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Expo project ID</Text>
          <Text style={styles.metaValue}>{projectId ?? "Non configure"}</Text>
        </View>
      </View>

      {!supportsRemotePush ? (
        <View style={[styles.noticeCard, styles.noticeWarning]}>
          <Feather name="alert-triangle" size={18} color={Colors.light.warning} />
          <View style={styles.noticeCopy}>
            <Text style={styles.noticeTitle}>Expo Go est limite ici</Text>
            <Text style={styles.noticeText}>Pour tester les notifications push réelles, utilisez un development build au lieu d'Expo Go sur cet appareil.</Text>
          </View>
        </View>
      ) : null}

      {permissionStatus === "denied" ? (
        <View style={[styles.noticeCard, styles.noticeDanger]}>
          <Feather name="bell-off" size={18} color={Colors.light.error} />
          <View style={styles.noticeCopy}>
            <Text style={styles.noticeTitle}>Autorisation bloquée</Text>
            <Text style={styles.noticeText}>L'application ne peut plus demander la permission. Il faut l'activer dans les réglages du téléphone.</Text>
          </View>
          <Pressable style={styles.secondaryButton} onPress={() => void handleOpenDeviceSettings()}>
            <Text style={styles.secondaryButtonText}>Ouvrir les reglages</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Ce que vous recevez</Text>
        <View style={styles.bulletList}>
          <Text style={styles.bulletItem}>• Nouvelles commandes et changements de statut client</Text>
          <Text style={styles.bulletItem}>• Missions de livraison et mises a jour du trajet</Text>
          <Text style={styles.bulletItem}>• Alertes prioritaires liees a votre compte</Text>
        </View>
      </View>

      {user?.type === "chef" ? (
        <Pressable style={styles.primaryButton} onPress={() => router.push("/chef/notifications")}>
          <Text style={styles.primaryButtonText}>Voir le centre de notifications</Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  content: {
    paddingHorizontal: 20,
    gap: 16,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.light.card,
    borderWidth: 1,
    borderColor: Colors.light.cardBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCopy: {
    flex: 1,
    gap: 4,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.light.tint,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: Colors.light.text,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: Colors.light.textSecondary,
  },
  card: {
    backgroundColor: Colors.light.card,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: Colors.light.cardBorder,
    gap: 16,
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  settingCopy: {
    flex: 1,
    gap: 6,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.light.text,
  },
  settingDescription: {
    fontSize: 13,
    lineHeight: 19,
    color: Colors.light.textSecondary,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  metaLabel: {
    fontSize: 13,
    color: Colors.light.textSecondary,
  },
  metaValue: {
    flex: 1,
    textAlign: "right",
    fontSize: 12,
    color: Colors.light.text,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  badgeSuccess: {
    backgroundColor: "#E8F8EE",
  },
  badgeWarning: {
    backgroundColor: "#FFF4E5",
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  badgeTextSuccess: {
    color: Colors.light.success,
  },
  badgeTextWarning: {
    color: Colors.light.warning,
  },
  noticeCard: {
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    gap: 12,
  },
  noticeWarning: {
    backgroundColor: "#FFF8EC",
    borderColor: "#F7C27B",
  },
  noticeDanger: {
    backgroundColor: "#FDF0EE",
    borderColor: "#F3B3AA",
  },
  noticeCopy: {
    gap: 4,
  },
  noticeTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.light.text,
  },
  noticeText: {
    fontSize: 13,
    lineHeight: 19,
    color: Colors.light.textSecondary,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: Colors.light.text,
  },
  bulletList: {
    gap: 8,
  },
  bulletItem: {
    fontSize: 13,
    lineHeight: 19,
    color: Colors.light.textSecondary,
  },
  primaryButton: {
    backgroundColor: Colors.light.tint,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  secondaryButton: {
    alignSelf: "flex-start",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.light.cardBorder,
    backgroundColor: Colors.light.card,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  secondaryButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.light.text,
  },
});