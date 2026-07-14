import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Alert, FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { RoleGate } from "../../components/RoleGate";
import { getMyProfile } from "../../services/profile";
import { deleteTaskById, getTasks } from "../../services/tasks";
import { getTaskStatus, getTaskWorkflowKind, isTaskCancelled, isTaskCompleted, isTaskStarted } from "../../services/workflowGuard";

const STATUS_COLOR: Record<string, string> = {
  "İhlal": "#dc2626",
  "Doğrulandı": "#16a34a",
  "Sahada": "#f59e0b",
  "Sahaya Atandı": "#2563eb",
  "Bekliyor": "#475569",
  "Ürün Doğrulandı": "#0ea5e9",
  "Denetim Tamamlandı": "#16a34a",
  "Rapor Oluşturuldu": "#16a34a",
  "KOBÜKS'e Aktarıldı": "#0f766e",
  "Tamamlandı": "#16a34a",
  "İptal Edildi": "#991b1b",
};

const FILTERS = [
  { key: "all", label: "Tümü" },
  { key: "pending", label: "Atama" },
  { key: "field", label: "Sahada" },
  { key: "done", label: "Tamamlanan" },
];

const workflowTypeLabels = {
  inspection: "Başvurulu",
  detection: "Re'sen",
  classification: "Sınıflandırma",
};

function getStatusGroup(task: any) {
  if (isTaskCompleted(task) || isTaskCancelled(task)) {
    return "done";
  }

  if (isTaskStarted(task)) {
    return "field";
  }

  return "pending";
}

function getAssigneeName(task: any) {
  if (task?.assigned_name) {
    return String(task.assigned_name);
  }

  if (task?.assigned_to) {
    return "Kayıtlı kullanıcı";
  }

  return "Atanmadı";
}

export default function TasksScreen() {
  return (
    <RoleGate adminOnly>
      <TasksContent />
    </RoleGate>
  );
}

function TasksContent() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [profile, setProfile] = useState<any>(null);
  const [deletingId, setDeletingId] = useState("");

  useFocusEffect(
    useCallback(() => {
      let active = true;

      Promise.all([getTasks(), getMyProfile().catch(() => null)]).then(([result, profileResult]) => {
        if (!active) {
          return;
        }

        setTasks(result.data || []);
        setProfile(profileResult);
      });

      return () => {
        active = false;
      };
    }, []),
  );

  const filteredTasks = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase("tr-TR");

    return tasks.filter((item) => {
      const matchesStatus = statusFilter === "all" || getStatusGroup(item) === statusFilter;

      if (!matchesStatus) {
        return false;
      }

      if (!needle) {
        return true;
      }

      return [
        item.detected_crop,
        item.producer_name,
        item.assigned_name,
        item.village,
        item.district_name,
        item.ada_no,
        item.parcel_no,
        item.unit_no,
        item.workflow_status,
        item.status,
        item.compliance_result,
      ]
        .join(" ")
        .toLocaleLowerCase("tr-TR")
        .includes(needle);
    });
  }, [search, statusFilter, tasks]);

  function deleteCancelledTask(task: any) {
    const taskId = String(task?.id || "");

    Alert.alert("Denetimi sil", "İptal edilen denetim kalıcı olarak silinecek.", [
      {
        text: "Vazgeç",
        style: "cancel",
      },
      {
        text: "Sil",
        style: "destructive",
        onPress: async () => {
          setDeletingId(taskId);

          try {
            await deleteTaskById(taskId);
            setTasks((current) => current.filter((item) => String(item.id) !== taskId));
            Alert.alert("Silindi", "İptal edilen denetim silindi.");
          } catch (error: any) {
            Alert.alert("Silinemedi", error?.message || "Denetim silinemedi.");
          } finally {
            setDeletingId("");
          }
        },
      },
    ]);
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.kicker}>Yönetim</Text>
          <Text style={styles.title}>Denetimler</Text>
          <Text style={styles.subtitle}>CBS üzerinden açılan görevleri izleyin ve denetçi atamalarını yönetin.</Text>
        </View>
        <Text style={styles.headerBadge} numberOfLines={1}>
          {profile?.title || profile?.role || "admin"}
        </Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
        {FILTERS.map((item) => (
          <Pressable
            key={item.key}
            onPress={() => setStatusFilter(item.key)}
            style={[styles.filterChip, statusFilter === item.key && styles.filterChipActive]}
          >
            <Text style={[styles.filterText, statusFilter === item.key && styles.filterTextActive]}>{item.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <TextInput
        placeholder="Ürün, üretici, denetçi, ünite veya ada/parsel ara"
        placeholderTextColor="#64748b"
        value={search}
        onChangeText={setSearch}
        style={styles.search}
      />

      <FlatList
        data={filteredTasks}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            <MaterialCommunityIcons name="clipboard-search-outline" color="#38bdf8" size={26} />
            <Text style={styles.emptyTitle}>Denetim bulunamadı</Text>
            <Text style={styles.emptyText}>Filtreyi değiştirin veya CBS haritasından bir ünite seçin.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TaskCard task={item} deleting={deletingId === String(item.id)} onDelete={deleteCancelledTask} />
        )}
      />
    </View>
  );
}

function TaskCard({
  task,
  deleting,
  onDelete,
}: {
  task: any;
  deleting: boolean;
  onDelete: (task: any) => void;
}) {
  const status = getTaskStatus(task);
  const workflowLabel = workflowTypeLabels[getTaskWorkflowKind(task)];
  const district = [task.district_name, task.village].filter(Boolean).join(" / ") || "-";
  const parcel = [task.ada_no, task.parcel_no].filter(Boolean).join("/") || "-";

  return (
    <Pressable onPress={() => router.push(`/task/${task.id}` as any)} style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardTitleWrap}>
          <Text style={styles.workflowType}>{workflowLabel}</Text>
          <Text style={styles.crop} numberOfLines={1}>
            {task.detected_crop || "Denetim"}
          </Text>
          <Text style={styles.meta} numberOfLines={1}>
            Ünite {task.unit_no || "-"} · {parcel}
          </Text>
        </View>
        <Text style={[styles.status, { backgroundColor: STATUS_COLOR[status] || "#2563eb" }]} numberOfLines={1}>
          {status}
        </Text>
      </View>

      <View style={styles.detailRow}>
        <MaterialCommunityIcons name="account-outline" color="#38bdf8" size={17} />
        <Text style={styles.detailText} numberOfLines={1}>
          Üretici: {task.producer_name || "-"}
        </Text>
      </View>
      <View style={styles.detailRow}>
        <MaterialCommunityIcons name="account-check-outline" color="#22c55e" size={17} />
        <Text style={styles.detailText} numberOfLines={1}>
          Atanan: {getAssigneeName(task)}
        </Text>
      </View>
      <View style={styles.detailRow}>
        <MaterialCommunityIcons name="map-marker-radius-outline" color="#f59e0b" size={17} />
        <Text style={styles.detailText} numberOfLines={1}>
          {district}
        </Text>
      </View>

      {task.compliance_result ? (
        <View style={styles.resultRow}>
          <Text style={styles.resultLabel}>Sonuç</Text>
          <Text style={styles.resultValue} numberOfLines={2}>
            {task.compliance_result}
          </Text>
        </View>
      ) : null}

      {isTaskCancelled(task) ? (
        <Pressable
          onPress={(event) => {
            event.stopPropagation();
            onDelete(task);
          }}
          style={[styles.deleteButton, deleting && styles.dimmedButton]}
          disabled={deleting}
        >
          <MaterialCommunityIcons name="trash-can-outline" color="white" size={18} />
          <Text style={styles.deleteButtonText}>{deleting ? "Siliniyor..." : "Sil"}</Text>
        </Pressable>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#020617",
    padding: 20,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 10,
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
    fontSize: 30,
    fontWeight: "800",
    marginTop: 2,
  },
  subtitle: {
    color: "#94a3b8",
    marginTop: 4,
    lineHeight: 19,
  },
  headerBadge: {
    maxWidth: 110,
    minHeight: 40,
    borderRadius: 8,
    backgroundColor: "#1e293b",
    color: "#cbd5e1",
    paddingHorizontal: 10,
    paddingVertical: 10,
    fontWeight: "800",
    textAlign: "center",
    overflow: "hidden",
  },
  filterRow: {
    gap: 8,
    paddingBottom: 12,
  },
  filterChip: {
    minHeight: 38,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#1e293b",
    backgroundColor: "#0f172a",
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  filterChipActive: {
    borderColor: "#22c55e",
    backgroundColor: "#14532d",
  },
  filterText: {
    color: "#94a3b8",
    fontWeight: "800",
  },
  filterTextActive: {
    color: "white",
  },
  search: {
    backgroundColor: "#0f172a",
    color: "white",
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#1e293b",
    marginBottom: 14,
  },
  listContent: {
    paddingBottom: 92,
  },
  card: {
    backgroundColor: "#0f172a",
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#1e293b",
    gap: 9,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
  },
  cardTitleWrap: {
    flex: 1,
  },
  workflowType: {
    alignSelf: "flex-start",
    marginBottom: 6,
    borderRadius: 8,
    backgroundColor: "#1e293b",
    color: "#bfdbfe",
    fontSize: 11,
    fontWeight: "800",
    overflow: "hidden",
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  crop: {
    color: "white",
    fontSize: 18,
    fontWeight: "800",
  },
  meta: {
    color: "#94a3b8",
    marginTop: 4,
    fontWeight: "700",
  },
  status: {
    maxWidth: 120,
    color: "white",
    overflow: "hidden",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    fontWeight: "800",
    alignSelf: "flex-start",
    fontSize: 12,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  detailText: {
    flex: 1,
    color: "#cbd5e1",
    fontWeight: "700",
  },
  resultRow: {
    marginTop: 4,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#1e293b",
  },
  resultLabel: {
    color: "#38bdf8",
    fontWeight: "800",
    fontSize: 12,
  },
  resultValue: {
    color: "white",
    marginTop: 3,
    fontWeight: "700",
    lineHeight: 18,
  },
  deleteButton: {
    minHeight: 42,
    borderRadius: 8,
    backgroundColor: "#991b1b",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 7,
  },
  deleteButtonText: {
    color: "white",
    fontWeight: "800",
  },
  dimmedButton: {
    opacity: 0.75,
  },
  emptyCard: {
    backgroundColor: "#0f172a",
    borderRadius: 8,
    padding: 18,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#1e293b",
    gap: 6,
  },
  emptyTitle: {
    color: "white",
    fontWeight: "800",
  },
  emptyText: {
    color: "#94a3b8",
    textAlign: "center",
  },
});
