import { router, useLocalSearchParams } from "expo-router";
import React, { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
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

const authUsersImage = require("../../assets/images/login-register-users.png");

export default function ForgotPasswordScreen() {
  const params = useLocalSearchParams();
  const locked = params?.locked === "1";
  const initialEmail = typeof params?.email === "string" ? params.email : "";
  const initialMessage = typeof params?.message === "string" ? params.message : "";

  const [email, setEmail] = useState(initialEmail);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState(initialMessage);
  const [loading, setLoading] = useState(false);

  const helperText = useMemo(() => {
    if (locked) {
      return "Votre compte est verrouille. Verifiez votre messagerie ou renvoyez un nouveau lien.";
    }
    return "Entrez l'adresse email utilisee lors de l'inscription.";
  }, [locked]);

  const handleSubmit = async () => {
    setError("");
    setSuccessMessage("");

    if (!email.trim()) {
      setError("Entrez votre adresse email");
      return;
    }

    setLoading(true);

    try {
      const response = await apiFetch<{ message?: string }>("/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email: email.trim() }),
      });
      setSuccessMessage(response.message ?? "Si un compte existe pour cette adresse, un lien a ete envoye.");
    } catch (e: any) {
      setError(e?.message ?? "Impossible d'envoyer le lien pour le moment.");
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
      eyebrow="Sécurité"
      title="Mot de passe oublié"
      subtitle={locked ? "Compte verrouille, reinitialisation requise." : "Retrouvez l'acces a votre compte."}
      heroImageSource={authUsersImage}
      heroOverlayOpacity={0}
      footer={<AuthLinkRow prompt="Vous vous souvenez de votre mot de passe ?" action="Se connecter" onPress={() => router.push("/auth/login")} />}
    >
      <AuthAlert message={error} />

      <AuthCard>
        <AuthInput
          label="Adresse email"
          icon="mail"
          value={email}
          onChangeText={setEmail}
          placeholder="email@exemple.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          hint="Le lien de reinitialisation est envoye uniquement par email."
        />

        {successMessage ? (
          <View style={styles.successBox}>
            <Text style={styles.successText}>{successMessage}</Text>
          </View>
        ) : null}

        <Text style={styles.helperText}>{helperText}</Text>

        <AuthButton
          label={locked ? "Renvoyer le lien" : "Envoyer le lien"}
          onPress={handleSubmit}
          loading={loading}
          icon="send"
          backgroundColor={Colors.light.tint}
        />
      </AuthCard>
    </AuthScaffold>
  );
}

const styles = StyleSheet.create({
  helperText: {
    fontSize: 12,
    lineHeight: 18,
    fontFamily: "Poppins_400Regular" as const,
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
    fontFamily: "Poppins_500Medium" as const,
    color: Colors.light.text,
  },
});
