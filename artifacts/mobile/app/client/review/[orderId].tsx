import { Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
	ActivityIndicator,
	Alert,
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
import { apiFetch } from "@/constants/api";
import { useApp } from "@/contexts/AppContext";

function StarRow({
	value,
	onChange,
}: {
	value: number;
	onChange: (next: number) => void;
}) {
	return (
		<View style={styles.starRow}>
			{[1, 2, 3, 4, 5].map((star) => {
				const active = star <= value;
				return (
					<Pressable key={star} style={[styles.starBtn, active && styles.starBtnActive]} onPress={() => onChange(star)}>
						<Feather name="star" size={24} color={active ? "#F59E0B" : Colors.light.textTertiary} />
					</Pressable>
				);
			})}
		</View>
	);
}

export default function ClientReviewScreen() {
	const { orderId } = useLocalSearchParams<{ orderId: string }>();
	const insets = useSafeAreaInsets();
	const { token, user, orders, refreshOrders, refreshChefs } = useApp();
	const [restaurantRating, setRestaurantRating] = useState(0);
	const [deliveryRating, setDeliveryRating] = useState(0);
	const [restaurantComment, setRestaurantComment] = useState("");
	const [deliveryComment, setDeliveryComment] = useState("");
	const [submitting, setSubmitting] = useState(false);
	const [bootstrapped, setBootstrapped] = useState(false);

	const order = useMemo(() => orders.find((item) => item.id === String(orderId)), [orderId, orders]);
	const topInset = Platform.OS === "web" ? 67 : insets.top;
	const bottomInset = Platform.OS === "web" ? 28 : insets.bottom;
	const needsDeliveryReview = Boolean(order?.delivery);
	const alreadyReviewed = Boolean(order?.review && !order?.canReview);

	useEffect(() => {
		if (!bootstrapped) {
			void refreshOrders().finally(() => setBootstrapped(true));
		}
	}, [bootstrapped, refreshOrders]);

	useEffect(() => {
		if (!order?.review) {
			return;
		}

		setRestaurantRating(order.review.restaurantRating ?? 0);
		setRestaurantComment(order.review.restaurantComment ?? "");
		setDeliveryRating(order.review.deliveryRating ?? 0);
		setDeliveryComment(order.review.deliveryComment ?? "");
	}, [order?.review]);

	const handleSubmit = async () => {
		if (!token || user?.type !== "client") {
			router.push("/auth/login");
			return;
		}

		if (!order) {
			Alert.alert("Commande introuvable", "Impossible de retrouver cette commande pour l'instant.");
			return;
		}

		if (restaurantRating < 1 || (needsDeliveryReview && deliveryRating < 1)) {
			Alert.alert("Notes incomplètes", "Choisissez une note entre 1 et 5 étoiles pour chaque section.");
			return;
		}

		setSubmitting(true);
		try {
			await apiFetch(`/orders/${order.id}/review`, {
				method: "POST",
				token,
				body: JSON.stringify({
					restaurantRating,
					restaurantComment,
					deliveryRating: needsDeliveryReview ? deliveryRating : undefined,
					deliveryComment: needsDeliveryReview ? deliveryComment : undefined,
				}),
			});
			await Promise.all([refreshOrders(), refreshChefs()]);
			Alert.alert("Merci", "Votre évaluation a bien été envoyée.", [
				{ text: "Fermer", onPress: () => router.replace("/(tabs)/orders") },
			]);
		} catch (error: any) {
			Alert.alert("Erreur", error?.message ?? "Impossible d'envoyer votre évaluation pour le moment.");
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<View style={styles.screen}>
			<ScrollView contentContainerStyle={{ paddingTop: topInset + 14, paddingBottom: bottomInset + 30 }}>
				<View style={styles.headerRow}>
					<Pressable style={styles.closeBtn} onPress={() => router.back()}>
						<Feather name="x" size={20} color="#fff" />
					</Pressable>
				</View>

				<View style={styles.contentWrap}>
					<Text style={styles.title}>Évaluez votre commande</Text>
					<Text style={styles.subtitle}>
						Donnez une note honnête sur le restaurant et la livraison pour améliorer l'expérience des prochaines commandes.
					</Text>

					{!bootstrapped && !order ? (
						<View style={styles.loadingWrap}>
							<ActivityIndicator color="#fff" />
						</View>
					) : null}

					{order ? (
						<>
							<View style={styles.reviewCard}>
								<Text style={styles.sectionTitle}>{`Comment était ${order.chefName} ?`}</Text>
								<Text style={styles.sectionSub}>Tenez compte du goût, des portions et de la présentation.</Text>
								<StarRow value={restaurantRating} onChange={setRestaurantRating} />
								<TextInput
									style={styles.commentInput}
									placeholder="Un commentaire rapide sur le restaurant"
									placeholderTextColor="rgba(255,255,255,0.45)"
									multiline
									value={restaurantComment}
									onChangeText={setRestaurantComment}
								/>
							</View>

							{needsDeliveryReview ? (
								<View style={styles.reviewCard}>
									<Text style={styles.sectionTitle}>Comment s'est passée votre livraison ?</Text>
									<Text style={styles.sectionSub}>Tenez compte du délai, du soin et des mises à jour du livreur.</Text>
									<StarRow value={deliveryRating} onChange={setDeliveryRating} />
									<TextInput
										style={styles.commentInput}
										placeholder="Un commentaire rapide sur la livraison"
										placeholderTextColor="rgba(255,255,255,0.45)"
										multiline
										value={deliveryComment}
										onChangeText={setDeliveryComment}
									/>
								</View>
							) : null}

							{alreadyReviewed ? (
								<View style={styles.reviewedBanner}>
									<Feather name="check-circle" size={16} color="#86EFAC" />
									<Text style={styles.reviewedBannerText}>Cette commande a déjà été évaluée.</Text>
								</View>
							) : (
								<Pressable style={[styles.submitBtn, submitting && styles.submitBtnDisabled]} onPress={handleSubmit} disabled={submitting}>
									{submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Envoyer</Text>}
								</Pressable>
							)}
						</>
					) : bootstrapped ? (
						<View style={styles.emptyWrap}>
							<Text style={styles.emptyTitle}>Commande introuvable</Text>
							<Text style={styles.emptySub}>Revenez à votre historique puis rouvrez l'évaluation.</Text>
						</View>
					) : null}
				</View>
			</ScrollView>
		</View>
	);
}

const styles = StyleSheet.create({
	screen: { flex: 1, backgroundColor: "#050505" },
	headerRow: { paddingHorizontal: 24 },
	closeBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: "rgba(255,255,255,0.12)", alignItems: "center", justifyContent: "center" },
	contentWrap: { paddingHorizontal: 24, gap: 22 },
	title: { fontSize: 34, lineHeight: 40, fontFamily: "Poppins_700Bold", color: "#FFFFFF", marginTop: 10 },
	subtitle: { fontSize: 16, lineHeight: 24, fontFamily: "Poppins_400Regular", color: "rgba(255,255,255,0.82)" },
	loadingWrap: { paddingVertical: 40, alignItems: "center", justifyContent: "center" },
	reviewCard: { gap: 14, paddingVertical: 8 },
	sectionTitle: { fontSize: 20, lineHeight: 28, fontFamily: "Poppins_700Bold", color: "#FFFFFF" },
	sectionSub: { fontSize: 15, lineHeight: 23, fontFamily: "Poppins_400Regular", color: "rgba(255,255,255,0.78)" },
	starRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 6 },
	starBtn: { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.08)" },
	starBtnActive: { backgroundColor: "rgba(245,158,11,0.18)" },
	commentInput: {
		minHeight: 96,
		borderRadius: 18,
		borderWidth: 1,
		borderColor: "rgba(255,255,255,0.14)",
		backgroundColor: "rgba(255,255,255,0.06)",
		paddingHorizontal: 16,
		paddingVertical: 14,
		fontSize: 15,
		lineHeight: 22,
		fontFamily: "Poppins_400Regular",
		color: "#FFFFFF",
		textAlignVertical: "top",
	},
	reviewedBanner: { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 16, backgroundColor: "rgba(134,239,172,0.12)", paddingHorizontal: 14, paddingVertical: 12 },
	reviewedBannerText: { fontSize: 14, fontFamily: "Poppins_500Medium", color: "#D1FAE5" },
	submitBtn: { marginTop: 8, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.18)", paddingVertical: 18, alignItems: "center", justifyContent: "center" },
	submitBtnDisabled: { opacity: 0.7 },
	submitBtnText: { fontSize: 18, fontFamily: "Poppins_700Bold", color: "#FFFFFF" },
	emptyWrap: { paddingVertical: 60, alignItems: "center", gap: 8 },
	emptyTitle: { fontSize: 18, fontFamily: "Poppins_600SemiBold", color: "#FFFFFF" },
	emptySub: { fontSize: 14, lineHeight: 21, fontFamily: "Poppins_400Regular", color: "rgba(255,255,255,0.75)", textAlign: "center" },
});
