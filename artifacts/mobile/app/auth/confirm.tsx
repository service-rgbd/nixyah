import { Feather } from "@expo/vector-icons";
import Gradient from "@/components/SafeGradient";
import { apiFetch } from "@/constants/api";
import Colors from "@/constants/colors";
import LottieView from "lottie-react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const checkEmailAnimation = require("../../assets/images/check-email-animation.json");

export default function ConfirmEmailScreen() {
  const params = useLocalSearchParams();
  const token = (params?.token as string) ?? null;
  const deepLinkStatus = (params?.status as string) ?? null;
  const deepLinkMessage = (params?.message as string) ?? null;
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">(
    token ? "loading" : "idle",
  );
  const [message, setMessage] = useState<string | null>(null);
  const [email, setEmail] = useState<string>((params?.email as string) ?? "");
  const [resendLoading, setResendLoading] = useState(false);

  const displayEmail = useMemo(
    () => email || ((params?.email as string) ?? "votre adresse email"),
    [email, params],
  );

  const tone = useMemo(() => {
    if (status === "success") {
      return {
        badge: "Email confirme",
        title: "Adresse email verifiee",
        subtitle: "Votre compte est pret. Vous pouvez maintenant vous connecter sur Nixyah.",
      };
    }
    if (status === "error") {
      return {
        badge: "Verification requise",
        title: "Confirmez votre adresse email",
        subtitle: "Renvoyez un lien si vous ne trouvez pas encore le message dans votre boite mail.",
      };
    }
    return {
      badge: "Verification email",
      title: "Consultez votre boite de reception",
      subtitle: "Un email vient d'etre envoye. Ouvrez-le puis confirmez votre adresse pour activer votre compte.",
    };
  }, [status]);

  useEffect(() => {
    if (!token) return;

    (async () => {
      setStatus("loading");
      try {
        await apiFetch(`/auth/confirm?token=${encodeURIComponent(token)}`);
        setStatus("success");
        setMessage("Votre adresse email a ete confirmee avec succes.");
      } catch (err: any) {
        setStatus("error");
        setMessage(err?.message ?? "La confirmation du lien a echoue.");
      }
    })();
  }, [token]);

  useEffect(() => {
    if (token || !deepLinkStatus) return;
    if (deepLinkStatus === "success") {
      setStatus("success");
      setMessage(deepLinkMessage ?? "Votre adresse email a ete confirmee avec succes.");
      return;
    }
    if (deepLinkStatus === "error") {
      setStatus("error");
      setMessage(deepLinkMessage ?? "La confirmation du lien a echoue.");
    }
  }, [deepLinkMessage, deepLinkStatus, token]);

  useEffect(() => {
    if (token || !email.trim() || status === "success") return;

    let cancelled = false;

    const pollConfirmationStatus = async () => {
      try {
        const result = await apiFetch<{ confirmed: boolean }>(
          `/auth/confirmation-status?email=${encodeURIComponent(email.trim())}`,
        );

        if (!cancelled && result.confirmed) {
          setStatus("success");
          setMessage("Votre adresse email a ete confirmee avec succes.");
        }
      } catch {
        // Keep polling quietly while the user is on this screen.
      }
    };

    pollConfirmationStatus();
    const intervalId = setInterval(pollConfirmationStatus, 4000);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [email, status, token]);

  async function handleResend() {
    if (!email.trim()) {
      setMessage("Saisissez votre adresse email pour recevoir un nouveau message.");
      return;
    }

    setResendLoading(true);
    setMessage(null);
    try {
      await apiFetch("/auth/resend-confirmation", {
        method: "POST",
        body: JSON.stringify({ email: email.trim() }),
      });
      setStatus("idle");
      setMessage("Un nouveau mail de confirmation vient d'etre envoye.");
    } catch (e: any) {
      setStatus("error");
      setMessage(e?.message ?? "Impossible de renvoyer le mail pour le moment.");
    } finally {
      setResendLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Gradient
        colors={[Colors.light.tintDark, Colors.light.tint, Colors.light.terracotta]}
        style={[styles.screen, { paddingTop: insets.top + 10, paddingBottom: Math.max(insets.bottom, 18) }]}
      >
        <View style={styles.topRow}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Feather name="arrow-left" size={18} color="#fff" />
          </Pressable>
        </View>

        <View style={styles.content}>
          <View style={styles.animationWrap}>
            <LottieView
              source={checkEmailAnimation}
              autoPlay
              loop={status !== "success"}
              style={styles.animation}
            />
          </View>

          <View style={styles.textWrap}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{tone.badge}</Text>
            </View>
            <Text style={styles.title}>{tone.title}</Text>
            <Text style={styles.subtitle}>{tone.subtitle}</Text>
            <Text style={styles.emailText}>{displayEmail}</Text>
          </View>

          <View style={styles.actionsWrap}>
            {status === "loading" ? (
              <View style={styles.statusRow}>
                <ActivityIndicator color="#fff" />
                <Text style={styles.statusText}>Verification du lien en cours...</Text>
              </View>
            ) : null}

            {message ? <Text style={styles.message}>{message}</Text> : null}

            {!token && status !== "success" ? (
              <Text style={styles.helperText}>
                Cette page detecte automatiquement la confirmation de votre email.
              </Text>
            ) : null}

            {status === "success" ? (
              <Pressable style={styles.primaryButton} onPress={() => router.replace("/auth/login")}>
                <Text style={styles.primaryButtonText}>Se connecter</Text>
              </Pressable>
            ) : (
              <>
                <TextInput
                  style={styles.input}
                  placeholder="Votre adresse email"
                  placeholderTextColor="rgba(255,255,255,0.72)"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
                <Pressable
                  style={[styles.primaryButton, resendLoading && styles.buttonDisabled]}
                  onPress={handleResend}
                  disabled={resendLoading}
                >
                  <Text style={styles.primaryButtonText}>
                    {resendLoading ? "Envoi..." : "Renvoyer l'email"}
                  </Text>
                </Pressable>
                <Pressable style={styles.secondaryButton} onPress={() => router.replace("/auth/login")}>
                  <Text style={styles.secondaryButtonText}>Retour a la connexion</Text>
                </Pressable>
              </>
            )}
          </View>
        </View>
      </Gradient>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  topRow: {
    paddingHorizontal: 18,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.18)",
    alignSelf: "flex-start",
  },
  content: {
    flex: 1,
    paddingHorizontal: 22,
    justifyContent: "space-between",
  },
  animationWrap: {
    alignItems: "center",
    justifyContent: "center",
    flex: 0.95,
  },
  animation: {
    width: 240,
    height: 240,
  },
  textWrap: {
    alignItems: "center",
    marginTop: -10,
  },
  badge: {
    backgroundColor: "rgba(255,255,255,0.18)",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 12,
  },
  badgeText: {
    fontSize: 12,
    fontFamily: "Poppins_600SemiBold",
    color: "#fff",
  },
  title: {
    fontSize: 28,
    lineHeight: 34,
    textAlign: "center",
    fontFamily: "Poppins_700Bold",
    color: "#fff",
  },
  subtitle: {
    marginTop: 10,
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
    fontFamily: "Poppins_400Regular",
    color: "rgba(255,255,255,0.9)",
  },
  emailText: {
    marginTop: 10,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    fontFamily: "Poppins_600SemiBold",
    color: "#fff",
  },
  actionsWrap: {
    paddingBottom: 8,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginBottom: 10,
  },
  statusText: {
    fontSize: 14,
    fontFamily: "Poppins_500Medium",
    color: "#fff",
  },
  message: {
    textAlign: "center",
    fontSize: 13,
    lineHeight: 20,
    fontFamily: "Poppins_500Medium",
    color: "#fff",
    marginBottom: 12,
  },
  helperText: {
    textAlign: "center",
    fontSize: 12,
    lineHeight: 18,
    fontFamily: "Poppins_400Regular",
    color: "rgba(255,255,255,0.82)",
    marginBottom: 12,
  },
  input: {
    height: 54,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.28)",
    backgroundColor: "rgba(255,255,255,0.14)",
    paddingHorizontal: 16,
    fontSize: 15,
    fontFamily: "Poppins_400Regular",
    color: "#fff",
    marginBottom: 12,
  },
  primaryButton: {
    height: 54,
    borderRadius: 18,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: {
    fontSize: 15,
    fontFamily: "Poppins_600SemiBold",
    color: Colors.light.tintDark,
  },
  secondaryButton: {
    marginTop: 12,
    height: 52,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.34)",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  secondaryButtonText: {
    fontSize: 14,
    fontFamily: "Poppins_600SemiBold",
    color: "#fff",
  },
  buttonDisabled: {
    opacity: 0.7,
  },
});
