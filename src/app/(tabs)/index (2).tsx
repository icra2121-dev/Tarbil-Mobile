import { MaterialCommunityIcons } from "@expo/vector-icons";
import Constants from "expo-constants";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { signOut } from "../../services/auth";
import { DashboardStats, RecentDashboardItem, getDashboardStats } from "../../services/dashboard";
import { canUseManagementScreens, getMyProfile } from "../../services/profile";
import { getTasks } from "../../services/tasks";
import { startLiveTracking } from "../../services/tracking";
import { getTaskStatus, getTaskWorkflowKind, isTaskCancelled, isTaskCompleted, isTaskStarted } from "../../services/workflowGuard";

const emptyStats: DashboardStats = {
  taskCount: 0,
  cityCount: 0,
  districtCount: 0,
  personnelCount: 0,
  fieldPersonnelCount: 0,
  recentOperationCount: 0,
  recentItems: [],
};

const appVersion = Constants.nativeAppVersion || Constants.expoConfig?.version || "3.0.0";

const knownPersonnelWorkLocations: Record<string, { city: string; district: string; office: string }> = {
  "ismail zengin": {
    city: "Antalya",
    district: "Aksu",
    office: "Antalya Aksu İlçe Tarım ve Orman Müdürlüğü",
  },
};

const workflowTypeLabels = {
  inspection: "Başvurulu",
  detection: "Re'sen",
  classification: "Sınıflandırma",
};

function isFieldTask(task: any) {
  return isTaskStarted(task) && !isTaskCompleted(task) && !isTaskCancelled(task);
}

function firstFilledValue(items: any[], keys: string[]) {
  for (const item of items) {
    for (const key of keys) {
      const value = String(item?.[key] || "").trim();

      if (value) {
        return value;
      }
    }
  }

  return "";
}

function firstProfileValue(profile: any, keys: string[]) {
  for (const key of keys) {
    const value = profile?.[key];

    if (Array.isArray(value)) {
      const first = value.map((item) => String(item || "").trim()).find(Boolean);

      if (first) {
        return first;
      }
    }

    const text = String(value || "").trim();

    if (text) {
      return text.includes(",") ? text.split(",")[0].trim() : text;
    }
  }

  return "";
}

function normalizeLookupText(value: unknown) {
  return String(value || "")
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .trim();
}

function getKnownPersonnelWorkLocation(profile: any) {
  const candidates = [profile?.full_name, profile?.email ? String(profile.email).split("@")[0] : ""].map(normalizeLookupText);

  return candidates.map((candidate) => knownPersonnelWorkLocations[candidate]).find(Boolean) || null;
}

function getWorkLocation(profile: any, tasks: any[]) {
  const knownLocation = getKnownPersonnelWorkLocation(profile);
  const city =
    firstProfileValue(profile, ["work_city", "assigned_city", "assigned_cities", "city", "province", "province_name", "il"]) ||
    knownLocation?.city ||
    firstFilledValue(tasks, ["city", "province", "il"]);
  const district =
    firstProfileValue(profile, ["work_district", "assigned_district", "assigned_districts", "district", "district_name", "ilce"]) ||
    knownLocation?.district ||
    firstFilledValue(tasks, ["district_name", "district", "ilce"]);
  const office =
    firstProfileValue(profile, ["work_office", "office_name", "institution_name", "ministry_office", "directorate", "mudurluk"]) ||
    knownLocation?.office ||
    "";

  return {
    city,
    district,
    office,
  };
}

export default function HomeScreen() {
  const [stats, setStats] = useState<DashboardStats>(emptyStats);
  const [profile, setProfile] = useState<any>(null);
  const [latestAssignedTask, setLatestAssignedTask] = useState<any>(null);
  const [workLocation, setWorkLocation] = useState({ city: "", district: "", office: "" });

  useFocusEffect(
    useCallback(() => {
      let active = true;

      Promise.allSettled([getDashboardStats(), getMyProfile(), getTasks()]).then(([dashboardResult, profileResult, tasksResult]) => {
        if (!active) {
          return;
        }

        const nextProfile = profileResult.status === "fulfilled" ? profileResult.value : null;
        const personalTasks =
          tasksResult.status === "fulfilled"
            ? (tasksResult.value.data || []).filter((task: any) => !isTaskCancelled(task))
            : [];
        const completedTasks = personalTasks.filter(isTaskCompleted);
        const activeTasks = personalTasks.filter((task: any) => !isTaskCompleted(task) && !isTaskCancelled(task));
        const nextManagement = canUseManagementScreens(nextProfile);
        const nextWorkLocation = getWorkLocation(nextProfile, nextManagement ? [] : personalTasks);

        if (nextProfile && !nextManagement) {
          startLiveTracking().catch(() => undefined);
          setStats({
            taskCount: personalTasks.length,
            cityCount: new Set(personalTasks.map((task: any) => String(task.city || "").trim()).filter(Boolean)).size,
            districtCount: new Set(
              personalTasks.map((task: any) => String(task.district_name || task.district || "").trim()).filter(Boolean),
            ).size,
            personnelCount: personalTasks.filter(isFieldTask).length,
            fieldPersonnelCount: completedTasks.length,
            recentOperationCount: completedTasks.length,
            recentItems: completedTasks.slice(0, 5),
          });
          setLatestAssignedTask(activeTasks[0] || null);
        } else if (dashboardResult.status === "fulfilled") {
          setStats(dashboardResult.value);
          setLatestAssignedTask(null);
        }

        if (nextProfile) {
          setProfile(nextProfile);
          setWorkLocation(nextWorkLocation);
        }
      });

      return () => {
        active = false;
      };
    }, []),
  );

  async function logout() {
    await signOut();
    router.replace("/login");
  }

  const initials = useMemo(() => {
    const name = profile?.full_name || profile?.email || "İZ";
    return String(name)
      .split(" ")
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toLocaleUpperCase("tr-TR");
  }, [profile]);

  const management = canUseManagementScreens(profile);
  const workLocationTitle =
    workLocation.city && workLocation.district
      ? `${workLocation.city} / ${workLocation.district}`
      : workLocation.city || workLocation.district || "Atama bekliyor";
  const workLocationHelper =
    workLocation.office || (workLocation.city || workLocation.district ? "Çalışma bölgesi" : "Bakanlık personel kaydında il/ilçe yok");

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic">
      <View style={styles.header}>
        <View style={styles.brand}>
          <Text style={styles.kicker}>Tarım ve Orman Bakanlığı</Text>
          <Text style={styles.title}>KOBÜDS</Text>
          <Text style={styles.subtitle}>Kapalı Ortamda Bitkisel Üretim Denetim Sistemi</Text>
          <Text style={styles.versionText}>Sürüm {appVersion}</Text>
        </View>
        <Pressable onPress={() => router.push("/profile")} style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </Pressable>
      </View>

      <View style={styles.operatorCard}>
        <View style={styles.operatorInfo}>
          <Text style={styles.operatorLabel}>Aktif kullanıcı</Text>
          <Text style={styles.operatorName}>{profile?.full_name || profile?.email || "Saha kullanıcısı"}</Text>
          <Text style={styles.operatorRole}>Rol: {profile?.title || profile?.role || "denetçi"}</Text>
        </View>
        <View style={styles.operatorActions}>
          <Pressable onPress={() => Alert.alert("Bildirimler", "Yeni saha bildirimi bulunmuyor.")} style={styles.smallButton}>
            <MaterialCommunityIcons name="bell-outline" color="white" size={16} />
          </Pressable>
          <Pressable onPress={logout} style={[styles.smallButton, styles.logoutButton]}>
            <MaterialCommunityIcons name="logout" color="white" size={16} />
          </Pressable>
        </View>
      </View>

      {management ? (
        <View style={styles.workflowPanel}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionHeaderText}>
              <Text style={styles.sectionTitle}>Görev Yönetimi</Text>
            </View>
            <MaterialCommunityIcons name="clipboard-plus-outline" color="#38bdf8" size={23} />
          </View>
          <View style={styles.adminActionGrid}>
            <Pressable onPress={() => router.push("/new-task" as any)} style={styles.adminActionButton}>
              <MaterialCommunityIcons name="clipboard-plus-outline" color="white" size={20} />
              <Text style={styles.adminActionText}>Görev Oluştur</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {management ? (
        <View style={styles.statsGrid}>
          <StatCard label="Görev sayısı" value={String(stats.taskCount)} tone="blue" />
          <StatCard label="Sahadaki personel" value={String(stats.fieldPersonnelCount)} tone="green" />
          <StatCard
            label="Çalıştığı yer"
            value={workLocationTitle}
            helper={workLocationHelper}
            tone="cyan"
            wide
          />
        </View>
      ) : (
        <View style={styles.statsGrid}>
          <StatCard label="Çalıştığı yer" value={workLocationTitle} helper={workLocationHelper} tone="cyan" wide />
          <StatCard
            label="Aldığım görevler"
            value={String(stats.taskCount)}
            tone="blue"
            onPress={() =>
              router.push({
                pathname: "/my-tasks",
                params: { filter: "all" },
              } as any)
            }
          />
          <StatCard
            label="Tamamladığım görevler"
            value={String(stats.fieldPersonnelCount)}
            tone="green"
            onPress={() =>
              router.push({
                pathname: "/my-tasks",
                params: { filter: "completed" },
              } as any)
            }
          />
        </View>
      )}

      {!management ? <AssignedTaskCard task={latestAssignedTask} /> : null}

      <View style={styles.recentCard}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Son işlem özetleri</Text>
          {management ? (
            <Pressable onPress={() => router.push("/tasks" as any)} style={styles.textButton}>
              <Text style={styles.textButtonLabel}>Tümü</Text>
            </Pressable>
          ) : (
            <Text style={styles.sectionCount}>Bitmiş işler</Text>
          )}
        </View>

        {stats.recentItems.length ? (
          stats.recentItems.map((item) => <RecentItem key={String(item.id)} item={item} />)
        ) : (
          <View style={styles.emptyRecent}>
            <MaterialCommunityIcons name="timeline-clock-outline" color="#38bdf8" size={24} />
            <Text style={styles.emptyRecentText}>
              {management ? "Henüz işlem özeti bulunmuyor." : "Henüz tamamlanmış işlem bulunmuyor."}
            </Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

function StatCard({
  helper,
  label,
  onPress,
  value,
  tone,
  wide,
}: {
  helper?: string;
  label: string;
  onPress?: () => void;
  value: string;
  tone: "blue" | "green" | "cyan" | "amber";
  wide?: boolean;
}) {
  const color = {
    blue: "#60a5fa",
    green: "#22c55e",
    cyan: "#38bdf8",
    amber: "#f59e0b",
  }[tone];

  return (
    <Pressable onPress={onPress} style={[styles.statCard, wide && styles.statCardWide, onPress && styles.statCardPressable]}>
      <Text style={styles.statLabel}>{label}</Text>
      <View style={styles.statValueRow}>
        <Text style={[styles.statValue, wide && styles.statValueWide, { color }]} numberOfLines={wide ? 2 : 1}>
          {value}
        </Text>
        {onPress ? <MaterialCommunityIcons name="chevron-right" color="#64748b" size={22} /> : null}
      </View>
      {helper ? <Text style={styles.statHelper}>{helper}</Text> : null}
    </Pressable>
  );
}

function RecentItem({ item }: { item: RecentDashboardItem }) {
  const status = getTaskStatus(item);
  const title = item.producer_name || item.detected_crop || "Saha işlemi";
  const detail = [item.unit_no ? `Ünite ${item.unit_no}` : null, item.detected_crop].filter(Boolean).join(" - ");

  return (
    <Pressable onPress={() => router.push(`/task/${item.id}`)} style={styles.recentItem}>
      <View style={styles.recentIcon}>
        <MaterialCommunityIcons name="clipboard-text-clock-outline" color="#38bdf8" size={18} />
      </View>
      <View style={styles.recentBody}>
        <Text style={styles.recentTitle} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.recentDetail} numberOfLines={1}>
          {detail || "Denetim kaydı"}
        </Text>
      </View>
      <Text style={styles.recentStatus} numberOfLines={1}>
        {status}
      </Text>
    </Pressable>
  );
}

function AssignedTaskCard({ task }: { task: any | null }) {
  const workflowLabel = task ? workflowTypeLabels[getTaskWorkflowKind(task)] : "";

  return (
    <Pressable
      disabled={!task}
      onPress={() => {
        if (!task) {
          return;
        }

        router.push(`/task/${String(task.id)}` as any);
      }}
      style={[styles.assignedCard, !task && styles.assignedCardEmpty]}
    >
      <View style={styles.assignedTop}>
        <View style={styles.assignedIcon}>
          <MaterialCommunityIcons
            name={task ? "map-marker-check-outline" : "clipboard-clock-outline"}
            color="#bbf7d0"
            size={22}
          />
        </View>
        <View style={styles.assignedBody}>
          <Text style={styles.assignedLabel}>Alınan son görev</Text>
          {task ? <Text style={styles.assignedType}>{workflowLabel}</Text> : null}
          <Text style={styles.assignedTitle}>{task?.unit_no || "Henüz alınan görev yok"}</Text>
          <Text style={styles.assignedMeta} numberOfLines={1}>
            {task ? `${task.producer_name || "-"} - ${task.ada_no || "-"}/${task.parcel_no || "-"}` : "Admin görev atadığında burada görünecek"}
          </Text>
        </View>
        {task ? <MaterialCommunityIcons name="chevron-right" color="#94a3b8" size={24} /> : null}
      </View>
      <Text style={styles.assignedHint}>
        {task ? "Detayı açmak ve saha işlemine geçmek için dokunun." : "Yeni görev geldiğinde kart detay ekranına yönlendirecek."}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#020617",
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 96,
    gap: 14,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
  },
  brand: {
    flex: 1,
  },
  kicker: {
    color: "#38bdf8",
    fontSize: 12,
    fontWeight: "800",
  },
  title: {
    color: "white",
    fontSize: 32,
    fontWeight: "800",
    marginTop: 2,
  },
  subtitle: {
    color: "#94a3b8",
    marginTop: 4,
    lineHeight: 19,
  },
  versionText: {
    color: "#64748b",
    fontSize: 11,
    fontWeight: "800",
    marginTop: 4,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#14532d",
    borderWidth: 1,
    borderColor: "#22c55e",
  },
  avatarText: {
    color: "#bbf7d0",
    fontWeight: "800",
  },
  operatorCard: {
    backgroundColor: "#0f172a",
    borderRadius: 8,
    padding: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    borderWidth: 1,
    borderColor: "#1e293b",
  },
  operatorInfo: {
    flex: 1,
  },
  operatorLabel: {
    color: "#94a3b8",
    fontSize: 12,
  },
  operatorName: {
    color: "white",
    fontSize: 17,
    fontWeight: "800",
    marginTop: 4,
  },
  operatorRole: {
    color: "#22c55e",
    marginTop: 4,
    fontWeight: "700",
  },
  operatorActions: {
    gap: 8,
  },
  smallButton: {
    width: 38,
    minHeight: 36,
    borderRadius: 8,
    backgroundColor: "#1e293b",
    alignItems: "center",
    justifyContent: "center",
  },
  logoutButton: {
    backgroundColor: "#991b1b",
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  statCard: {
    width: "48%",
    minHeight: 88,
    backgroundColor: "#0f172a",
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: "#1e293b",
  },
  statCardWide: {
    width: "100%",
    minHeight: 86,
  },
  statLabel: {
    color: "#94a3b8",
    fontWeight: "700",
  },
  statValue: {
    fontSize: 30,
    fontWeight: "800",
    marginTop: 8,
    fontVariant: ["tabular-nums"],
  },
  statValueWide: {
    fontSize: 24,
    lineHeight: 30,
  },
  statCardPressable: {
    borderColor: "#334155",
  },
  statValueRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  statHelper: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 2,
  },
  recentCard: {
    backgroundColor: "#0f172a",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#1e293b",
    padding: 14,
    gap: 10,
  },
  workflowPanel: {
    backgroundColor: "#0f172a",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#1e293b",
    padding: 14,
    gap: 12,
  },
  sectionHeaderText: {
    flex: 1,
  },
  adminActionGrid: {
    gap: 8,
  },
  adminActionButton: {
    minHeight: 50,
    borderRadius: 8,
    backgroundColor: "#16a34a",
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  adminActionText: {
    color: "white",
    fontWeight: "800",
  },
  assignedCard: {
    backgroundColor: "#0f172a",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#22c55e",
    padding: 14,
    gap: 10,
  },
  assignedCardEmpty: {
    borderColor: "#334155",
  },
  assignedTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  assignedIcon: {
    width: 42,
    height: 42,
    borderRadius: 8,
    backgroundColor: "#14532d",
    alignItems: "center",
    justifyContent: "center",
  },
  assignedBody: {
    flex: 1,
  },
  assignedLabel: {
    color: "#22c55e",
    fontSize: 12,
    fontWeight: "800",
  },
  assignedType: {
    alignSelf: "flex-start",
    marginTop: 5,
    borderRadius: 8,
    backgroundColor: "#1e293b",
    color: "#bfdbfe",
    fontSize: 11,
    fontWeight: "800",
    overflow: "hidden",
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  assignedTitle: {
    color: "white",
    fontSize: 18,
    fontWeight: "800",
    marginTop: 2,
  },
  assignedMeta: {
    color: "#94a3b8",
    marginTop: 3,
  },
  assignedHint: {
    color: "#cbd5e1",
    lineHeight: 18,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitle: {
    color: "white",
    fontSize: 18,
    fontWeight: "800",
  },
  sectionCount: {
    color: "#94a3b8",
    fontWeight: "700",
    fontSize: 12,
  },
  textButton: {
    minHeight: 34,
    paddingHorizontal: 10,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#111827",
  },
  textButtonLabel: {
    color: "#38bdf8",
    fontWeight: "800",
  },
  recentItem: {
    minHeight: 58,
    borderRadius: 8,
    backgroundColor: "#111827",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 10,
  },
  recentIcon: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#082f49",
  },
  recentBody: {
    flex: 1,
  },
  recentTitle: {
    color: "white",
    fontWeight: "800",
  },
  recentDetail: {
    color: "#94a3b8",
    marginTop: 3,
    fontSize: 12,
  },
  recentStatus: {
    maxWidth: 90,
    color: "#22c55e",
    fontWeight: "800",
    fontSize: 12,
  },
  emptyRecent: {
    minHeight: 76,
    borderRadius: 8,
    backgroundColor: "#111827",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  emptyRecentText: {
    color: "#94a3b8",
    fontWeight: "700",
  },
});
