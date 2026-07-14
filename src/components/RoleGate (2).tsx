import { router } from "expo-router";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { getMyProfile, isAdmin } from "../services/profile";

type RoleGateProps = {
  children: ReactNode;
  adminOnly?: boolean;
};

export function RoleGate({ children, adminOnly = false }: RoleGateProps) {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMyProfile()
      .then(setProfile)
      .catch(() => setProfile(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <View style={styles.screen}>
        <ActivityIndicator color="#22c55e" />
      </View>
    );
  }

  if (adminOnly && !isAdmin(profile)) {
    return (
      <View style={styles.screen}>
        <View style={styles.card}>
          <Text style={styles.title}>Yetki gerekli</Text>
          <Pressable onPress={() => router.replace("/my-tasks" as any)} style={styles.button}>
            <Text style={styles.buttonText}>Görevlerim</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#020617",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  card: {
    width: "100%",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#1e293b",
    backgroundColor: "#0f172a",
    padding: 18,
  },
  title: {
    color: "white",
    fontSize: 22,
    fontWeight: "800",
  },
  text: {
    color: "#94a3b8",
    lineHeight: 20,
    marginTop: 8,
  },
  button: {
    minHeight: 46,
    borderRadius: 8,
    backgroundColor: "#16a34a",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
  },
  buttonText: {
    color: "white",
    fontWeight: "800",
  },
});
