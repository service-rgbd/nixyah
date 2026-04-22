import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useState } from "react";
import { Pressable } from "react-native";
import {
  AuthAlert,
  AuthButton,
  AuthCard,
  AuthChipGroup,
  AuthInput,
  AuthLinkRow,
  AuthScaffold,
} from "@/components/auth/AuthUI";
import Colors from "@/constants/colors";
import { getPasswordPolicyError, PASSWORD_POLICY_HINT } from "@/constants/password-policy";
import { useApp } from "@/contexts/AppContext";

const authUsersImage = require("../../assets/images/login-register-users.png");

const ZONES = ["Cocody", "Yopougon", "Plateau", "Marcory", "Abobo", "Adjamé", "Treichville", "Koumassi", "Riviera", "Angré"];
const PREFS = ["Ivoirien", "Sénégalais", "Grillades", "Snacks", "Desserts", "Traiteur", "Street food", "Végétarien"];

export default function RegisterClientScreen() {
  const { registerClient } = useApp();
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [location] = useState("Abidjan");
  const [selectedZone, setSelectedZone] = useState("");
  const [preferences, setPreferences] = useState<string[]>([]);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleContinue = () => {
    setError("");

    if (step === 1) {
      if (!name.trim()) {
        setError("Votre prénom est requis");
        return;
      }
      if (!email.trim()) {
        setError("Votre email est requis pour securiser votre compte");
        return;
      }
    }

    if (step === 2) {
      if (!password.trim()) {
        setError("Mot de passe requis");
        return;
      }
      const passwordError = getPasswordPolicyError(password);
      if (passwordError) {
        setError(passwordError);
        return;
      }
      if (password !== confirmPassword) {
        setError("Les mots de passe ne correspondent pas");
        return;
      }
    }

    setStep((current) => Math.min(4, current + 1));
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError("");

    try {
      const result = await registerClient({
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        referralCode: referralCode.trim() || undefined,
        password,
        location: selectedZone ? `${selectedZone}, ${location}` : location,
        preferences,
      });

      if (result.requiresEmailConfirmation && result.email) {
        router.replace({ pathname: "/auth/confirm", params: { email: result.email } });
      } else {
        router.replace("/(tabs)");
      }
    } catch (e: any) {
      setError(e.message ?? "Erreur lors de l'inscription");
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
      eyebrow="Client"
      title={step === 1 ? "Vos coordonnées" : step === 2 ? "Mot de passe" : step === 3 ? "Votre zone" : "Vos goûts"}
      subtitle={step === 1 ? "Profil client." : step === 2 ? "Accès sécurisé." : step === 3 ? "Quartier de départ." : "Préférences culinaires."}
      progress={{ current: step, total: 4 }}
      onBack={() => (step > 1 ? setStep((current) => current - 1) : router.back())}
      heroImageSource={authUsersImage}
      heroOverlayOpacity={0}
      footer={<AuthLinkRow prompt="Déjà un compte ?" action="Se connecter" onPress={() => router.push("/auth/login")} />}
    >
      <AuthAlert message={error} />

      {step === 1 ? (
        <AuthCard>
          <AuthInput
            label="Votre prénom"
            icon="user"
            value={name}
            onChangeText={setName}
            placeholder="Ex: Kouamé"
            autoCapitalize="words"
          />
          <AuthInput
            label="Email"
            icon="mail"
            value={email}
            onChangeText={setEmail}
            placeholder="email@exemple.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            hint="Email obligatoire pour la connexion securisee et la reinitialisation."
          />
          <AuthInput
            label="Téléphone"
            icon="phone"
            value={phone}
            onChangeText={setPhone}
            placeholder="+225 07 00 00 00 00"
            keyboardType="phone-pad"
            hint="Optionnel. Ajoutez-le si vous voulez aussi etre joignable par telephone."
          />
          <AuthInput
            label="Code de parrainage"
            icon="gift"
            value={referralCode}
            onChangeText={setReferralCode}
            placeholder="Ex: NIXYAH1234"
            autoCapitalize="characters"
            autoCorrect={false}
          />

          <AuthButton label="Continuer" onPress={handleContinue} icon="arrow-right" backgroundColor={Colors.light.tint} />
        </AuthCard>
      ) : null}

      {step === 2 ? (
        <AuthCard>
          <AuthInput
            label="Mot de passe"
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
            placeholder="Répétez votre mot de passe"
            secureTextEntry={!showPassword}
          />

          <AuthButton label="Continuer" onPress={handleContinue} icon="arrow-right" backgroundColor={Colors.light.tint} />
        </AuthCard>
      ) : null}

      {step === 3 ? (
        <AuthCard>
          <AuthChipGroup
            options={ZONES.map((zone) => ({ key: zone, label: zone, icon: "map-pin" as const }))}
            value={selectedZone}
            onChange={(value) => setSelectedZone(String(value))}
            accentColor={Colors.light.tint}
          />
          <AuthInput
            label="Ville"
            icon="navigation"
            value={location}
            editable={false}
            placeholder="Abidjan"
            hint="La ville reste définie sur Abidjan comme dans le flux actuel."
          />

          <AuthButton label="Continuer" onPress={handleContinue} icon="arrow-right" backgroundColor={Colors.light.tint} />
        </AuthCard>
      ) : null}

      {step === 4 ? (
        <AuthCard>
          <AuthChipGroup
            options={PREFS.map((preference) => ({ key: preference, label: preference, icon: "heart" as const }))}
            value={preferences}
            onChange={(value) => setPreferences(Array.isArray(value) ? value : [String(value)])}
            multi
            accentColor={Colors.light.tint}
          />

          <AuthButton
            label="Créer mon compte"
            onPress={handleSubmit}
            loading={loading}
            icon="check"
            backgroundColor={Colors.light.tint}
          />
        </AuthCard>
      ) : null}
    </AuthScaffold>
  );
}
