import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { BottomTabMenu } from "../../components/BottomTabMenu";
import { getWorkflowBySlug } from "../../data/workflows";
import { canUseManagementScreens, getMyProfile } from "../../services/profile";

function normalizeMethod(value: string) {
  return value
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c");
}

export default function WorkflowScreen() {
  const params = useLocalSearchParams<{ slug: string }>();
  const workflow = useMemo(() => getWorkflowBySlug(params.slug), [params.slug]);
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    getMyProfile()
      .then(setProfile)
      .catch(() => setProfile(null));
  }, []);

  const management = canUseManagementScreens(profile);
  const visibleFindMethods = workflow.findMethods.filter((method) => !normalizeMethod(method).includes("qr"));

  function openMethod(method: string) {
    const normalized = normalizeMethod(method);

    if (normalized.includes("qr")) {
      router.push("/my-tasks" as any);
      return;
    }

    if (normalized.includes("tc") || normalized.includes("vkn") || normalized.includes("kobuks")) {
      router.push({
        pathname: "/kobuks",
        params: {
          workflow: workflow.kind,
          mode: normalized.includes("tc") || normalized.includes("vkn") ? "identity" : "units",
        },
      } as any);
      return;
    }

    if (normalized.includes("ada") || normalized.includes("parsel") || normalized.includes("unite")) {
      router.push({
        pathname: "/new-task",
        params: { workflow: workflow.kind },
      } as any);
      return;
    }

    router.push("/cbs" as any);
  }

  function startWorkflow() {
    if (management) {
      router.push({
        pathname: "/new-task",
        params: { workflow: workflow.kind },
      } as any);
      return;
    }

    router.push("/my-tasks" as any);
  }

  return (
    <View style={styles.root}>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic">
      <View style={styles.header}>
        <View style={[styles.headerIcon, { borderColor: workflow.accent }]}>
          <MaterialCommunityIcons name={workflow.icon} color={workflow.accent} size={26} />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.kicker}>KOBÜDS 3.0</Text>
          <Text style={styles.title}>{workflow.title}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Üniteyi Bul</Text>
        <View style={styles.methodGrid}>
          {visibleFindMethods.map((method) => (
            <Pressable key={method} onPress={() => openMethod(method)} style={styles.methodButton}>
              <MaterialCommunityIcons name={method.toLocaleLowerCase("tr-TR").includes("qr") ? "qrcode-scan" : "magnify"} color="#38bdf8" size={19} />
              <Text style={styles.methodText}>{method}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.footerActions}>
        <Pressable onPress={startWorkflow} style={[styles.primaryButton, { backgroundColor: workflow.accent }]}>
          <MaterialCommunityIcons name="play-circle-outline" color="white" size={20} />
          <Text style={styles.primaryButtonText}>{management ? workflow.primaryAction : "Görevlerim"}</Text>
        </Pressable>
        <Pressable onPress={() => router.push("/cbs" as any)} style={styles.secondaryButton}>
          <MaterialCommunityIcons name="map-marker-radius-outline" color="#38bdf8" size={19} />
          <Text style={styles.secondaryButtonText}>CBS</Text>
        </Pressable>
      </View>
      </ScrollView>
      <BottomTabMenu />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#020617",
  },
  screen: {
    flex: 1,
    backgroundColor: "#020617",
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 110,
    gap: 12,
  },
  header: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  headerIcon: {
    width: 48,
    height: 48,
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: "#0f172a",
    alignItems: "center",
    justifyContent: "center",
  },
  headerText: {
    flex: 1,
  },
  kicker: {
    color: "#38bdf8",
    fontSize: 12,
    fontWeight: "800",
  },
  title: {
    color: "white",
    fontSize: 28,
    fontWeight: "800",
    marginTop: 2,
  },
  section: {
    backgroundColor: "#0f172a",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#1e293b",
    padding: 14,
    gap: 10,
  },
  sectionTitle: {
    color: "white",
    fontSize: 17,
    fontWeight: "800",
  },
  methodGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  methodButton: {
    width: "48%",
    minHeight: 50,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#1e293b",
    backgroundColor: "#111827",
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  methodText: {
    color: "white",
    flex: 1,
    fontWeight: "800",
    fontSize: 12,
  },
  footerActions: {
    gap: 9,
  },
  primaryButton: {
    minHeight: 50,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 12,
  },
  primaryButtonText: {
    color: "white",
    fontWeight: "800",
    textAlign: "center",
  },
  secondaryButton: {
    minHeight: 48,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#1e293b",
    backgroundColor: "#111827",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  secondaryButtonText: {
    color: "#38bdf8",
    fontWeight: "800",
  },
});
