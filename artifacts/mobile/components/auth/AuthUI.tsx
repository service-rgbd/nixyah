import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { VideoView, useVideoPlayer } from "expo-video";
import React, { useEffect } from "react";
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import Colors from "@/constants/colors";

type FeatherName = React.ComponentProps<typeof Feather>["name"];

type Palette = {
  accent: string;
  accentDark: string;
  accentSoft: string;
};

type HeroStat = {
  label: string;
  value: string;
};

type AuthScaffoldProps = {
  palette: Palette;
  title: string;
  subtitle?: string;
  eyebrow?: string;
  layout?: "hero" | "flat";
  progress?: { current: number; total: number };
  onBack?: () => void;
  heroImageSource?: number;
  heroVideoSource?: number | string | null;
  heroOverlayOpacity?: number;
  heroVisual?: React.ReactNode;
  heroVisualFullBleed?: boolean;
  heroStats?: HeroStat[];
  children: React.ReactNode;
  footer?: React.ReactNode;
};

type AuthInputProps = TextInputProps & {
  label: string;
  icon: FeatherName;
  hint?: string;
  trailing?: React.ReactNode;
};

type AuthButtonProps = {
  label: string;
  onPress: () => void;
  loading?: boolean;
  icon?: FeatherName;
  backgroundColor: string;
  disabled?: boolean;
};

type AuthChipOption = {
  key: string;
  label: string;
  icon?: FeatherName;
};

type AuthChipGroupProps = {
  options: AuthChipOption[];
  value: string | string[];
  onChange: (value: string | string[]) => void;
  multi?: boolean;
  accentColor: string;
};

function alpha(hex: string, opacity: number) {
  const safeHex = hex.replace("#", "");
  if (safeHex.length !== 6) {
    return hex;
  }

  const value = Math.max(0, Math.min(255, Math.round(opacity * 255)));
  return `#${safeHex}${value.toString(16).padStart(2, "0")}`;
}

function getPlayerPlayingState(player: ReturnType<typeof useVideoPlayer>) {
  try {
    return player.playing;
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes("NativeSharedObjectNotFoundException")) {
      console.warn("Failed to read auth hero player state", error);
    }
    return false;
  }
}

function pauseHeroPlayerSafely(player: ReturnType<typeof useVideoPlayer>) {
  try {
    if (getPlayerPlayingState(player)) {
      player.pause();
    }
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes("NativeSharedObjectNotFoundException")) {
      console.warn("Failed to pause auth hero player", error);
    }
  }
}

function playHeroPlayerSafely(player: ReturnType<typeof useVideoPlayer>) {
  try {
    player.play();
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes("NativeSharedObjectNotFoundException")) {
      console.warn("Failed to play auth hero player", error);
    }
  }
}

export function AuthScaffold({
  palette,
  title,
  subtitle,
  eyebrow,
  layout = "hero",
  progress,
  onBack,
  heroImageSource,
  heroVideoSource,
  heroOverlayOpacity,
  heroVisual,
  heroVisualFullBleed,
  heroStats,
  children,
  footer,
}: AuthScaffoldProps) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const heroHeight = Math.max(270, Math.min(356, height * 0.37));
  const isFlatLayout = layout === "flat";
  const heroPlayer = useVideoPlayer(heroVideoSource ?? null, (player) => {
    player.loop = true;
    player.muted = true;
    playHeroPlayerSafely(player);
  });

  useEffect(() => {
    if (!heroVideoSource) {
      pauseHeroPlayerSafely(heroPlayer);
      return;
    }

    playHeroPlayerSafely(heroPlayer);
  }, [heroPlayer, heroVideoSource]);

  useEffect(() => {
    return () => {
      pauseHeroPlayerSafely(heroPlayer);
    };
  }, [heroPlayer]);

  return (
    <View style={styles.screen}>
      {isFlatLayout ? null : (
        <View style={[styles.hero, { height: heroHeight, paddingTop: insets.top + 14, backgroundColor: palette.accentDark }]}>
          {heroVideoSource ? (
            <VideoView player={heroPlayer} style={styles.heroBackgroundVideo} contentFit="cover" nativeControls={false} />
          ) : null}
          {!heroVideoSource && heroImageSource ? <Image source={heroImageSource} style={styles.heroBackgroundImage} resizeMode="cover" /> : null}
          <View
            style={[
              styles.heroOverlay,
              {
                backgroundColor: alpha(
                  palette.accentDark,
                  heroOverlayOpacity ?? (heroVideoSource || heroImageSource ? 0.14 : 0.92),
                ),
              },
            ]}
          />
          {!heroVideoSource && !heroImageSource ? <View style={[styles.heroGlowLarge, { backgroundColor: alpha(palette.accentSoft, 0.24) }]} /> : null}
          {!heroVideoSource && !heroImageSource ? <View style={[styles.heroGlowSmall, { backgroundColor: alpha("#FFFFFF", 0.11) }]} /> : null}

          <View style={styles.heroTopRow}>
            <Pressable style={styles.backButton} onPress={onBack ?? (() => router.back())}>
              <Feather name="arrow-left" size={18} color="#fff" />
            </Pressable>
            {progress ? <AuthProgress current={progress.current} total={progress.total} /> : <View style={styles.backSpacer} />}
          </View>

          {!heroVisualFullBleed ? (
            <View style={styles.heroTextBlock}>
              {eyebrow ? (
                <View style={styles.eyebrowPill}>
                  <Text style={styles.eyebrowText}>{eyebrow}</Text>
                </View>
              ) : null}
              <Text style={styles.heroTitle}>{title}</Text>
              {subtitle ? <Text style={styles.heroSubtitle}>{subtitle}</Text> : null}
            </View>
          ) : null}

          {heroVisual ? (
            <View style={heroVisualFullBleed ? styles.heroVisualFullBleedWrap : styles.heroVisualWrap}>{heroVisual}</View>
          ) : null}

          {heroVisualFullBleed ? (
            <View style={styles.heroTextOverlay}>
              {eyebrow ? (
                <View style={styles.eyebrowPill}>
                  <Text style={styles.eyebrowText}>{eyebrow}</Text>
                </View>
              ) : null}
              <Text style={styles.heroTitle}>{title}</Text>
              {subtitle ? <Text style={styles.heroSubtitle}>{subtitle}</Text> : null}
            </View>
          ) : null}

          {heroStats && heroStats.length > 0 ? (
            <View style={styles.heroStatsRow}>
              {heroStats.map((stat) => (
                <View key={`${stat.label}-${stat.value}`} style={styles.heroStatCard}>
                  <Text style={styles.heroStatValue}>{stat.value}</Text>
                  <Text style={styles.heroStatLabel}>{stat.label}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      )}

      <View style={[styles.sheetWrap, isFlatLayout ? styles.sheetWrapFlat : null, { paddingTop: isFlatLayout ? insets.top + 14 : 12 }]}>
        <KeyboardAwareScrollViewCompat
          style={styles.sheetScroll}
          contentContainerStyle={styles.sheetScrollContent}
          bottomOffset={Platform.OS === "ios" ? 28 : 0}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {isFlatLayout ? (
            <View style={styles.flatHeader}>
              <View style={styles.flatTopRow}>
                <Pressable style={styles.flatBackButton} onPress={onBack ?? (() => router.back())}>
                  <Feather name="arrow-left" size={18} color={Colors.light.text} />
                </Pressable>
                {progress ? <AuthProgress current={progress.current} total={progress.total} /> : <View style={styles.backSpacer} />}
              </View>
              <View style={styles.flatHeaderBody}>
                {eyebrow ? (
                  <View style={[styles.flatEyebrowPill, { backgroundColor: alpha(palette.accent, 0.1) }]}>
                    <Text style={[styles.flatEyebrowText, { color: palette.accentDark }]}>{eyebrow}</Text>
                  </View>
                ) : null}
                <Text style={styles.flatTitle}>{title}</Text>
                {subtitle ? <Text style={styles.flatSubtitle}>{subtitle}</Text> : null}
                {heroVisual ? <View style={styles.flatVisualWrap}>{heroVisual}</View> : null}
              </View>
            </View>
          ) : null}
          <View style={styles.sheetBody}>{children}</View>
          {footer ? <View style={styles.sheetFooter}>{footer}</View> : null}
        </KeyboardAwareScrollViewCompat>
      </View>
    </View>
  );
}

export function AuthCard({ title, subtitle, children }: { title?: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <View style={styles.card}>
      {title ? <Text style={styles.cardTitle}>{title}</Text> : null}
      {subtitle ? <Text style={styles.cardSubtitle}>{subtitle}</Text> : null}
      <View style={styles.cardContent}>{children}</View>
    </View>
  );
}

export function AuthAlert({ message }: { message?: string }) {
  if (!message) {
    return null;
  }

  return (
    <View style={styles.alertBox}>
      <Feather name="alert-circle" size={15} color={Colors.light.error} />
      <Text style={styles.alertText}>{message}</Text>
    </View>
  );
}

export function AuthInput({ label, icon, hint, trailing, style, multiline, ...props }: AuthInputProps) {
  return (
    <View style={styles.fieldBlock}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={[styles.inputShell, multiline ? styles.inputShellMultiline : null]}>
        <View style={styles.inputIconWrap}>
          <Feather name={icon} size={16} color={Colors.light.textSecondary} />
        </View>
        <TextInput
          {...props}
          multiline={multiline}
          placeholderTextColor={Colors.light.textTertiary}
          style={[styles.input, multiline ? styles.inputMultiline : null, style]}
        />
        {trailing ? <View style={styles.inputTrailing}>{trailing}</View> : null}
      </View>
      {hint ? <Text style={styles.fieldHint}>{hint}</Text> : null}
    </View>
  );
}

export function AuthButton({ label, onPress, loading, icon, backgroundColor, disabled }: AuthButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      style={[styles.primaryButton, { backgroundColor }, isDisabled ? styles.primaryButtonDisabled : null]}
      onPress={onPress}
      disabled={isDisabled}
    >
      {loading ? (
        <ActivityIndicator color="#fff" size="small" />
      ) : (
        <>
          <Text style={styles.primaryButtonText}>{label}</Text>
          {icon ? <Feather name={icon} size={17} color="#fff" /> : null}
        </>
      )}
    </Pressable>
  );
}

export function AuthChipGroup({ options, value, onChange, multi, accentColor }: AuthChipGroupProps) {
  const selectedValues = Array.isArray(value) ? value : [value];

  return (
    <View style={styles.chipGroup}>
      {options.map((option) => {
        const selected = selectedValues.includes(option.key);

        return (
          <Pressable
            key={option.key}
            style={[styles.chip, selected ? { backgroundColor: accentColor, borderColor: accentColor } : null]}
            onPress={() => {
              if (multi) {
                const next = selected ? selectedValues.filter((item) => item !== option.key) : [...selectedValues, option.key];
                onChange(next);
                return;
              }
              onChange(option.key);
            }}
          >
            {option.icon ? <Feather name={option.icon} size={12} color={selected ? "#fff" : Colors.light.textSecondary} /> : null}
            <Text style={[styles.chipText, selected ? styles.chipTextSelected : null]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function AuthLinkRow({
  prompt,
  action,
  onPress,
  color,
}: {
  prompt: string;
  action: string;
  onPress: () => void;
  color?: string;
}) {
  return (
    <View style={styles.linkRow}>
      <Text style={styles.linkPrompt}>{prompt}</Text>
      <Pressable onPress={onPress}>
        <Text style={[styles.linkAction, color ? { color } : null]}>{action}</Text>
      </Pressable>
    </View>
  );
}

export function AuthRoleCard({
  title,
  description,
  icon,
  accentColor,
  onPress,
}: {
  title: string;
  description: string;
  icon: FeatherName;
  accentColor: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.roleCard} onPress={onPress}>
      <View style={[styles.roleIconWrap, { backgroundColor: alpha(accentColor, 0.12) }]}>
        <Feather name={icon} size={17} color={accentColor} />
      </View>
      <View style={styles.roleContent}>
        <Text style={styles.roleTitle}>{title}</Text>
        <Text style={styles.roleDescription}>{description}</Text>
      </View>
      <Feather name="chevron-right" size={18} color={Colors.light.textTertiary} />
    </Pressable>
  );
}

export function AuthAvatarPreview({ initials, color, subtitle }: { initials: string; color: string; subtitle?: string }) {
  return (
    <View style={styles.avatarPreviewWrap}>
      <View style={[styles.avatarPreview, { backgroundColor: color }]}>
        <Text style={styles.avatarPreviewText}>{initials}</Text>
      </View>
      {subtitle ? <Text style={styles.avatarPreviewSubtitle}>{subtitle}</Text> : null}
    </View>
  );
}

function AuthProgress({ current, total }: { current: number; total: number }) {
  return (
    <View style={styles.progressRow}>
      {Array.from({ length: total }).map((_, index) => {
        const active = index < current;
        return <View key={`progress-${index}`} style={[styles.progressPill, active ? styles.progressPillActive : null]} />;
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { flex: 1, backgroundColor: Colors.light.background },
  hero: {
    paddingHorizontal: 18,
    justifyContent: "space-between",
    overflow: "hidden",
  },
  heroBackgroundImage: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: "100%",
  },
  heroBackgroundVideo: {
    ...StyleSheet.absoluteFillObject,
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  heroGlowLarge: {
    position: "absolute",
    width: 240,
    height: 240,
    borderRadius: 120,
    right: -80,
    top: 40,
  },
  heroGlowSmall: {
    position: "absolute",
    width: 96,
    height: 96,
    borderRadius: 48,
    left: -22,
    bottom: 42,
  },
  heroTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    zIndex: 2,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.16)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  backSpacer: { width: 40, height: 40 },
  heroTextBlock: {
    zIndex: 2,
    gap: 6,
  },
  eyebrowPill: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  eyebrowText: {
    fontSize: 10,
    fontFamily: "Poppins_600SemiBold",
    color: "#fff",
  },
  heroTitle: {
    fontSize: 24,
    lineHeight: 29,
    fontFamily: "Poppins_700Bold",
    color: "#fff",
    maxWidth: "70%",
    textShadowColor: "rgba(0,0,0,0.22)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 10,
  },
  heroSubtitle: {
    fontSize: 12,
    lineHeight: 17,
    fontFamily: "Poppins_400Regular",
    color: "rgba(255,255,255,0.9)",
    maxWidth: "74%",
    textShadowColor: "rgba(0,0,0,0.18)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 8,
  },
  heroVisualWrap: {
    zIndex: 2,
    alignItems: "flex-start",
  },
  heroVisualFullBleedWrap: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },
  heroTextOverlay: {
    zIndex: 2,
    gap: 6,
    marginTop: "auto",
    marginBottom: 10,
  },
  heroStatsRow: {
    flexDirection: "row",
    gap: 10,
    zIndex: 2,
    marginBottom: 6,
  },
  heroStatCard: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  heroStatValue: {
    fontSize: 16,
    fontFamily: "Poppins_700Bold",
    color: "#fff",
  },
  heroStatLabel: {
    fontSize: 10,
    fontFamily: "Poppins_500Medium",
    color: "rgba(255,255,255,0.76)",
  },
  sheetWrap: {
    flex: 1,
    marginTop: 0,
    backgroundColor: Colors.light.background,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 16,
  },
  sheetWrapFlat: {
    paddingHorizontal: 18,
  },
  sheetScroll: {
    flex: 1,
  },
  sheetScrollContent: {
    flexGrow: 1,
    paddingBottom: 12,
  },
  flatHeader: {
    gap: 16,
    marginBottom: 10,
  },
  flatTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  flatBackButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.light.backgroundSecondary,
    borderWidth: 1,
    borderColor: Colors.light.cardBorder,
  },
  flatHeaderBody: {
    gap: 6,
  },
  flatEyebrowPill: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  flatEyebrowText: {
    fontSize: 10,
    fontFamily: "Poppins_600SemiBold",
  },
  flatTitle: {
    fontSize: 24,
    lineHeight: 29,
    fontFamily: "Poppins_700Bold",
    color: Colors.light.text,
  },
  flatSubtitle: {
    fontSize: 12,
    lineHeight: 18,
    fontFamily: "Poppins_400Regular",
    color: Colors.light.textSecondary,
    maxWidth: "88%",
  },
  flatVisualWrap: {
    paddingTop: 6,
  },
  sheetBody: {
    gap: 10,
  },
  sheetFooter: {
    paddingTop: 10,
    marginTop: "auto",
  },
  card: {
    paddingVertical: 4,
  },
  cardTitle: {
    fontSize: 16,
    fontFamily: "Poppins_600SemiBold",
    color: Colors.light.text,
  },
  cardSubtitle: {
    marginTop: 2,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: "Poppins_400Regular",
    color: Colors.light.textSecondary,
  },
  cardContent: {
    gap: 11,
    marginTop: 14,
  },
  alertBox: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  alertText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    color: Colors.light.error,
    fontFamily: "Poppins_500Medium",
  },
  fieldBlock: { gap: 6 },
  fieldLabel: {
    fontSize: 12,
    fontFamily: "Poppins_600SemiBold",
    color: Colors.light.text,
  },
  fieldHint: {
    fontSize: 11,
    lineHeight: 16,
    fontFamily: "Poppins_400Regular",
    color: Colors.light.textTertiary,
  },
  inputShell: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "transparent",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(104,83,69,0.14)",
    paddingHorizontal: 0,
    gap: 8,
  },
  inputShellMultiline: {
    alignItems: "flex-start",
    paddingTop: 12,
    paddingBottom: 12,
  },
  inputIconWrap: {
    width: 24,
    alignItems: "center",
    paddingTop: 1,
  },
  input: {
    flex: 1,
    paddingVertical: 0,
    color: Colors.light.text,
    fontSize: 14,
    fontFamily: "Poppins_400Regular",
  },
  inputMultiline: {
    minHeight: 92,
    textAlignVertical: "top",
  },
  inputTrailing: {
    justifyContent: "center",
  },
  primaryButton: {
    minHeight: 54,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  primaryButtonDisabled: { opacity: 0.72 },
  primaryButtonText: {
    fontSize: 14,
    fontFamily: "Poppins_600SemiBold",
    color: "#fff",
  },
  chipGroup: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    minHeight: 38,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(104,83,69,0.14)",
    backgroundColor: "transparent",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  chipText: {
    fontSize: 12,
    fontFamily: "Poppins_500Medium",
    color: Colors.light.textSecondary,
  },
  chipTextSelected: {
    color: "#fff",
  },
  linkRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 5,
  },
  linkPrompt: {
    fontSize: 13,
    fontFamily: "Poppins_400Regular",
    color: Colors.light.textSecondary,
  },
  linkAction: {
    fontSize: 13,
    fontFamily: "Poppins_600SemiBold",
    color: Colors.light.tint,
  },
  roleCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 0,
    paddingHorizontal: 0,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(104,83,69,0.12)",
  },
  roleIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  roleContent: { flex: 1 },
  roleTitle: {
    fontSize: 14,
    fontFamily: "Poppins_600SemiBold",
    color: Colors.light.text,
  },
  roleDescription: {
    marginTop: 2,
    fontSize: 11,
    lineHeight: 16,
    fontFamily: "Poppins_400Regular",
    color: Colors.light.textSecondary,
  },
  avatarPreviewWrap: {
    alignItems: "flex-start",
    gap: 8,
  },
  avatarPreview: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.28)",
  },
  avatarPreviewText: {
    fontSize: 28,
    color: "#fff",
    fontFamily: "Poppins_700Bold",
  },
  avatarPreviewSubtitle: {
    fontSize: 11,
    fontFamily: "Poppins_500Medium",
    color: "rgba(255,255,255,0.82)",
  },
  progressRow: {
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
  },
  progressPill: {
    width: 18,
    height: 6,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.22)",
  },
  progressPillActive: {
    width: 26,
    backgroundColor: "#fff",
  },
});
