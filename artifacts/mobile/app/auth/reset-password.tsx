import { Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  AuthAlert,
  AuthButton,
  AuthCard,
  AuthInput,
  AuthLinkRow,
  AuthScaffold,
} from "@/components/auth/AuthUI";
import { apiFetch } from "@/constants/api";
import Colors from "@/constants/colors";
import { getPasswordPolicyError, PASSWORD_POLICY_HINT } from "@/constants/password-policy";
import { useApp } from "@/contexts/AppContext";

const authUsersImage = require("../../assets/images/login-register-users.png");

export default function ResetPasswordScreen() {
  const { establishAuthSession } = useApp();
  const params = useLocalSearchParams();
  const token = typeof params?.token === "string" ? params.token : "";
  const initialStatus = typeof params?.status === "string" ? params.status : "";
  const initialMessage = typeof params?.message === "string" ? params.message : "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(initialStatus === "error" ? initialMessage : "");
  const [successMessage, setSuccessMessage] = useState(initialStatus === "error" ? "" : initialMessage);

  const subtitle = useMemo(() => {
    if (!token) {
      return "Ouvrez le lien recu par email pour definir un nouveau mot de passe.";
    }
    return "Choisissez un nouveau mot de passe pour debloquer votre compte.";
  }, [token]);

  const handleSubmit = async () => {
    setError("");
    setSuccessMessage("");

    if (!token) {
      setError("Le lien de reinitialisation est manquant ou invalide.");
      return;
    }

    const passwordError = getPasswordPolicyError(password);
    if (passwordError) {
      setError(passwordError);
      return;
    }

    if (password !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }

    setLoading(true);
    try {
      const response = await apiFetch<{ message?: string; token?: string; user?: unknown }>("/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ token, password }),
      });

      if (typeof response.token === "string" && response.user) {
        await establishAuthSession(response.token, response.user);
        router.replace("/(tabs)");
        return;
      }

      setSuccessMessage(response.message ?? "Votre mot de passe a ete reinitialise.");
      setPassword("");
      setConfirmPassword("");
    } catch (e: any) {
      setError(e?.message ?? "La reinitialisation a echoue.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthScaffold
      palette={{
        accent: Colors.light.tint,
        accentDark: Colors.light.tintDark,
        accentSoft: Colors.light.accent,
      }}
      eyebrow="Securite"
      title="Nouveau mot de passe"
      subtitle={subtitle}
      heroImageSource={authUsersImage}
      heroOverlayOpacity={0}
      footer={<AuthLinkRow prompt="Retour a la connexion" action="Se connecter" onPress={() => router.replace("/auth/login")} />}
    >
      <AuthAlert message={error} />

      <AuthCard>
        {successMessage ? (
          <View style={styles.successBox}>
            <Text style={styles.successText}>{successMessage}</Text>
          </View>
        ) : null}

        <AuthInput
          label="Nouveau mot de passe"
          icon="lock"
          value={password}
          onChangeText={setPassword}
          placeholder="Choisissez un mot de passe fort"
          secureTextEntry={!showPassword}
          hint={PASSWORD_POLICY_HINT}
          trailing={
            <Pressable onPress={() => setShowPassword((prev) => !prev)}>
              <Feather name={showPassword ? "eye-off" : "eye"} size={18} color={Colors.light.textTertiary} />
            </Pressable>
          }
        />

        <AuthInput
          label="Confirmer le mot de passe"
          icon="shield"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          placeholder="Retapez le nouveau mot de passe"
          secureTextEntry={!showPassword}
        />

        <Text style={styles.helperText}>
          Apres l'enregistrement, vous serez connecte automatiquement. {PASSWORD_POLICY_HINT}
        </Text>

        {successMessage ? (
          <AuthButton
            label="Aller a la connexion"
            onPress={() => router.replace("/auth/login")}
            icon="arrow-right"
            backgroundColor={Colors.light.tint}
          />
        ) : (
          <AuthButton
            label="Enregistrer le nouveau mot de passe"
            onPress={handleSubmit}
            loading={loading}
            icon="check"
            backgroundColor={Colors.light.tint}
          />
        )}
      </AuthCard>
    </AuthScaffold>
  );
}

const styles = StyleSheet.create({
  helperText: {
    fontSize: 12,
    lineHeight: 18,
    fontFamily: "Poppins_400Regular",
    color: Colors.light.textSecondary,
  },
  successBox: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.light.cardBorder,
    backgroundColor: Colors.light.backgroundSecondary,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  successText: {
    fontSize: 12,
    lineHeight: 18,
    fontFamily: "Poppins_500Medium",
    color: Colors.light.text,
  },
});
