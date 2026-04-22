import { Tabs, usePathname } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Platform, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Colors from "@/constants/colors";
import { useApp } from "@/contexts/AppContext";

type IoniconsName = React.ComponentProps<typeof Ionicons>["name"];

/** Renders the icon pill used in every tab */
function TabIcon({
  name,
  nameActive,
  focused,
  color,
  isDark,
  activeBackground,
}: {
  name: IoniconsName;
  nameActive: IoniconsName;
  focused: boolean;
  color: string;
  isDark: boolean;
  activeBackground: string;
}) {
  return (
    <View
      style={[
        tabStyles.wrap,
        isDark && tabStyles.wrapDark,
        focused && tabStyles.wrapActive,
        focused && { backgroundColor: activeBackground },
        focused && isDark && tabStyles.wrapActiveDark,
      ]}
    >
      <Ionicons name={focused ? nameActive : name} size={22} color={color} />
    </View>
  );
}

const tabStyles = StyleSheet.create({
  wrap: {
    width: 44,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 15,
  },
  wrapDark: {
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  wrapActive: {
    backgroundColor: Colors.light.backgroundSecondary,
    shadowColor: "rgba(36, 24, 16, 0.12)",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 18,
    elevation: 4,
  },
  wrapActiveDark: {
    backgroundColor: "rgba(212,97,26,0.22)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
});

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const { user } = useApp();
  const isChef = user?.type === "chef";
  const isCourier = user?.type === "courier";
  const normalizedPathname = pathname?.replace(/\/+$/, "") ?? "";
  const isStoriesActive = normalizedPathname === "/stories" || normalizedPathname.startsWith("/story/");
  const roleAccent = isCourier ? "#2D8C78" : isChef ? Colors.light.terracotta : Colors.light.tint;
  const roleSurface = isCourier ? "rgba(244,252,249,0.98)" : isChef ? "rgba(255,246,239,0.98)" : "rgba(255,250,245,0.98)";
  const roleActiveBackground = isCourier ? "#DDF4EE" : isChef ? "#FFE4D3" : Colors.light.backgroundSecondary;
  const tabBarSurface = isStoriesActive ? "rgba(8,8,10,0.96)" : roleSurface;
  const activeTint = isStoriesActive ? "#FFFFFF" : roleAccent;
  const inactiveTint = isStoriesActive ? "rgba(255,255,255,0.58)" : "rgba(123,95,73,0.72)";
  const tabBarBottomInset = Platform.OS === "ios" ? Math.max(insets.bottom - 6, 10) : Math.max(insets.bottom, 8);
  const tabBarHeight = Platform.OS === "web" ? 66 : 50 + tabBarBottomInset;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: activeTint,
        tabBarInactiveTintColor: inactiveTint,
        tabBarLabelStyle: {
          fontFamily: "Poppins_600SemiBold",
          fontSize: 9,
          letterSpacing: 0.2,
          marginBottom: Platform.OS === "ios" ? 0 : 2,
        },
        tabBarItemStyle: {
          paddingTop: 2,
          paddingBottom: 2,
        },
        tabBarStyle: {
          backgroundColor: tabBarSurface,
          borderTopLeftRadius: 22,
          borderTopRightRadius: 22,
          height: tabBarHeight,
          paddingTop: 4,
          paddingBottom: tabBarBottomInset,
          borderTopColor: "transparent",
          borderTopWidth: 0,
          shadowColor: isStoriesActive ? "#000000" : "#1A120A",
          shadowOffset: { width: 0, height: -6 },
          shadowOpacity: isStoriesActive ? 0.18 : 0.06,
          shadowRadius: isStoriesActive ? 16 : 12,
          elevation: 10,
          overflow: "hidden",
          ...(Platform.OS === "web" ? { paddingBottom: 8, paddingTop: 4, height: 66 } : {}),
        },
        tabBarHideOnKeyboard: true,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: isCourier ? "Dashboard" : "Accueil",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              name={isCourier ? "pulse-outline" : "home-outline"}
              nameActive={isCourier ? "pulse" : "home"}
              focused={focused}
              color={color}
              isDark={isStoriesActive}
              activeBackground={isStoriesActive ? "rgba(255,255,255,0.14)" : roleActiveBackground}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          href: isCourier ? null : undefined,
          title: "Explorer",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              name="search-outline"
              nameActive="search"
              focused={focused}
              color={color}
              isDark={isStoriesActive}
              activeBackground={isStoriesActive ? "rgba(255,255,255,0.14)" : roleActiveBackground}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="stories"
        options={{
          href: isCourier ? null : undefined,
          title: "Stories",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              name="play-circle-outline"
              nameActive="play-circle"
              focused={focused}
              color={color}
              isDark={isStoriesActive}
              activeBackground={isStoriesActive ? "rgba(255,255,255,0.14)" : roleActiveBackground}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: isCourier ? "Missions" : isChef ? "Reçues" : "Commandes",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              name={isCourier ? "bicycle-outline" : isChef ? "receipt-outline" : "bag-outline"}
              nameActive={isCourier ? "bicycle" : isChef ? "receipt" : "bag"}
              focused={focused}
              color={color}
              isDark={isStoriesActive}
              activeBackground={isStoriesActive ? "rgba(255,255,255,0.14)" : roleActiveBackground}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Compte",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              name="person-outline"
              nameActive="person"
              focused={focused}
              color={color}
              isDark={isStoriesActive}
              activeBackground={isStoriesActive ? "rgba(255,255,255,0.14)" : roleActiveBackground}
            />
          ),
        }}
      />
      <Tabs.Screen name="messages" options={{ href: null }} />
      <Tabs.Screen name="cart" options={{ href: null }} />
      <Tabs.Screen name="help" options={{ href: null }} />
    </Tabs>
  );
}
