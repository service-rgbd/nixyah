import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
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

const SPECIALTIES = [
  "Cuisine Ivoirienne",
  "Cuisine Sénégalaise",
  "Traiteur & Événements",
  "Grillades",
  "Snacks & Street Food",
  "Pâtisserie & Desserts",
  "Cuisine Dioula",
  "Cuisine Malienne",
  "Cuisine du Nord CI",
  "Autres",
];

const ZONES_ABIDJAN = [
  "Cocody",
  "Yopougon",
  "Plateau",
  "Marcory",
  "Abobo",
  "Adjamé",
  "Treichville",
  "Koumassi",
  "Riviera",
  "Angré",
  "Deux Plateaux",
  "Attécoubé",
];

const AVATAR_COLORS = ["#C4522A", "#8B5CF6", "#059669", "#D97706", "#DC2626", "#BE185D", "#1D4ED8", "#0891B2", "#7C3AED", "#065F46"];
const PRICE_RANGES = ["500 – 2 000 FCFA", "1 000 – 5 000 FCFA", "2 000 – 8 000 FCFA", "3 000 – 12 000 FCFA", "5 000 – 20 000 FCFA", "Sur devis"];
const chefHeroVideo = require("../../assets/images/0_Cooking_Baking_720x720.mp4");
const STEPS = [
  {
    title: "Profil chef",
    subtitle: "Vos coordonnées.",
  },
  {
    title: "Mot de passe",
    subtitle: "Accès sécurisé.",
  },
  {
    title: "Couleur",
    subtitle: "Signature visuelle.",
  },
  {
    title: "Vos zones",
    subtitle: "Quartiers desservis.",
  },
  {
    title: "Spécialité",
    subtitle: "Votre cuisine.",
  },
  {
    title: "Tarifs",
    subtitle: "Votre gamme.",
  },
  {
    title: "Votre bio",
    subtitle: "Présentez-vous.",
  },
];

export default function RegisterChefScreen() {
  const { registerChef } = useApp();
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [coverColor, setCoverColor] = useState(AVATAR_COLORS[0]);
  const [selectedZones, setSelectedZones] = useState<string[]>([]);
  const [specialty, setSpecialty] = useState("");
  const [priceRange, setPriceRange] = useState("");
  const [bio, setBio] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleNext = () => {
    setError("");

    if (step === 1) {
      if (!name.trim()) {
        setError("Votre nom est requis");
        return;
      }
      if (!email.trim()) {
        setError("Votre email est requis pour securiser votre compte");
        return;
      }
    }

    if (step === 2) {
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

    if (step === 4) {
      if (selectedZones.length === 0) {
        setError("Sélectionnez au moins un quartier");
        return;
      }
    }

    if (step === 5) {
      if (!specialty) {
        setError("Sélectionnez votre spécialité");
        return;
      }
    }

    if (step === 6) {
      if (!priceRange) {
        setError("Choisissez votre fourchette de prix");
        return;
      }
    }

    setStep((current) => Math.min(STEPS.length, current + 1));
  };

  const handleSubmit = async () => {
    if (bio.trim().length < 20) {
      setError("Décrivez-vous en au moins 20 caractères");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const result = await registerChef({
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        referralCode: referralCode.trim() || undefined,
        password,
        specialty,
        location: `${selectedZones[0]}, Abidjan`,
        zone: selectedZones.join(", "),
        bio: bio.trim(),
        priceRange,
        coverColor,
        specialties: [specialty],
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
        accent: coverColor,
        accentDark: coverColor,
        accentSoft: Colors.light.accent,
      }}
      eyebrow="Chef"
      title={STEPS[step - 1].title}
      subtitle={STEPS[step - 1].subtitle}
      progress={{ current: step, total: STEPS.length }}
      onBack={() => (step > 1 ? setStep((current) => current - 1) : router.back())}
      heroVideoSource={chefHeroVideo}
      heroOverlayOpacity={0}
      footer={<AuthLinkRow prompt="Déjà un compte ?" action="Se connecter" onPress={() => router.push("/auth/login")} color={coverColor} />}
    >
      <AuthAlert message={error} />

      {step === 1 ? (
        <AuthCard>
          <AuthInput label="Nom complet" icon="user" value={name} onChangeText={setName} placeholder="Prénom et nom" autoCapitalize="words" />
          <AuthInput
            label="Email"
            icon="mail"
            value={email}
            onChangeText={setEmail}
            placeholder="email@exemple.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            hint="Email obligatoire pour activer, proteger et reinitialiser votre compte."
          />
          <AuthInput
            label="Téléphone"
            icon="phone"
            value={phone}
            onChangeText={setPhone}
            placeholder="+225 07 00 00 00 00"
            keyboardType="phone-pad"
            hint="Optionnel. Il complete votre profil mais ne remplace plus l'email."
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

          <AuthButton label="Continuer" onPress={handleNext} icon="arrow-right" backgroundColor={coverColor} />
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

          <AuthButton label="Continuer" onPress={handleNext} icon="arrow-right" backgroundColor={coverColor} />
        </AuthCard>
      ) : null}

      {step === 3 ? (
        <AuthCard>
          <View style={styles.colorSection}>
            <Text style={styles.colorTitle}>Couleur de couverture</Text>
            <View style={styles.colorsGrid}>
              {AVATAR_COLORS.map((color) => {
                const selected = color === coverColor;
                return (
                  <Pressable key={color} style={[styles.colorSwatch, { backgroundColor: color }, selected ? styles.colorSwatchSelected : null]} onPress={() => setCoverColor(color)}>
                    {selected ? <Feather name="check" size={16} color="#fff" /> : null}
                  </Pressable>
                );
              })}
            </View>
          </View>

          <AuthButton label="Continuer" onPress={handleNext} icon="arrow-right" backgroundColor={coverColor} />
        </AuthCard>
      ) : null}

      {step === 4 ? (
        <AuthCard>
          <AuthChipGroup
            options={ZONES_ABIDJAN.map((zone) => ({ key: zone, label: zone, icon: "map-pin" as const }))}
            value={selectedZones}
            onChange={(value) => setSelectedZones(Array.isArray(value) ? value : [String(value)])}
            multi
            accentColor={coverColor}
          />

          <AuthButton label="Continuer" onPress={handleNext} icon="arrow-right" backgroundColor={coverColor} />
        </AuthCard>
      ) : null}

      {step === 5 ? (
        <AuthCard>
          <AuthChipGroup
            options={SPECIALTIES.map((item) => ({ key: item, label: item, icon: "coffee" as const }))}
            value={specialty}
            onChange={(value) => setSpecialty(String(value))}
            accentColor={coverColor}
          />

          <AuthButton label="Continuer" onPress={handleNext} icon="arrow-right" backgroundColor={coverColor} />
        </AuthCard>
      ) : null}

      {step === 6 ? (
        <AuthCard>
          <AuthChipGroup
            options={PRICE_RANGES.map((item) => ({ key: item, label: item, icon: "tag" as const }))}
            value={priceRange}
            onChange={(value) => setPriceRange(String(value))}
            accentColor={coverColor}
          />

          <AuthButton label="Continuer" onPress={handleNext} icon="arrow-right" backgroundColor={coverColor} />
        </AuthCard>
      ) : null}

      {step === 7 ? (
        <AuthCard>
          <AuthInput
            label="Parlez de vous"
            icon="edit-3"
            value={bio}
            onChangeText={setBio}
            placeholder="Racontez votre parcours, votre style de cuisine, vos forces et ce qui vous distingue."
            multiline
            hint={`${bio.length} caractères saisis`}
          />

          <AuthButton label="Créer mon profil cuisinière" onPress={handleSubmit} loading={loading} icon="check" backgroundColor={coverColor} />
        </AuthCard>
      ) : null}
    </AuthScaffold>
  );
}

const styles = StyleSheet.create({
  colorSection: {
    gap: 12,
  },
  colorTitle: {
    fontSize: 13,
    fontFamily: "Poppins_600SemiBold",
    color: Colors.light.text,
  },
  colorsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  colorSwatch: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  colorSwatchSelected: {
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.85)",
  },
});