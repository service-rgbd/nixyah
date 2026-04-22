import { Feather } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Colors from "@/constants/colors";
import { isPasskeySupportedOnDevice, type PasskeySummary } from "@/constants/passkeys";
import { useApp } from "@/contexts/AppContext";

export default function PasskeysSettingsScreen() {
  const insets = useSafeAreaInsets();
  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const { listPasskeys, registerPasskey, deletePasskey } = useApp();
  const [passkeys, setPasskeys] = useState<PasskeySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const supported = isPasskeySupportedOnDevice();

  const loadPasskeys = useCallback(async () => {
    try {
      setError("");
      setLoading(true);
      const nextPasskeys = await listPasskeys();
      setPasskeys(nextPasskeys);
    } catch (err: any) {
      setError(err?.message ?? "Impossible de charger vos passkeys");
    } finally {
      setLoading(false);
    }
  }, [listPasskeys]);

  useFocusEffect(useCallback(() => {
    void loadPasskeys();
  }, [loadPasskeys]));

  const emptyStateLabel = useMemo(() => {
    if (!supported) {
      return "Les passkeys demandent un build natif iOS/Android. Expo Go ne peut pas les utiliser.";
    }

    return "Aucune passkey enregistrée pour ce compte.";
  }, [supported]);

  const handleAddPasskey = async () => {
    try {
      setSaving(true);
      setError("");
      const nextPasskeys = await registerPasskey();
      setPasskeys(nextPasskeys);
      Alert.alert("Passkey ajoutée", "Votre appareil peut maintenant se connecter sans mot de passe.");
    } catch (err: any) {
      setError(err?.message ?? "Impossible d'ajouter cette passkey");
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePasskey = (passkey: PasskeySummary) => {
    Alert.alert(
      "Supprimer cette passkey ?",
      "Vous garderez toujours la connexion par email et mot de passe comme solution de secours.",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Supprimer",
          style: "destructive",
          onPress: async () => {
            try {
              setSaving(true);
              setError("");
              await deletePasskey(passkey.id);
              setPasskeys((current) => current.filter((item) => item.id !== passkey.id));
            } catch (err: any) {
              setError(err?.message ?? "Suppression impossible");
            } finally {
              setSaving(false);
            }
          },
        },
      ],
    );
  };

  return (
    <View style={[styles.container, { paddingTop: topInset }]}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="arrow-left" size={20} color={Colors.light.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Passkeys</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.heroCard}>
          <View style={styles.heroBadge}>
            <Feather name="shield" size={15} color={Colors.light.tint} />
            <Text style={styles.heroBadgeText}>Connexion sans mot de passe</Text>
          </View>
          <Text style={styles.heroTitle}>Ajoutez une passkey biométrique</Text>
          <Text style={styles.heroText}>
            Utilisez Face ID, empreinte ou verrouillage de votre téléphone pour vous connecter plus vite, sans remplacer votre email ni votre mot de passe.
          </Text>
          <Pressable
            style={[styles.primaryButton, (!supported || saving) && styles.primaryButtonDisabled]}
            onPress={handleAddPasskey}
            disabled={!supported || saving}
          >
            {saving ? <ActivityIndicator color="#fff" size="small" /> : <Feather name="plus" size={16} color="#fff" />}
            <Text style={styles.primaryButtonText}>Ajouter une passkey</Text>
          </Pressable>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Pré-requis</Text>
          <Text style={styles.infoText}>1. Utiliser un build natif Android ou iOS.</Text>
          <Text style={styles.infoText}>2. Garder votre email confirmé et votre mot de passe comme secours.</Text>
          <Text style={styles.infoText}>3. Configurer le domaine public et les fichiers d'association lors du déploiement.</Text>
        </View>

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <Text style={styles.sectionTitle}>Mes passkeys</Text>

        {loading ? (
          <View style={styles.stateCard}>
            <ActivityIndicator color={Colors.light.tint} />
          </View>
        ) : passkeys.length === 0 ? (
          <View style={styles.stateCard}>
            <Text style={styles.stateText}>{emptyStateLabel}</Text>
          </View>
        ) : (
          <View style={styles.listCard}>
            {passkeys.map((passkey, index) => (
              <View
                key={passkey.id}
                style={[styles.passkeyRow, index === passkeys.length - 1 ? null : styles.passkeyRowBorder]}
              >
                <View style={styles.passkeyMain}>
                  <Text style={styles.passkeyName}>{passkey.deviceName}</Text>
                  <Text style={styles.passkeyMeta}>
                    {passkey.backedUp ? "Synchronisée" : "Locale"} · {passkey.credentialIdPreview}
                  </Text>
                  <Text style={styles.passkeyMeta}>
                    Créée le {new Date(passkey.createdAt).toLocaleDateString("fr-FR")}
                    {passkey.lastUsedAt ? ` · Utilisée le ${new Date(passkey.lastUsedAt).toLocaleDateString("fr-FR")}` : ""}
                  </Text>
                </View>
                <Pressable
                  style={[styles.deleteBtn, saving && styles.deleteBtnDisabled]}
                  onPress={() => handleDeletePasskey(passkey)}
                  disabled={saving}
                >
                  <Feather name="trash-2" size={16} color={Colors.light.error} />
                </Pressable>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.divider,
    backgroundColor: Colors.light.card,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.light.backgroundSecondary,
  },
  headerTitle: {
    fontSize: 17,
    fontFamily: "Poppins_700Bold",
    color: Colors.light.text,
  },
  headerSpacer: { width: 40, height: 40 },
  content: { padding: 20, gap: 16, paddingBottom: 32 },
  heroCard: {
    backgroundColor: Colors.light.card,
    borderRadius: 24,
    padding: 20,
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.light.divider,
  },
  heroBadge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: Colors.light.backgroundSecondary,
  },
  heroBadgeText: {
    fontSize: 12,
    fontFamily: "Poppins_600SemiBold",
    color: Colors.light.tint,
  },
  heroTitle: {
    fontSize: 20,
    fontFamily: "Poppins_700Bold",
    color: Colors.light.text,
  },
  heroText: {
    fontSize: 13,
    lineHeight: 21,
    fontFamily: "Poppins_400Regular",
    color: Colors.light.textSecondary,
  },
  primaryButton: {
    minHeight: 50,
    marginTop: 4,
    borderRadius: 16,
    backgroundColor: "#0F766E",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  primaryButtonDisabled: {
    opacity: 0.55,
  },
  primaryButtonText: {
    fontSize: 14,
    fontFamily: "Poppins_600SemiBold",
    color: "#fff",
  },
  infoCard: {
    backgroundColor: "#EFF6FF",
    borderRadius: 20,
    padding: 16,
    gap: 6,
  },
  infoTitle: {
    fontSize: 14,
    fontFamily: "Poppins_700Bold",
    color: "#1D4ED8",
  },
  infoText: {
    fontSize: 12,
    lineHeight: 18,
    fontFamily: "Poppins_400Regular",
    color: "#1E3A8A",
  },
  errorBox: {
    borderRadius: 16,
    padding: 14,
    backgroundColor: "#FEF2F2",
  },
  errorText: {
    fontSize: 12,
    lineHeight: 18,
    fontFamily: "Poppins_500Medium",
    color: Colors.light.error,
  },
  sectionTitle: {
    fontSize: 15,
    fontFamily: "Poppins_700Bold",
    color: Colors.light.text,
  },
  stateCard: {
    minHeight: 108,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    backgroundColor: Colors.light.card,
    borderWidth: 1,
    borderColor: Colors.light.divider,
  },
  stateText: {
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
    fontFamily: "Poppins_400Regular",
    color: Colors.light.textSecondary,
  },
  listCard: {
    backgroundColor: Colors.light.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.light.divider,
  },
  passkeyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
  },
  passkeyRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.divider,
  },
  passkeyMain: {
    flex: 1,
    gap: 4,
  },
  passkeyName: {
    fontSize: 14,
    fontFamily: "Poppins_600SemiBold",
    color: Colors.light.text,
  },
  passkeyMeta: {
    fontSize: 12,
    lineHeight: 18,
    fontFamily: "Poppins_400Regular",
    color: Colors.light.textSecondary,
  },
  deleteBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FEF2F2",
  },
  deleteBtnDisabled: {
    opacity: 0.5,
  },
});
