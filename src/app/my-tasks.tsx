import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { BottomTabMenu } from "../components/BottomTabMenu";
import { getTasks } from "../services/tasks";
import { getTaskStatus, getTaskWorkflowKind, isTaskCancelled, isTaskCompleted } from "../services/workflowGuard";

const workflowTypeLabels = {
  inspection: "Başvurulu",
  detection: "Re'sen",
  classification: "Sınıflandırma",
};

export default function MyTasksScreen() {
  const params = useLocalSearchParams();
  const initialFilter = params.filter === "completed" ? "completed" : "all";
  const [filter, setFilter] = useState<"all" | "completed">(initialFilter);
  const [tasks, setTasks] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      setLoading(true);
      getTasks()
        .then((result) => {
          if (active) {
            setTasks((result.data || []).filter((task: any) => !isTaskCancelled(task)));
          }
        })
        .finally(() => {
          if (active) {
            setLoading(false);
          }
        });

      return () => {
        active = false;
      };
    }, []),
  );

  const filteredTasks = useMemo(() => {
    const byStatus = filter === "completed" ? tasks.filter(isTaskCompleted) : tasks;
    const needle = search.trim().toLocaleLowerCase("tr-TR");

    if (!needle) {
      return byStatus;
    }

    return byStatus.filter((task) =>
      [
        task.unit_no,
        task.producer_name,
        task.detected_crop,
        task.ada_no,
        task.parcel_no,
        task.village,
        task.district_name,
        task.workflow_status,
        task.status,
      ]
        .join(" ")
        .toLocaleLowerCase("tr-TR")
        .includes(needle),
    );
  }, [filter, search, tasks]);

  const completedCount = tasks.filter(isTaskCompleted).length;

  return (
    <View style={styles.root}>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic">
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <MaterialCommunityIcons name="arrow-left" color="white" size={21} />
        </Pressable>
        <View style={styles.headerText}>
          <Text style={styles.kicker}>Saha personeli</Text>
          <Text style={styles.title}>Görevlerim</Text>
          <Text style={styles.subtitle}>Size atanmış ve tamamladığınız denetim görevleri</Text>
        </View>
      </View>

      <View style={styles.segmentRow}>
        <SegmentButton active={filter === "all"} label="Aldığım" value={tasks.length} onPress={() => setFilter("all")} />
        <SegmentButton
          active={filter === "completed"}
          label="Tamamladığım"
          value={completedCount}
          onPress={() => setFilter("completed")}
        />
      </View>

      <TextInput
        value={search}
        onChangeText={setSearch}
        placeholder="Ünite, üretici, ürün veya ada/parsel ara"
        placeholderTextColor="#64748b"
        style={styles.search}
      />

      {loading ? (
        <View style={styles.centerCard}>
          <ActivityIndicator color="#22c55e" />
          <Text style={styles.centerText}>Görevler yükleniyor...</Text>
        </View>
      ) : null}

      {!loading && !filteredTasks.length ? (
        <View style={styles.centerCard}>
          <MaterialCommunityIcons name="clipboard-text-search-outline" color="#38bdf8" size={26} />
          <Text style={styles.emptyTitle}>Görev bulunamadı</Text>
          <Text style={styles.centerText}>
            {filter === "completed" ? "Henüz tamamladığınız görev yok." : "Size atanmış görev bulunmuyor."}
          </Text>
        </View>
      ) : null}

      {filteredTasks.map((task) => (
        <TaskCard key={String(task.id)} task={task} />
      ))}
      </ScrollView>
      <BottomTabMenu />
    </View>
  );
}

function SegmentButton({
  active,
  label,
  onPress,
  value,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
  value: number;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.segmentButton, active && styles.segmentButtonActive]}>
      <Text style={[styles.segmentLabel, active && styles.segmentLabelActive]}>{label}</Text>
      <Text style={[styles.segmentValue, active && styles.segmentValueActive]}>{value}</Text>
    </Pressable>
  );
}

function TaskCard({ task }: { task: any }) {
  const status = getTaskStatus(task);
  const completed = isTaskCompleted(task);
  const workflowLabel = workflowTypeLabels[getTaskWorkflowKind(task)];

  return (
    <Pressable onPress={() => router.push(`/task/${task.id}` as any)} style={styles.taskCard}>
      <View style={styles.cardHeader}>
        <View style={styles.cardTitleWrap}>
          <Text style={styles.workflowType}>{workflowLabel}</Text>
          <Text style={styles.taskTitle}>{task.unit_no || "Ünite"}</Text>
          <Text style={styles.taskSubtitle} numberOfLines={1}>
            {task.producer_name || "-"} · {task.detected_crop || "-"}
          </Text>
        </View>
        <View style={[styles.statusPill, completed ? styles.statusDone : styles.statusActive]}>
          <Text style={styles.statusText}>{status}</Text>
        </View>
      </View>

      <View style={styles.infoGrid}>
        <Info label="Ada / Parsel" value={`${task.ada_no || "-"} / ${task.parcel_no || "-"}`} />
        <Info label="Mahalle" value={task.village || "-"} />
        <Info label="İlçe" value={task.district_name || task.city || "-"} />
        <Info label="Sonuç" value={task.compliance_result || "Değerlendirme bekliyor"} />
      </View>
    </Pressable>
  );
}

function Info({ label, value }: { label: string; value: unknown }) {
  return (
    <View style={styles.infoItem}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue} numberOfLines={1}>
        {String(value || "-")}
      </Text>
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
    padding: 20,
    paddingBottom: 96,
    gap: 12,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  backButton: {
    width: 42,
    minHeight: 42,
    borderRadius: 8,
    backgroundColor: "#111827",
    borderWidth: 1,
    borderColor: "#1e293b",
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
  subtitle: {
    color: "#94a3b8",
    marginTop: 4,
  },
  segmentRow: {
    flexDirection: "row",
    gap: 8,
  },
  segmentButton: {
    flex: 1,
    minHeight: 58,
    borderRadius: 8,
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "#1e293b",
    padding: 12,
  },
  segmentButtonActive: {
    backgroundColor: "#14532d",
    borderColor: "#22c55e",
  },
  segmentLabel: {
    color: "#94a3b8",
    fontWeight: "800",
    fontSize: 12,
  },
  segmentLabelActive: {
    color: "#bbf7d0",
  },
  segmentValue: {
    color: "white",
    fontSize: 24,
    fontWeight: "800",
    marginTop: 4,
    fontVariant: ["tabular-nums"],
  },
  segmentValueActive: {
    color: "#22c55e",
  },
  search: {
    minHeight: 48,
    backgroundColor: "#0f172a",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#1e293b",
    color: "white",
    paddingHorizontal: 12,
  },
  centerCard: {
    minHeight: 96,
    borderRadius: 8,
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "#1e293b",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    gap: 8,
  },
  emptyTitle: {
    color: "white",
    fontWeight: "800",
  },
  centerText: {
    color: "#94a3b8",
    textAlign: "center",
    fontWeight: "700",
  },
  taskCard: {
    backgroundColor: "#0f172a",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#1e293b",
    padding: 14,
    gap: 12,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
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
  taskTitle: {
    color: "white",
    fontSize: 18,
    fontWeight: "800",
  },
  taskSubtitle: {
    color: "#94a3b8",
    marginTop: 4,
  },
  statusPill: {
    maxWidth: 118,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  statusActive: {
    backgroundColor: "#1d4ed8",
  },
  statusDone: {
    backgroundColor: "#166534",
  },
  statusText: {
    color: "white",
    fontSize: 11,
    fontWeight: "800",
  },
  infoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  infoItem: {
    width: "48%",
    borderRadius: 8,
    backgroundColor: "#111827",
    padding: 10,
  },
  infoLabel: {
    color: "#38bdf8",
    fontSize: 11,
    fontWeight: "800",
  },
  infoValue: {
    color: "#e2e8f0",
    marginTop: 4,
    fontWeight: "700",
  },
});
