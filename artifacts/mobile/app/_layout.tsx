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
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { apiFetch } from "@/constants/api";
import { AppProvider, useApp } from "@/contexts/AppContext";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function PushNotificationsBootstrap() {
  const { token, user } = useApp();

  useEffect(() => {
    if (!token || !user) {
      return;
    }

    let isMounted = true;

    const registerForPushNotifications = async () => {
      try {
        if (Platform.OS === "android") {
          await Notifications.setNotificationChannelAsync("default", {
            name: "default",
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: "#D4611A",
          });
        }

        if (!Device.isDevice) {
          return;
        }

        const currentPermissions = await Notifications.getPermissionsAsync();
        let finalStatus = currentPermissions.status;

        if (finalStatus !== "granted") {
          const requested = await Notifications.requestPermissionsAsync();
          finalStatus = requested.status;
        }

        if (finalStatus !== "granted") {
          return;
        }

        const projectId =
          Constants.expoConfig?.extra?.eas?.projectId ??
          Constants.easConfig?.projectId ??
          undefined;

        const expoPushToken = projectId
          ? (await Notifications.getExpoPushTokenAsync({ projectId })).data
          : (await Notifications.getExpoPushTokenAsync()).data;

        if (!isMounted || !expoPushToken) {
          return;
        }

        await apiFetch("/push/subscribe", {
          method: "POST",
          token,
          body: JSON.stringify({
            platform: "expo",
            token: expoPushToken,
          }),
        });
      } catch (error) {
        console.warn("push registration failed", error);
      }
    };

    const responseSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as { type?: string; storyId?: string } | undefined;
      if (data?.type === "story-video" && data.storyId) {
        void import("expo-router").then(({ router }) => {
          router.push({ pathname: "/story/[id]", params: { id: data.storyId! } });
        });
        return;
      }

      void import("expo-router").then(({ router }) => {
        router.push("/(tabs)/stories");
      });
    });

    void registerForPushNotifications();

    return () => {
      isMounted = false;
      responseSubscription.remove();
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
