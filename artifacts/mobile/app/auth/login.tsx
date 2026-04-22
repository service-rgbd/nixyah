import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  AuthAlert,
  AuthButton,
  AuthCard,
  AuthInput,
  AuthLinkRow,
  AuthScaffold,
} from "@/components/auth/AuthUI";
import { ApiError } from "@/constants/api";
import Colors from "@/constants/colors";
import { isPasskeySupportedOnDevice } from "@/constants/passkeys";
import { useApp } from "@/contexts/AppContext";

const authUsersImage = require("../../assets/images/login-register-users.png");
const chefHeroVideo = require("../../assets/images/0_Cooking_Baking_720x720.mp4");
const courierHeroVideo = require("../../assets/images/0_Delivery_Food_Delivery_1920x1080.mp4");

type LoginRole = "client" | "chef" | "courier";

export default function LoginScreen() {
  const { login, loginWithPasskey } = useApp();
  const [selectedRole, setSelectedRole] = useState<LoginRole>("chef");
  const [emailOrPhone, setEmailOrPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const roleMeta: Record<LoginRole, { eyebrow: string; title: string; subtitle: string; heroImageSource?: number; heroVideoSource?: number }> = {
    client: {
      eyebrow: "Nixyah",
      title: "Connexion client",
      subtitle: "Acces rapide.",
      heroImageSource: authUsersImage,
    },
    chef: {
      eyebrow: "Cuisiniere",
      title: "Connexion chef",
      subtitle: "Acces a votre vitrine.",
      heroVideoSource: chefHeroVideo,
    },
    courier: {
      eyebrow: "Livreur",
      title: "Connexion livreur",
      subtitle: "Acces a vos missions.",
      heroVideoSource: courierHeroVideo,
    },
  };

  const currentRole = roleMeta[selectedRole];
  const passkeySupported = isPasskeySupportedOnDevice();

  const handleLogin = async () => {
    if (!emailOrPhone.trim() || !password.trim()) {
      setError("Veuillez remplir tous les champs");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await login(emailOrPhone.trim(), password);
      router.replace("/(tabs)");
    } catch (e: any) {
      if (e instanceof ApiError && e.code === "EmailUnconfirmed") {
        const email = typeof e.body?.email === "string" ? e.body.email : undefined;
        router.replace({
          pathname: "/auth/confirm",
          params: email ? { email } : undefined,
        });
        return;
      }

      if (e instanceof ApiError && e.code === "AccountLocked") {
        const lockedEmail = typeof e.body?.email === "string"
          ? e.body.email
          : emailOrPhone.includes("@")
            ? emailOrPhone.trim()
            : undefined;
        router.replace({
          pathname: "/auth/forgot-password",
          params: {
            ...(lockedEmail ? { email: lockedEmail } : {}),
            locked: "1",
            message: e.message ?? "Votre compte est verrouille. Consultez votre messagerie pour reinitialiser votre mot de passe.",
          },
        });
        return;
      }

      setError(e.message ?? "Identifiants incorrects");
    } finally {
      setLoading(false);
    }
  };

  const handlePasskeyLogin = async () => {
    const normalizedEmail = emailOrPhone.trim().toLowerCase();
    if (!normalizedEmail || !normalizedEmail.includes("@")) {
      setError("Renseignez votre email pour utiliser une passkey");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await loginWithPasskey(normalizedEmail);
      router.replace("/(tabs)");
    } catch (e: any) {
      setError(e.message ?? "Connexion passkey impossible");
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
      eyebrow={currentRole.eyebrow}
      title={currentRole.title}
      subtitle={currentRole.subtitle}
      heroImageSource={currentRole.heroImageSource}
      heroVideoSource={currentRole.heroVideoSource}
      heroOverlayOpacity={0}
      footer={<AuthLinkRow prompt="Pas encore de compte ?" action="Créer un compte client" onPress={() => router.push("/auth/register-client")} />}
    >
      <AuthAlert message={error} />

      <AuthCard>
        <View style={styles.roleTabs}>
          <Pressable
            style={[styles.roleTab, selectedRole === "chef" ? styles.roleTabActive : null]}
            onPress={() => setSelectedRole("chef")}
          >
            <Text style={[styles.roleTabText, selectedRole === "chef" ? styles.roleTabTextActive : null]}>Cuisiniere</Text>
          </Pressable>
          <Pressable
            style={[styles.roleTab, selectedRole === "courier" ? styles.roleTabActive : null]}
            onPress={() => setSelectedRole("courier")}
          >
            <Text style={[styles.roleTabText, selectedRole === "courier" ? styles.roleTabTextActive : null]}>Livreur</Text>
          </Pressable>
          <Pressable
            style={[styles.roleTab, selectedRole === "client" ? styles.roleTabActive : null]}
            onPress={() => setSelectedRole("client")}
          >
            <Text style={[styles.roleTabText, selectedRole === "client" ? styles.roleTabTextActive : null]}>Client</Text>
          </Pressable>
        </View>

        <AuthInput
          label="Email ou téléphone"
          icon="user"
          value={emailOrPhone}
          onChangeText={setEmailOrPhone}
          placeholder="email@exemple.com ou +225..."
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
        />

        <AuthInput
          label="Mot de passe"
          icon="lock"
          value={password}
          onChangeText={setPassword}
          placeholder="Votre mot de passe"
          secureTextEntry={!showPassword}
          trailing={
            <Pressable onPress={() => setShowPassword((prev) => !prev)}>
              <Feather name={showPassword ? "eye-off" : "eye"} size={18} color={Colors.light.textTertiary} />
            </Pressable>
          }
        />

        <Pressable style={styles.forgotPasswordLink} onPress={() => router.push("/auth/forgot-password")}>
          <Text style={styles.forgotPasswordText}>Mot de passe oublié ?</Text>
        </Pressable>

        <AuthButton
          label="Se connecter"
          onPress={handleLogin}
          loading={loading}
          icon="arrow-right"
          backgroundColor={Colors.light.tint}
        />

        {passkeySupported ? (
          <AuthButton
            label="Continuer avec une passkey"
            onPress={handlePasskeyLogin}
            loading={loading}
            icon="shield"
            backgroundColor="#0F766E"
          />
        ) : null}

        <View style={styles.quickActionsRow}>
          <Pressable style={[styles.quickAction, { borderColor: Colors.light.terracotta }]} onPress={() => router.push("/auth/register-chef")}>
            <Feather name="coffee" size={15} color={Colors.light.terracotta} />
            <Text style={[styles.quickActionText, { color: Colors.light.terracotta }]}>Parcours chef</Text>
          </Pressable>
          <Pressable style={[styles.quickAction, { borderColor: "#0F766E" }]} onPress={() => router.push("/auth/register-courier")}>
            <Feather name="truck" size={15} color="#0F766E" />
            <Text style={[styles.quickActionText, { color: "#0F766E" }]}>Parcours livreur</Text>
          </Pressable>
        </View>
      </AuthCard>
    </AuthScaffold>
  );
}

const styles = StyleSheet.create({
  roleTabs: {
    flexDirection: "row",
    gap: 8,
  },
  roleTab: {
    flex: 1,
    minHeight: 40,
    borderRadius: 999,
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "rgba(104,83,69,0.14)",
    alignItems: "center",
    justifyContent: "center",
  },
  roleTabActive: {
    backgroundColor: "transparent",
    borderColor: Colors.light.tint,
  },
  roleTabText: {
    fontSize: 12,
    fontFamily: "Poppins_600SemiBold",
    color: Colors.light.textSecondary,
  },
  roleTabTextActive: {
    color: Colors.light.tint,
  },
  forgotPasswordLink: {
    alignSelf: "flex-start",
    paddingVertical: 4,
  },
  forgotPasswordText: {
    fontSize: 12,
    fontFamily: "Poppins_600SemiBold",
    color: Colors.light.tint,
  },
  quickActionsRow: {
    flexDirection: "row",
    gap: 10,
  },
  quickAction: {
    flex: 1,
    minHeight: 46,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  quickActionText: {
    fontSize: 13,
    fontFamily: "Poppins_600SemiBold",
  },
});
