import { Tabs } from "expo-router";
import { Feather, Ionicons } from "@expo/vector-icons";
import React from "react";
import { Platform, StyleSheet, View, useColorScheme } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Colors from "@/constants/colors";
import { useApp } from "@/contexts/AppContext";

function ClassicTabLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const isWeb = Platform.OS === "web";
  const insets = useSafeAreaInsets();
  const { user } = useApp();
  const isCourier = user?.type === "courier";

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.light.tint,
        tabBarInactiveTintColor: Colors.light.tabIconDefault,
        tabBarLabelStyle: {
          fontFamily: "Poppins_500Medium",
          fontSize: 10,
          marginBottom: 2,
        },
        tabBarStyle: {
          position: "absolute",
          backgroundColor: isDark ? "#1A120A" : "#FFFAF5",
          borderTopWidth: 1,
          borderTopColor: Colors.light.divider,
          elevation: 0,
          bottom: 0,
          paddingBottom: insets.bottom,
          ...(isWeb ? { height: 84 } : {}),
        },
        tabBarBackground: () =>
          isWeb ? (
            <View
              style={[StyleSheet.absoluteFill, { backgroundColor: "#FFFAF5" }]}
            />
          ) : null,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: isCourier ? "Dashboard" : "Accueil",
          tabBarIcon: ({ color }) => (
            <Feather name={isCourier ? "activity" : "home"} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          href: isCourier ? null : undefined,
          title: "Explorer",
          tabBarIcon: ({ color }) => (
            <Feather name="search" size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="stories"
        options={{
          href: isCourier ? null : undefined,
          title: "Stories",
          tabBarIcon: ({ color }) => (
            <Ionicons name="play-circle-outline" size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: isCourier ? "Missions" : "Commandes",
          tabBarIcon: ({ color }) => (
            <Feather name={isCourier ? "truck" : "shopping-bag"} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Compte",
          tabBarIcon: ({ color }) => (
            <Feather name="user" size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="cart"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="help"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}

export default function TabLayout() {
  return <ClassicTabLayout />;
}
