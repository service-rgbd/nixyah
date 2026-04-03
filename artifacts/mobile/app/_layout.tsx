import {
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
  useFonts,
} from "@expo-google-fonts/poppins";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { apiFetch } from "@/constants/api";
import { getPushNotificationsEnabled, registerExpoPushSubscription, isRemotePushSupportedInCurrentRuntime } from "@/constants/push-notifications";
import { AppProvider, useApp } from "@/contexts/AppContext";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();
let notificationsHandlerConfigured = false;

function PushNotificationsBootstrap() {
  const { token, user } = useApp();

  useEffect(() => {
    const supportsRemotePushInCurrentRuntime = isRemotePushSupportedInCurrentRuntime();

    if (!token || !user || Platform.OS === "web" || !supportsRemotePushInCurrentRuntime) {
      return;
    }

    let isMounted = true;
    let responseSubscription: { remove: () => void } | null = null;

    const handleNotificationResponse = async (response: {
      notification: {
        request: {
          content: {
            data?: {
              type?: string;
              storyId?: string;
              orderId?: string | number;
              deliveryJobId?: string | number;
              customRequestId?: string | number;
              screen?: string;
            };
          };
        };
      };
    } | null | undefined) => {
      const data = response?.notification.request.content.data;

      if (data?.type === "story-video" && data.storyId) {
        const { router } = await import("expo-router");
        router.push({ pathname: "/story/[id]", params: { id: data.storyId } });
        return;
      }

      if (data?.screen === "courier/orders") {
        const { router } = await import("expo-router");
        router.push("/(tabs)/orders?mode=delivery");
        return;
      }

      if (data?.screen === "chef-orders" || data?.screen === "orders") {
        const { router } = await import("expo-router");
        router.push("/(tabs)/orders");
        return;
      }

      if (data?.screen === "client-review" && data.orderId) {
        const { router } = await import("expo-router");
        router.push({ pathname: "/client/review/[orderId]", params: { orderId: String(data.orderId) } });
        return;
      }

      if ((data?.screen === "delivery-tracking" || data?.deliveryJobId) && data?.deliveryJobId) {
        const { router } = await import("expo-router");
        router.push({ pathname: "/delivery/job/[id]", params: { id: String(data.deliveryJobId) } });
        return;
      }

      if (data?.orderId || data?.customRequestId) {
        const { router } = await import("expo-router");
        router.push("/(tabs)/orders");
        return;
      }

      const { router } = await import("expo-router");
      router.push("/(tabs)/stories");
    };

    const registerForPushNotifications = async () => {
      try {
        const Notifications = await import("expo-notifications");

        if (!notificationsHandlerConfigured) {
          Notifications.setNotificationHandler({
            handleNotification: async () => ({
              shouldPlaySound: true,
              shouldSetBadge: true,
              shouldShowBanner: true,
              shouldShowList: true,
            }),
          });
          notificationsHandlerConfigured = true;
        }

        if (Platform.OS === "android") {
          await Notifications.setNotificationChannelAsync("default", {
            name: "default",
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: "#D4611A",
          });
        }

        const notificationsEnabled = await getPushNotificationsEnabled();
        if (!notificationsEnabled) {
          return;
        }

        const lastResponse = await Notifications.getLastNotificationResponseAsync();
        await handleNotificationResponse(lastResponse);

        responseSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
          void handleNotificationResponse(response);
        });

        const registration = await registerExpoPushSubscription(token);
        if (!isMounted || !registration.ok) {
          return;
        }
      } catch (error) {
        console.warn("push registration failed", error);
      }
    };

    void registerForPushNotifications();

    return () => {
      isMounted = false;
      responseSubscription?.remove();
    };
  }, [token, user]);

  return null;
}

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen
        name="chef/[id]"
        options={{ headerShown: false, animation: "slide_from_right" }}
      />
      <Stack.Screen
        name="order/[chefId]"
        options={{
          headerShown: false,
          animation: "slide_from_bottom",
          presentation: "modal",
        }}
      />
      <Stack.Screen
        name="chat/[chatId]"
        options={{ headerShown: false, animation: "slide_from_right" }}
      />
      <Stack.Screen
        name="auth/login"
        options={{ headerShown: false, animation: "slide_from_right" }}
      />
      <Stack.Screen
        name="auth/register-client"
        options={{ headerShown: false, animation: "slide_from_right" }}
      />
      <Stack.Screen
        name="auth/register-chef"
        options={{ headerShown: false, animation: "slide_from_right" }}
      />
      <Stack.Screen
        name="auth/register-courier"
        options={{ headerShown: false, animation: "slide_from_right" }}
      />
      <Stack.Screen
        name="auth/confirm"
        options={{ headerShown: false, animation: "slide_from_right" }}
      />
      <Stack.Screen
        name="chef/post-story"
        options={{ headerShown: false, animation: "slide_from_bottom", presentation: "modal" }}
      />
      <Stack.Screen
        name="chef/my-dishes"
        options={{ headerShown: false, animation: "slide_from_right" }}
      />
      <Stack.Screen
        name="chef/stats"
        options={{ headerShown: false, animation: "slide_from_right" }}
      />
      <Stack.Screen
        name="chef/notifications"
        options={{ headerShown: false, animation: "slide_from_right" }}
      />
      <Stack.Screen
        name="delivery/job/[id]"
        options={{ headerShown: false, animation: "slide_from_right" }}
      />
      <Stack.Screen
        name="client/addresses"
        options={{ headerShown: false, animation: "slide_from_right" }}
      />
      <Stack.Screen
        name="client/review/[orderId]"
        options={{ headerShown: false, animation: "slide_from_bottom", presentation: "modal" }}
      />
      <Stack.Screen
        name="help/order"
        options={{ headerShown: false, animation: "slide_from_right" }}
      />
      <Stack.Screen
        name="help/inbox"
        options={{ headerShown: false, animation: "slide_from_right" }}
      />
      <Stack.Screen
        name="help/general"
        options={{ headerShown: false, animation: "slide_from_right" }}
      />
      <Stack.Screen
        name="settings/notifications"
        options={{ headerShown: false, animation: "slide_from_right" }}
      />
      
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <AppProvider>
              <PushNotificationsBootstrap />
              <RootLayoutNav />
            </AppProvider>
          </GestureHandlerRootView>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
