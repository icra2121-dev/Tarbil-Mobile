import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { useEffect, useState } from "react";

import { canUseManagementScreens, getMyProfile } from "../../services/profile";

export default function TabsLayout() {
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    getMyProfile()
      .then(setProfile)
      .catch(() => setProfile(null));
  }, []);

  const management = canUseManagementScreens(profile);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: "#020617",
          borderTopColor: "#1e293b",
        },
        tabBarActiveTintColor: "#22c55e",
        tabBarInactiveTintColor: "#94a3b8",
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Ana Sayfa",
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="view-dashboard-outline" color={color} size={size} />
          ),
        }}
      />

      <Tabs.Screen
        name="cbs"
        options={{
          title: "CBS",
          href: profile ? "/cbs" : null,
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="map-marker-radius-outline" color={color} size={size} />
          ),
        }}
      />

      <Tabs.Screen
        name="tasks"
        options={{
          title: "Denetimler",
          href: management ? "/tasks" : null,
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="clipboard-check-outline" color={color} size={size} />
          ),
        }}
      />

      <Tabs.Screen
        name="reports"
        options={{
          title: "Rapor",
          href: profile ? "/reports" : null,
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="file-document-outline" color={color} size={size} />
          ),
        }}
      />

      <Tabs.Screen
        name="kobuks"
        options={{
          href: null,
        }}
      />

      <Tabs.Screen
        name="more"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
