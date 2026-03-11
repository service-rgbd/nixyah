import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Colors from "@/constants/colors";
import { useApp } from "@/contexts/AppContext";

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { login } = useApp();
  const [emailOrPhone, setEmailOrPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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
      setError(e.message ?? "Identifiants incorrects");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <LinearGradient
        colors={[Colors.light.tint, Colors.light.tintDark]}
        style={[styles.header, { paddingTop: insets.top + 20 }]}
      >
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="arrow-left" size={20} color="#fff" />
        </Pressable>
        <Text style={styles.headerTitle}>Bon retour 👋</Text>
        <Text style={styles.headerSub}>Connectez-vous à votre compte Nixyah</Text>
      </LinearGradient>

      <ScrollView style={styles.body} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={styles.form}>
          {error ? (
            <View style={styles.errorBox}>
              <Feather name="alert-circle" size={15} color={Colors.light.error} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Email ou téléphone</Text>
            <View style={styles.inputRow}>
              <Feather name="user" size={16} color={Colors.light.textTertiary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={emailOrPhone}
                onChangeText={setEmailOrPhone}
                placeholder="email@exemple.com ou +225..."
                placeholderTextColor={Colors.light.textTertiary}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Mot de passe</Text>
            <View style={styles.inputRow}>
              <Feather name="lock" size={16} color={Colors.light.textTertiary} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={password}
                onChangeText={setPassword}
                placeholder="Votre mot de passe"
                placeholderTextColor={Colors.light.textTertiary}
                secureTextEntry={!showPassword}
              />
              <Pressable onPress={() => setShowPassword(!showPassword)} style={{ padding: 4 }}>
                <Feather name={showPassword ? "eye-off" : "eye"} size={16} color={Colors.light.textTertiary} />
              </Pressable>
            </View>
          </View>

          <Pressable style={[styles.loginBtn, loading && { opacity: 0.7 }]} onPress={handleLogin} disabled={loading}>
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.loginBtnText}>Se connecter</Text>
            )}
          </Pressable>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>ou</Text>
            <View style={styles.dividerLine} />
          </View>

          <View style={styles.signupRow}>
            <Text style={styles.signupText}>Pas encore de compte ?</Text>
            <Pressable onPress={() => router.push("/auth/register-client")}>
              <Text style={styles.signupLink}>S'inscrire</Text>
            </Pressable>
          </View>

          <View style={[styles.signupRow, { marginTop: 12 }]}>
            <Text style={styles.signupText}>Vous cuisinez ?</Text>
            <Pressable onPress={() => router.push("/auth/register-chef")}>
              <Text style={[styles.signupLink, { color: Colors.light.tintDark }]}>Inscription cuisinière</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingBottom: 32,
    paddingHorizontal: 24,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 28,
    fontFamily: "Poppins_700Bold",
    color: "#fff",
    marginBottom: 6,
  },
  headerSub: {
    fontSize: 14,
    fontFamily: "Poppins_400Regular",
    color: "rgba(255,255,255,0.85)",
  },
  body: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  form: {
    padding: 24,
    gap: 16,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FEF2F2",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#FCA5A5",
  },
  errorText: {
    fontSize: 13,
    fontFamily: "Poppins_400Regular",
    color: Colors.light.error,
    flex: 1,
  },
  fieldGroup: { gap: 6 },
  label: {
    fontSize: 13,
    fontFamily: "Poppins_600SemiBold",
    color: Colors.light.text,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.light.backgroundSecondary,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.light.cardBorder,
    paddingHorizontal: 14,
    paddingVertical: 13,
    gap: 10,
  },
  inputIcon: {},
  input: {
    flex: 1,
    fontFamily: "Poppins_400Regular",
    fontSize: 14,
    color: Colors.light.text,
    padding: 0,
  },
  loginBtn: {
    backgroundColor: Colors.light.tint,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 8,
    shadowColor: Colors.light.tint,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  loginBtnText: {
    fontSize: 16,
    fontFamily: "Poppins_600SemiBold",
    color: "#fff",
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginVertical: 4,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: Colors.light.divider },
  dividerText: {
    fontSize: 12,
    fontFamily: "Poppins_400Regular",
    color: Colors.light.textTertiary,
  },
  signupRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
    alignItems: "center",
  },
  signupText: {
    fontSize: 14,
    fontFamily: "Poppins_400Regular",
    color: Colors.light.textSecondary,
  },
  signupLink: {
    fontSize: 14,
    fontFamily: "Poppins_600SemiBold",
    color: Colors.light.tint,
  },
});
