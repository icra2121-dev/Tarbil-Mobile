import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router, usePathname } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { canUseManagementScreens, getMyProfile } from "../services/profile";

type TabItem = {
  key: string;
  label: string;
  href: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
};

export function BottomTabMenu() {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const [profile, setProfile] = useState<any>(undefined);

  useEffect(() => {
    let active = true;

    getMyProfile()
      .then((nextProfile) => {
        if (active) {
          setProfile(nextProfile);
        }
      })
      .catch(() => {
        if (active) {
          setProfile(null);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const management = canUseManagementScreens(profile);
  const tabs = useMemo<TabItem[]>(
    () => [
      { key: "home", label: "Ana Sayfa", href: "/(tabs)", icon: "view-dashboard-outline" },
      { key: "cbs", label: "CBS", href: "/cbs", icon: "map-marker-radius-outline" },
      {
        key: "tasks",
        label: management ? "Denetimler" : "Görevlerim",
        href: management ? "/tasks" : "/my-tasks",
        icon: "clipboard-check-outline",
      },
      { key: "reports", label: "Rapor", href: "/reports", icon: "file-document-outline" },
    ],
    [management],
  );

  if (profile === null || profile === undefined) {
    return null;
  }

  return (
    <View style={[styles.tabBar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      {tabs.map((item) => {
        const active = isActiveTab(pathname, item);

        return (
          <Pressable
            key={item.key}
            onPress={() => router.push(item.href as any)}
            style={styles.tabButton}
          >
            <MaterialCommunityIcons name={item.icon} color={active ? "#22c55e" : "#94a3b8"} size={22} />
            <Text style={[styles.tabLabel, active && styles.tabLabelActive]} numberOfLines={1}>
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function isActiveTab(pathname: string, item: TabItem) {
  if (item.key === "home") {
    return pathname === "/" || pathname === "/(tabs)";
  }

  if (item.key === "tasks") {
    return pathname.startsWith(item.href) || (pathname.startsWith("/task") && !pathname.includes("/camera"));
  }

  if (item.key === "reports") {
    return pathname.startsWith("/reports");
  }

  return pathname.startsWith(item.href);
}

const styles = StyleSheet.create({
  tabBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    minHeight: 72,
    borderTopWidth: 1,
    borderTopColor: "#1e293b",
    backgroundColor: "#020617",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingTop: 8,
  },
  tabButton: {
    flex: 1,
    minHeight: 54,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },
  tabLabel: {
    color: "#94a3b8",
    fontSize: 11,
    fontWeight: "700",
  },
  tabLabelActive: {
    color: "#22c55e",
  },
});
