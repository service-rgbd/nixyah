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
}: {
  name: IoniconsName;
  nameActive: IoniconsName;
  focused: boolean;
  color: string;
  isDark: boolean;
}) {
  return (
    <View style={[tabStyles.wrap, isDark && tabStyles.wrapDark, focused && tabStyles.wrapActive, focused && isDark && tabStyles.wrapActiveDark]}>
      <Ionicons name={focused ? nameActive : name} size={22} color={color} />
    </View>
  );
}

const tabStyles = StyleSheet.create({
  wrap: {
    width: 48,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
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
  const isStoriesActive = pathname === "/stories";
  const tabBarSurface = isStoriesActive ? "rgba(8,8,10,0.96)" : "rgba(255,250,245,0.94)";
  const tabBarBorder = isStoriesActive ? "rgba(255,255,255,0.08)" : "rgba(77,53,40,0.08)";
  const activeTint = isStoriesActive ? "#FFFFFF" : Colors.light.tint;
  const inactiveTint = isStoriesActive ? "rgba(255,255,255,0.58)" : Colors.light.tabIconDefault;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: activeTint,
        tabBarInactiveTintColor: inactiveTint,
        tabBarLabelStyle: {
          fontFamily: "Poppins_600SemiBold",
          fontSize: 10,
          letterSpacing: 0.2,
          marginBottom: Platform.OS === "ios" ? 0 : 3,
        },
        tabBarStyle: {
          backgroundColor: tabBarSurface,
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
          paddingTop: 10,
          paddingBottom: insets.bottom > 0 ? insets.bottom : 10,
          borderTopColor: tabBarBorder,
          borderTopWidth: 1,
          shadowColor: isStoriesActive ? "#000000" : "#1A120A",
          shadowOffset: { width: 0, height: -10 },
          shadowOpacity: isStoriesActive ? 0.34 : 0.09,
          shadowRadius: isStoriesActive ? 28 : 22,
          elevation: 22,
          ...(Platform.OS === "web" ? { height: 84, paddingBottom: 12 } : {}),
        },
        tabBarBackground: () => (
          <View
            style={[
              StyleSheet.absoluteFill,
              {
                backgroundColor: tabBarSurface,
                borderTopLeftRadius: 28,
                borderTopRightRadius: 28,
                borderTopWidth: 1,
                borderTopColor: tabBarBorder,
              },
            ]}
          />
        ),
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
