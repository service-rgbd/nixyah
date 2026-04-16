import { Feather } from "@expo/vector-icons";
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

import Colors from "@/constants/colors";
import { uploadFile } from "@/constants/api";
import { useApp } from "@/contexts/AppContext";

type DocumentKey = "identityDocumentUrl" | "driverLicenseUrl" | "vehicleRegistrationUrl" | "vehiclePhotoUrl" | "selfiePhotoUrl";

const REQUIRED_DOCUMENTS: Array<{
  key: DocumentKey;
  title: string;
  subtitle: string;
  icon: keyof typeof Feather.glyphMap;
}> = [
  { key: "identityDocumentUrl", title: "Pièce d'identité", subtitle: "CNI, passeport ou récépissé lisible", icon: "credit-card" },
  { key: "driverLicenseUrl", title: "Permis de conduire", subtitle: "Recto lisible et en cours de validité", icon: "shield" },
  { key: "vehicleRegistrationUrl", title: "Carte grise", subtitle: "Document du véhicule utilisé pour les missions", icon: "file-text" },
  { key: "vehiclePhotoUrl", title: "Photo du véhicule", subtitle: "Photo nette du véhicule réellement utilisé", icon: "truck" },
  { key: "selfiePhotoUrl", title: "Selfie de vérification", subtitle: "Photo récente de vous, visage bien visible", icon: "camera" },
];

function getFileName(uri: string, fallback: string) {
  const lastSegment = uri.split("/").pop()?.split("?")[0];
  return lastSegment && lastSegment.includes(".") ? lastSegment : fallback;
}

export default function CourierVerificationScreen() {
  const insets = useSafeAreaInsets();
  const { user, token, updateCourierVerificationDossier } = useApp();
  const [uploadingKey, setUploadingKey] = useState<DocumentKey | null>(null);
  const [saving, setSaving] = useState(false);

  const verificationDocuments = user?.courierProfile?.verificationDocuments;
  const completedCount = useMemo(
    () => REQUIRED_DOCUMENTS.filter((item) => Boolean(verificationDocuments?.[item.key])).length,
    [verificationDocuments]
  );
  const isComplete = completedCount === REQUIRED_DOCUMENTS.length;

  const handlePickDocument = async (key: DocumentKey) => {
    if (!token) {
      Alert.alert("Session requise", "Reconnectez-vous pour compléter votre dossier.");
      return;
    }

    setUploadingKey(key);
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (permission.status !== "granted") {
        Alert.alert("Accès requis", "Autorisez l'accès aux photos pour envoyer vos pièces.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.9,
        selectionLimit: 1,
      });
      if (result.canceled || !result.assets?.length) {
        return;
      }

      const asset = result.assets[0];
      const contentType = asset.mimeType || "image/jpeg";
      const filename = getFileName(asset.uri, `${key}.jpg`);
      const uploaded = await uploadFile({
        fileUri: asset.uri,
        filename,
        contentType,
        purpose: "courier-document",
        token,
      });

      await updateCourierVerificationDossier({ [key]: uploaded.publicUrl ?? null });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Impossible d'envoyer ce document.";
      Alert.alert("Envoi impossible", message);
    } finally {
      setUploadingKey(null);
    }
  };

  const handleSubmitDossier = async () => {
    if (!isComplete) {
      Alert.alert("Dossier incomplet", "Ajoutez les 5 pièces requises avant de soumettre votre dossier.");
      return;
    }

    if (!verificationDocuments) {
      Alert.alert("Dossier incomplet", "Ajoutez les 5 pièces requises avant de soumettre votre dossier.");
      return;
    }

    setSaving(true);
    try {
      await updateCourierVerificationDossier({
        identityDocumentUrl: verificationDocuments.identityDocumentUrl ?? null,
        driverLicenseUrl: verificationDocuments.driverLicenseUrl ?? null,
        vehicleRegistrationUrl: verificationDocuments.vehicleRegistrationUrl ?? null,
        vehiclePhotoUrl: verificationDocuments.vehiclePhotoUrl ?? null,
        selfiePhotoUrl: verificationDocuments.selfiePhotoUrl ?? null,
      });
      Alert.alert("Dossier envoyé", "Votre dossier est complet. L'équipe Nixyah peut maintenant le vérifier.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Impossible de finaliser le dossier.";
      Alert.alert("Erreur", message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={[styles.screen, { paddingTop: Platform.OS === "web" ? 67 : insets.top + 10 }]}> 
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Feather name="arrow-left" size={18} color={Colors.light.text} />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>Dossier livreur</Text>
          <Text style={styles.title}>Compléter mon dossier</Text>
          <Text style={styles.subtitle}>Les missions restent bloquées tant que les pièces requises ne sont pas envoyées puis validées.</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.summaryCard}>
          <View>
            <Text style={styles.summaryLabel}>Avancement</Text>
            <Text style={styles.summaryValue}>{completedCount}/{REQUIRED_DOCUMENTS.length}</Text>
            <Text style={styles.summaryMeta}>{isComplete ? "Dossier complet, prêt pour revue" : "Ajoutez toutes les pièces avant soumission"}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: user?.courierProfile?.isVerified ? "#DCFCE7" : isComplete ? "#FEF3C7" : "#F3F4F6" }]}>
            <Text style={[styles.statusBadgeText, { color: user?.courierProfile?.isVerified ? "#166534" : isComplete ? "#92400E" : "#4B5563" }]}>
              {user?.courierProfile?.isVerified ? "Vérifié" : isComplete ? "En attente" : "Incomplet"}
            </Text>
          </View>
        </View>

        {REQUIRED_DOCUMENTS.map((item) => {
          const documentUrl = verificationDocuments?.[item.key] ?? null;
          const isUploading = uploadingKey === item.key;
          return (
            <View key={item.key} style={styles.documentCard}>
              <View style={styles.documentHead}>
                <View style={styles.documentIconWrap}>
                  <Feather name={item.icon} size={18} color="#0F766E" />
                </View>
                <View style={styles.documentCopy}>
                  <Text style={styles.documentTitle}>{item.title}</Text>
                  <Text style={styles.documentSubtitle}>{item.subtitle}</Text>
                </View>
                <View style={[styles.documentPill, documentUrl ? styles.documentPillOk : styles.documentPillPending]}>
                  <Text style={[styles.documentPillText, documentUrl ? styles.documentPillTextOk : styles.documentPillTextPending]}>
                    {documentUrl ? "Ajouté" : "Requis"}
                  </Text>
                </View>
              </View>

              {documentUrl ? <Image source={{ uri: documentUrl }} style={styles.documentPreview} resizeMode="cover" /> : null}

              <Pressable style={[styles.uploadButton, isUploading && styles.uploadButtonDisabled]} onPress={() => void handlePickDocument(item.key)} disabled={isUploading}>
                {isUploading ? <ActivityIndicator color="#fff" /> : <Text style={styles.uploadButtonText}>{documentUrl ? "Remplacer la pièce" : "Ajouter la pièce"}</Text>}
              </Pressable>
            </View>
          );
        })}

        <View style={styles.noticeCard}>
          <Feather name="info" size={16} color="#0F766E" />
          <Text style={styles.noticeText}>Seuls les dossiers complets peuvent être validés par l'équipe admin. Une fois les pièces envoyées, le statut passera en revue jusqu'à validation.</Text>
        </View>

        <Pressable style={[styles.submitButton, (!isComplete || saving) && styles.submitButtonDisabled]} disabled={!isComplete || saving} onPress={() => void handleSubmitDossier()}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitButtonText}>Finaliser mon dossier</Text>}
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#FCFBF9",
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 14,
    gap: 14,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F3EEE8",
  },
  headerCopy: {
    gap: 6,
  },
  eyebrow: {
    fontSize: 11,
    fontFamily: "Poppins_700Bold",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: "#0F766E",
  },
  title: {
    fontSize: 24,
    fontFamily: "Poppins_700Bold",
    color: Colors.light.text,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 20,
    fontFamily: "Poppins_400Regular",
    color: Colors.light.textSecondary,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    gap: 14,
  },
  summaryCard: {
    borderRadius: 24,
    backgroundColor: "#F5F2EE",
    borderWidth: 1,
    borderColor: "rgba(104,83,69,0.08)",
    padding: 18,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  summaryLabel: {
    fontSize: 12,
    fontFamily: "Poppins_500Medium",
    color: Colors.light.textSecondary,
  },
  summaryValue: {
    marginTop: 4,
    fontSize: 28,
    fontFamily: "Poppins_700Bold",
    color: Colors.light.text,
  },
  summaryMeta: {
    marginTop: 6,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: "Poppins_400Regular",
    color: Colors.light.textSecondary,
    maxWidth: 220,
  },
  statusBadge: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  statusBadgeText: {
    fontSize: 11,
    fontFamily: "Poppins_700Bold",
    textTransform: "uppercase",
  },
  documentCard: {
    borderRadius: 22,
    backgroundColor: Colors.light.card,
    borderWidth: 1,
    borderColor: Colors.light.cardBorder,
    padding: 16,
    gap: 12,
  },
  documentHead: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
  },
  documentIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ECFDF5",
  },
  documentCopy: {
    flex: 1,
    gap: 4,
  },
  documentTitle: {
    fontSize: 15,
    fontFamily: "Poppins_600SemiBold",
    color: Colors.light.text,
  },
  documentSubtitle: {
    fontSize: 12,
    lineHeight: 18,
    fontFamily: "Poppins_400Regular",
    color: Colors.light.textSecondary,
  },
  documentPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  documentPillOk: {
    backgroundColor: "#DCFCE7",
  },
  documentPillPending: {
    backgroundColor: "#FEF3C7",
  },
  documentPillText: {
    fontSize: 10,
    fontFamily: "Poppins_700Bold",
    textTransform: "uppercase",
  },
  documentPillTextOk: {
    color: "#166534",
  },
  documentPillTextPending: {
    color: "#92400E",
  },
  documentPreview: {
    width: "100%",
    height: 180,
    borderRadius: 18,
    backgroundColor: Colors.light.backgroundSecondary,
  },
  uploadButton: {
    borderRadius: 16,
    backgroundColor: "#0F766E",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
  },
  uploadButtonDisabled: {
    opacity: 0.7,
  },
  uploadButtonText: {
    fontSize: 14,
    fontFamily: "Poppins_600SemiBold",
    color: "#fff",
  },
  noticeCard: {
    borderRadius: 18,
    backgroundColor: "#ECFDF5",
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 10,
    flexDirection: "row",
  },
  noticeText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: "Poppins_500Medium",
    color: "#0F766E",
  },
  submitButton: {
    borderRadius: 18,
    backgroundColor: Colors.light.tint,
    minHeight: 54,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  submitButtonDisabled: {
    backgroundColor: "#C8C1BA",
  },
  submitButtonText: {
    fontSize: 15,
    fontFamily: "Poppins_600SemiBold",
    color: "#fff",
  },
});