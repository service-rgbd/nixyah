import { Feather } from "@expo/vector-icons";
import LottieView from "lottie-react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
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

const checkEmailAnimation = require("../../assets/images/check-email-animation.json");

export default function ConfirmEmailScreen() {
  const params = useLocalSearchParams();
  const token = (params?.token as string) ?? null;
  const deepLinkStatus = (params?.status as string) ?? null;
  const deepLinkMessage = (params?.message as string) ?? null;
  const router = useRouter();

  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">(token ? "loading" : "idle");
  const [message, setMessage] = useState<string | null>(null);
  const [email, setEmail] = useState<string>((params?.email as string) ?? "");
  const [resendLoading, setResendLoading] = useState(false);

  const displayEmail = useMemo(() => email || ((params?.email as string) ?? "votre adresse email"), [email, params]);
  const notice = message ?? (status === "idle" ? "Ouvrez le mail recu puis revenez ici si vous avez besoin d'un nouveau lien." : null);

  const tone = useMemo(() => {
    if (status === "success") {
      return {
        badge: "Email confirme",
        title: "Adresse verifiee",
        subtitle: "Votre compte est pret.",
      };
    }
    if (status === "error") {
      return {
        badge: "Verification requise",
        title: "Confirmez votre email",
        subtitle: "Renvoyez un lien si besoin.",
      };
    }
    return {
      badge: "Verification email",
      title: "Consultez votre boite",
      subtitle: "Activez votre compte depuis le lien recu.",
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
    <AuthScaffold
      layout="flat"
      palette={{
        accent: Colors.light.tint,
        accentDark: Colors.light.tintDark,
        accentSoft: Colors.light.accent,
      }}
      eyebrow={tone.badge}
      title={tone.title}
      subtitle={tone.subtitle}
      heroOverlayOpacity={0.12}
      onBack={() => router.back()}
      heroVisualFullBleed
      heroVisual={
        <LottieView source={checkEmailAnimation} autoPlay loop={status !== "success"} style={styles.heroAnimation} />
      }
      footer={<AuthLinkRow prompt="Besoin de revenir ?" action="Connexion" onPress={() => router.replace("/auth/login")} />}
    >
      <AuthAlert message={status === "error" ? notice ?? undefined : undefined} />

      {status === "loading" ? (
        <AuthCard title="Verification en cours" subtitle="Nous validons votre lien de confirmation.">
          <View style={styles.statusInline}>
            <ActivityIndicator color={Colors.light.tint} />
            <Text style={styles.statusInlineText}>Verification du lien...</Text>
          </View>
        </AuthCard>
      ) : null}

      <AuthCard title="Adresse email" subtitle="Cette adresse est liee a votre activation.">
        <View style={styles.emailPill}>
          <Feather name="mail" size={15} color={Colors.light.tint} />
          <Text style={styles.emailPillText}>{displayEmail}</Text>
        </View>

        {notice && status !== "error" ? (
          <View style={styles.infoBox}>
            <Feather name={status === "success" ? "check-circle" : "info"} size={15} color={Colors.light.tintDark} />
            <Text style={styles.infoText}>{notice}</Text>
          </View>
        ) : null}
      </AuthCard>

      <AuthCard
        title={status === "success" ? "Compte active" : "Actions disponibles"}
        subtitle={
          status === "success"
            ? "Passez a la connexion."
            : "Renvoyez un email si necessaire."
        }
      >
        {status === "success" ? (
          <AuthButton label="Se connecter" onPress={() => router.replace("/auth/login")} icon="arrow-right" backgroundColor={Colors.light.tint} />
        ) : (
          <>
            <AuthInput
              label="Adresse email"
              icon="mail"
              value={email}
              onChangeText={setEmail}
              placeholder="Votre adresse email"
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <AuthButton
              label={resendLoading ? "Envoi..." : "Renvoyer l'email"}
              onPress={handleResend}
              loading={resendLoading}
              icon="send"
              backgroundColor={Colors.light.tint}
            />
            <Pressable style={styles.secondaryAction} onPress={() => router.replace("/auth/login")}>
              <Text style={styles.secondaryActionText}>Retour a la connexion</Text>
            </Pressable>
          </>
        )}
      </AuthCard>
    </AuthScaffold>
  );
}

const styles = StyleSheet.create({
  heroAnimation: {
    width: "100%",
    height: "100%",
  },
  statusInline: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  statusInlineText: {
    fontSize: 13,
    fontFamily: "Poppins_500Medium",
    color: Colors.light.text,
  },
  emailPill: {
    minHeight: 46,
    borderRadius: 16,
    backgroundColor: Colors.light.backgroundSecondary,
    borderWidth: 1,
    borderColor: Colors.light.cardBorder,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  emailPillText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Poppins_600SemiBold",
    color: Colors.light.text,
  },
  infoBox: {
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    backgroundColor: Colors.light.backgroundSecondary,
    borderWidth: 1,
    borderColor: Colors.light.cardBorder,
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: "Poppins_500Medium",
    color: Colors.light.textSecondary,
  },
  secondaryAction: {
    height: 50,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.light.cardBorder,
    backgroundColor: Colors.light.backgroundSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryActionText: {
    fontSize: 14,
    fontFamily: "Poppins_600SemiBold",
    color: Colors.light.text,
  },
});
