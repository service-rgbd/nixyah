import { Tabs } from "expo-router";
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
}: {
  name: IoniconsName;
  nameActive: IoniconsName;
  focused: boolean;
  color: string;
}) {
  return (
    <View style={[tabStyles.wrap, focused && tabStyles.wrapActive]}>
      <Ionicons name={focused ? nameActive : name} size={22} color={color} />
    </View>
  );
}

const tabStyles = StyleSheet.create({
  wrap: {
    width: 46,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 15,
  },
  wrapActive: {
    backgroundColor: Colors.light.backgroundSecondary,
  },
});

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const { user } = useApp();
  const isChef = user?.type === "chef";
  const isCourier = user?.type === "courier";

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.light.tint,
        tabBarInactiveTintColor: Colors.light.tabIconDefault,
        tabBarLabelStyle: {
          fontFamily: "Poppins_600SemiBold",
          fontSize: 10,
          marginBottom: Platform.OS === "ios" ? 0 : 3,
        },
        tabBarStyle: {
          backgroundColor: "#FFFAF5",
          borderTopWidth: 0,
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          paddingTop: 8,
          paddingBottom: insets.bottom > 0 ? insets.bottom : 10,
          shadowColor: "#1A120A",
          shadowOffset: { width: 0, height: -6 },
          shadowOpacity: 0.07,
          shadowRadius: 20,
          elevation: 20,
          ...(Platform.OS === "web" ? { height: 84, paddingBottom: 12 } : {}),
        },
        tabBarBackground: () => (
          <View
            style={[
              StyleSheet.absoluteFill,
              {
                backgroundColor: "#FFFAF5",
                borderTopLeftRadius: 24,
                borderTopRightRadius: 24,
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
