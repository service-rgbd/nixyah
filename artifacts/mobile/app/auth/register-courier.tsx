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

const VEHICLES = ["moto", "velo", "voiture"];
const courierHeroVideo = require("../../assets/images/0_Delivery_Food_Delivery_1920x1080.mp4");

export default function RegisterCourierScreen() {
  const { registerCourier } = useApp();
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [location, setLocation] = useState("Abidjan");
  const [zone, setZone] = useState("");
  const [vehicleType, setVehicleType] = useState("moto");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleContinue = () => {
    setError("");

    if (!name.trim()) {
      setError("Nom requis");
      return;
    }
    if (!email.trim()) {
      setError("Votre email est requis pour securiser votre compte");
      return;
    }
    setStep(2);
  };

  const handleSecurityContinue = () => {
    setError("");

    const passwordError = getPasswordPolicyError(password);
    if (passwordError) {
      setError(passwordError);
      return;
    }
    if (password !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas");
      return;
    }

    setStep(3);
  };

  const handleLocationContinue = () => {
    setError("");

    if (!location.trim()) {
      setError("La localisation est requise");
      return;
    }

    setStep(4);
  };

  const handleSubmit = async () => {
    setError("");

    setLoading(true);
    try {
      const result = await registerCourier({
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        referralCode: referralCode.trim() || undefined,
        password,
        location: location.trim(),
        zone: zone.trim() || undefined,
        vehicleType,
      });

      if (result.requiresEmailConfirmation && result.email) {
        router.replace({ pathname: "/auth/confirm", params: { email: result.email } });
      } else {
        router.replace("/courier/verification");
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
        accent: "#0F766E",
        accentDark: "#115E59",
        accentSoft: Colors.light.backgroundTertiary,
      }}
      eyebrow="Livreur"
      title={step === 1 ? "Profil livreur" : step === 2 ? "Mot de passe" : step === 3 ? "Votre zone" : "Véhicule"}
      subtitle={step === 1 ? "Vos coordonnées." : step === 2 ? "Accès sécurisé." : step === 3 ? "Ville et secteur." : "Mode de livraison."}
      progress={{ current: step, total: 4 }}
      onBack={() => (step > 1 ? setStep((current) => current - 1) : router.back())}
      heroVideoSource={courierHeroVideo}
      heroOverlayOpacity={0}
      footer={<AuthLinkRow prompt="Déjà un compte ?" action="Se connecter" onPress={() => router.push("/auth/login")} color="#0F766E" />}
    >
      <AuthAlert message={error} />

      {step === 1 ? (
        <AuthCard>
          <AuthInput label="Nom complet" icon="user" value={name} onChangeText={setName} placeholder="Nom et prénom" autoCapitalize="words" />
          <AuthInput
            label="Email"
            icon="mail"
            value={email}
            onChangeText={setEmail}
            placeholder="email@exemple.com"
            keyboardType="email-address"
            autoCapitalize="none"
            hint="Email obligatoire pour la connexion securisee et la reinitialisation."
          />
          <AuthInput
            label="Téléphone"
            icon="phone"
            value={phone}
            onChangeText={setPhone}
            placeholder="+225 ..."
            keyboardType="phone-pad"
            hint="Optionnel. Il reste utile pour vos contacts de livraison."
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

          <AuthButton label="Continuer" onPress={handleContinue} icon="arrow-right" backgroundColor="#0F766E" />
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

          <AuthButton label="Continuer" onPress={handleSecurityContinue} icon="arrow-right" backgroundColor="#0F766E" />
        </AuthCard>
      ) : null}

      {step === 3 ? (
        <AuthCard>
          <AuthInput label="Localisation" icon="map-pin" value={location} onChangeText={setLocation} placeholder="Abidjan" />
          <AuthInput label="Zone" icon="navigation" value={zone} onChangeText={setZone} placeholder="Cocody, Yopougon..." />

          <AuthButton label="Continuer" onPress={handleLocationContinue} icon="arrow-right" backgroundColor="#0F766E" />
        </AuthCard>
      ) : null}

      {step === 4 ? (
        <AuthCard>
          <AuthChipGroup
            options={VEHICLES.map((item) => ({
              key: item,
              label: item.toUpperCase(),
              icon: item === "moto" ? "truck" : item === "velo" ? "navigation" : "briefcase",
            }))}
            value={vehicleType}
            onChange={(value) => setVehicleType(String(value))}
            accentColor="#0F766E"
          />

          <AuthButton label="Créer mon compte livreur" onPress={handleSubmit} loading={loading} icon="check" backgroundColor="#0F766E" />
        </AuthCard>
      ) : null}
    </AuthScaffold>
  );
}
