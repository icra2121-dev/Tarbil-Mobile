import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system/legacy";
import { router, useFocusEffect } from "expo-router";
import * as Sharing from "expo-sharing";
import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { RoleGate } from "../../components/RoleGate";
import { exportTaskPdf } from "../../services/pdfExport";
import { getTasks } from "../../services/tasks";
import { hasReportOutput, isTaskCancelled, isTaskCompleted } from "../../services/workflowGuard";

type DateFilter = "all" | "today" | "week" | "month" | "currentMonth" | "range";

const dateFilterOptions: { label: string; value: DateFilter }[] = [
  { label: "Tüm tarihler", value: "all" },
  { label: "Bugün", value: "today" },
  { label: "Son 7 gün", value: "week" },
  { label: "Son 30 gün", value: "month" },
  { label: "Bu ay", value: "currentMonth" },
  { label: "Tarih aralığı", value: "range" },
];

export default function ReportsTab() {
  return (
    <RoleGate>
      <ReportsContent />
    </RoleGate>
  );
}

function ReportsContent() {
  const [reportTasks, setReportTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [creatingTaskId, setCreatingTaskId] = useState("");
  const [exportingTaskId, setExportingTaskId] = useState("");
  const [producerFilter, setProducerFilter] = useState("");
  const [parcelFilter, setParcelFilter] = useState("");
  const [unitFilter, setUnitFilter] = useState("");
  const [cityFilter, setCityFilter] = useState("");
  const [districtFilter, setDistrictFilter] = useState("");
  const [villageFilter, setVillageFilter] = useState("");
  const [cropFilter, setCropFilter] = useState("");
  const [productionYearFilter, setProductionYearFilter] = useState("");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [dateStartFilter, setDateStartFilter] = useState("");
  const [dateEndFilter, setDateEndFilter] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const reportedTasksCount = useMemo(() => reportTasks.filter(hasReportOutput).length, [reportTasks]);

  const filteredTasks = useMemo(() => {
    const producerNeedle = normalizeFilterText(producerFilter);
    const parcelNeedle = normalizeFilterText(parcelFilter);
    const unitNeedle = normalizeFilterText(unitFilter);
    const cityNeedle = normalizeFilterText(cityFilter);
    const districtNeedle = normalizeFilterText(districtFilter);
    const villageNeedle = normalizeFilterText(villageFilter);
    const cropNeedle = normalizeFilterText(cropFilter);
    const productionYearNeedle = normalizeFilterText(productionYearFilter);

    return reportTasks.filter((task) => {
      const producer = normalizeFilterText(task.producer_name);
      const parcel = normalizeFilterText(`${task.ada_no || ""} ${task.parcel_no || ""} ${task.ada_no || ""}/${task.parcel_no || ""}`);
      const unit = normalizeFilterText(task.unit_no);
      const city = normalizeFilterText(task.city || task.province || task.il);
      const district = normalizeFilterText(task.district || task.district_name || task.ilce);
      const village = normalizeFilterText(task.village || task.neighborhood || task.mahalle);
      const crop = normalizeFilterText(task.detected_crop || task.crop_name || task.crop);
      const productionYear = normalizeFilterText(task.production_year || task.productionYear || getYearFromDate(task.created_at));

      return (
        (!producerNeedle || producer.includes(producerNeedle)) &&
        (!parcelNeedle || parcel.includes(parcelNeedle)) &&
        (!unitNeedle || unit.includes(unitNeedle)) &&
        (!cityNeedle || city.includes(cityNeedle)) &&
        (!districtNeedle || district.includes(districtNeedle)) &&
        (!villageNeedle || village.includes(villageNeedle)) &&
        (!cropNeedle || crop.includes(cropNeedle)) &&
        (!productionYearNeedle || productionYear.includes(productionYearNeedle)) &&
        matchesDateFilter(task.updated_at || task.created_at, dateFilter, dateStartFilter, dateEndFilter)
      );
    });
  }, [
    cityFilter,
    cropFilter,
    dateEndFilter,
    dateFilter,
    dateStartFilter,
    districtFilter,
    parcelFilter,
    producerFilter,
    productionYearFilter,
    reportTasks,
    unitFilter,
    villageFilter,
  ]);

  const activeFilterCount = [
    cityFilter.trim(),
    districtFilter.trim(),
    villageFilter.trim(),
    cropFilter.trim(),
    productionYearFilter.trim(),
    producerFilter.trim(),
    parcelFilter.trim(),
    unitFilter.trim(),
    dateFilter !== "all" || dateStartFilter.trim() || dateEndFilter.trim() ? dateFilter : "",
  ].filter(Boolean).length;
  const filtersActive = activeFilterCount > 0;
  const dateFilterLabel =
    dateFilter === "range" && (dateStartFilter.trim() || dateEndFilter.trim())
      ? `${dateStartFilter.trim() || "Başlangıç"} - ${dateEndFilter.trim() || "Bitiş"}`
      : dateFilterOptions.find((item) => item.value === dateFilter)?.label || "Tüm tarihler";

  function clearFilters() {
    setCityFilter("");
    setDistrictFilter("");
    setVillageFilter("");
    setCropFilter("");
    setProductionYearFilter("");
    setProducerFilter("");
    setParcelFilter("");
    setUnitFilter("");
    setDateFilter("all");
    setDateStartFilter("");
    setDateEndFilter("");
  }

  useFocusEffect(
    useCallback(() => {
      let active = true;

      setLoading(true);
      getTasks()
        .then((taskResult) => {
          if (!active) {
            return;
          }

          setReportTasks((taskResult.data || []).filter((task: any) => isTaskCompleted(task) && !isTaskCancelled(task)));
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

  async function createReportFromTask(task: any) {
    const taskId = String(task?.id || "");

    setCreatingTaskId(taskId);

    try {
      const { saved } = await exportTaskPdf(task);

      if (!saved) {
        Alert.alert(
          "Rapor kaydı yazılamadı",
          "PDF hazırlandı ancak rapor kaydı sunucuya yazılamadı; listede görünmeyebilir. İnternet bağlantınızı kontrol edin.",
        );
      }
    } catch (error: any) {
      Alert.alert("PDF oluşturulamadı", error?.message || "Ek-8 çıktısı alınamadı.");
    } finally {
      setCreatingTaskId("");
    }
  }

  async function shareTaskExcel(task: any) {
    const taskId = String(task?.id || "");

    setExportingTaskId(taskId);

    try {
      const csv = buildTasksCsv([task]);
      const uri = `${FileSystem.cacheDirectory}kobuds-denetim-${task.unit_no || taskId || Date.now()}.csv`;

      await FileSystem.writeAsStringAsync(uri, csv, { encoding: FileSystem.EncodingType.UTF8 });
      await Sharing.shareAsync(uri, {
        mimeType: "text/csv",
        dialogTitle: "KOBÜDS Excel çıktısı",
      });
    } catch (error: any) {
      Alert.alert("Excel oluşturulamadı", error?.message || "Excel çıktısı alınamadı.");
    } finally {
      setExportingTaskId("");
    }
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic">
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.kicker}>Ek-8 ve saha çıktıları</Text>
          <Text style={styles.title}>Raporlar</Text>
          <Text style={styles.subtitle}>CBS üzerinden oluşturulan raporlar burada listelenir ve PDF çıktısı alınır.</Text>
        </View>
        <View style={styles.headerIcon}>
          <MaterialCommunityIcons name="file-document-outline" color="#bbf7d0" size={24} />
        </View>
      </View>

      <View style={styles.summaryCard}>
        <View>
          <Text style={styles.summaryLabel}>Oluşturulan rapor</Text>
          <Text style={styles.summaryValue}>{reportedTasksCount}</Text>
        </View>
        <Text style={styles.summaryMeta}>{reportTasks.length} tamamlanmış denetim sonucu</Text>
      </View>

      <View style={styles.filterWrap}>
        <Pressable onPress={() => setFiltersOpen((value) => !value)} style={styles.filterButton}>
          <View style={styles.filterButtonLeft}>
            <MaterialCommunityIcons name="filter-variant" color="#38bdf8" size={20} />
            <View>
              <Text style={styles.filterButtonTitle}>Filtreler</Text>
              <Text style={styles.filterButtonMeta}>
                {filtersActive ? `${activeFilterCount} aktif · ${dateFilterLabel}` : "İl, ilçe, mahalle, ürün ve üretim yılı"}
              </Text>
            </View>
          </View>
          <MaterialCommunityIcons name={filtersOpen ? "chevron-up" : "chevron-down"} color="#cbd5e1" size={22} />
        </Pressable>

        {filtersOpen ? (
          <View style={styles.filterDropdown}>
            <View style={styles.filterHeader}>
              <Text style={styles.filterTitle}>Rapor filtreleri</Text>
              {filtersActive ? (
                <Pressable onPress={clearFilters} style={styles.clearFilterButton}>
                  <Text style={styles.clearFilterText}>Temizle</Text>
                </Pressable>
              ) : null}
            </View>
            <TextInput
              value={producerFilter}
              onChangeText={setProducerFilter}
              placeholder="Üreticiye göre filtrele"
              placeholderTextColor="#64748b"
              style={styles.filterInput}
            />
            <TextInput
              value={parcelFilter}
              onChangeText={setParcelFilter}
              placeholder="Ada / parsele göre filtrele"
              placeholderTextColor="#64748b"
              style={styles.filterInput}
            />
            <TextInput
              value={unitFilter}
              onChangeText={setUnitFilter}
              placeholder="Ünite noya göre filtrele"
              placeholderTextColor="#64748b"
              style={styles.filterInput}
            />
            <TextInput
              value={cityFilter}
              onChangeText={setCityFilter}
              placeholder="İle göre filtrele"
              placeholderTextColor="#64748b"
              style={styles.filterInput}
            />
            <TextInput
              value={districtFilter}
              onChangeText={setDistrictFilter}
              placeholder="İlçeye göre filtrele"
              placeholderTextColor="#64748b"
              style={styles.filterInput}
            />
            <TextInput
              value={villageFilter}
              onChangeText={setVillageFilter}
              placeholder="Mahalleye göre filtrele"
              placeholderTextColor="#64748b"
              style={styles.filterInput}
            />
            <TextInput
              value={cropFilter}
              onChangeText={setCropFilter}
              placeholder="Ürüne göre filtrele"
              placeholderTextColor="#64748b"
              style={styles.filterInput}
            />
            <TextInput
              value={productionYearFilter}
              onChangeText={setProductionYearFilter}
              placeholder="Üretim yılına göre filtrele"
              placeholderTextColor="#64748b"
              style={styles.filterInput}
            />
            <View style={styles.dateFilterGroup}>
              <Text style={styles.dateFilterTitle}>Tarih</Text>
              {dateFilterOptions.map((item) => {
                const selected = item.value === dateFilter;

                return (
                  <Pressable
                    key={item.value}
                    onPress={() => {
                      setDateFilter(item.value);
                      if (item.value !== "range") {
                        setDateStartFilter("");
                        setDateEndFilter("");
                      }
                    }}
                    style={[styles.dateFilterOption, selected && styles.dateFilterOptionActive]}
                  >
                    <Text style={[styles.dateFilterText, selected && styles.dateFilterTextActive]}>{item.label}</Text>
                    {selected ? <MaterialCommunityIcons name="check" color="#bbf7d0" size={18} /> : null}
                  </Pressable>
                );
              })}
              {dateFilter === "range" ? (
                <View style={styles.dateRangeFields}>
                  <TextInput
                    value={dateStartFilter}
                    onChangeText={setDateStartFilter}
                    placeholder="Başlangıç (GG.AA.YYYY)"
                    placeholderTextColor="#64748b"
                    keyboardType="numbers-and-punctuation"
                    style={styles.filterInput}
                  />
                  <TextInput
                    value={dateEndFilter}
                    onChangeText={setDateEndFilter}
                    placeholder="Bitiş (GG.AA.YYYY)"
                    placeholderTextColor="#64748b"
                    keyboardType="numbers-and-punctuation"
                    style={styles.filterInput}
                  />
                </View>
              ) : null}
            </View>
          </View>
        ) : null}
      </View>

      <View style={styles.sectionHeader}>
        <View>
          <Text style={styles.sectionTitle}>Denetim sonuçları</Text>
          <Text style={styles.sectionMeta}>
            {filtersActive ? `${filteredTasks.length} sonuç (filtrelendi)` : `${filteredTasks.length} tamamlanmış denetim`}
          </Text>
        </View>
        <Pressable onPress={() => router.push("/cbs" as any)} style={styles.textButton}>
          <Text style={styles.textButtonText}>CBS</Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.loadingCard}>
          <ActivityIndicator color="#22c55e" />
        </View>
      ) : filteredTasks.length ? (
        filteredTasks.map((task) => (
          <View key={String(task.id)} style={styles.reportCard}>
            <View style={styles.reportTop}>
              <View style={styles.reportTitleWrap}>
                <Text style={styles.reportTitle}>{task.unit_no || "Ünite"}</Text>
                <Text style={styles.reportMeta}>{task.producer_name || "Üretici bilgisi yok"}</Text>
              </View>
              <Text style={styles.reportDate}>{formatDate(task.updated_at || task.created_at)}</Text>
            </View>

            <View style={styles.reportGrid}>
              <MiniInfo label="Ada / Parsel" value={`${task.ada_no || "-"} / ${task.parcel_no || "-"}`} />
              <MiniInfo label="Ürün" value={task.detected_crop || "-"} />
            </View>

            <View style={styles.reportActionGrid}>
              <Pressable
                onPress={() => createReportFromTask(task)}
                style={[styles.primaryButton, creatingTaskId === String(task.id) && styles.dimmedButton]}
                disabled={creatingTaskId === String(task.id)}
              >
                <MaterialCommunityIcons name="file-pdf-box" color="white" size={18} />
                <Text style={styles.primaryButtonText}>{creatingTaskId === String(task.id) ? "Hazırlanıyor..." : "PDF Al"}</Text>
              </Pressable>
              <Pressable
                onPress={() => shareTaskExcel(task)}
                style={[styles.excelButton, exportingTaskId === String(task.id) && styles.dimmedButton]}
                disabled={exportingTaskId === String(task.id)}
              >
                <MaterialCommunityIcons name="microsoft-excel" color="white" size={18} />
                <Text style={styles.primaryButtonText}>{exportingTaskId === String(task.id) ? "Hazırlanıyor..." : "Excel Al"}</Text>
              </Pressable>
            </View>
          </View>
        ))
      ) : (
        <View style={styles.emptyCard}>
          <MaterialCommunityIcons name="file-search-outline" color="#38bdf8" size={28} />
          <Text style={styles.emptyTitle}>{filtersActive ? "Filtreye uygun denetim sonucu yok" : "Henüz tamamlanmış denetim yok"}</Text>
          <Text style={styles.emptyText}>
            {filtersActive
              ? "İl, ilçe, mahalle, ürün, üretim yılı veya tarih filtresini değiştirin."
              : "Denetim kaydedildiğinde burada görünecek."}
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

function MiniInfo({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.miniInfo}>
      <Text style={styles.miniInfoLabel}>{label}</Text>
      <Text style={styles.miniInfoValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function normalizeFilterText(value: unknown) {
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

function getYearFromDate(value: string | undefined) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? "" : String(date.getFullYear());
}

function csvCell(value: unknown) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function buildTasksCsv(tasks: any[]) {
  const headers = ["İl", "İlçe", "Mahalle", "Ürün", "Üretim yılı", "Ünite no", "Üretici", "Ada", "Parsel", "Tarih"];
  const rows = tasks.map((task) => [
    task.city || task.province || task.il || "",
    task.district_name || task.district || task.ilce || "",
    task.village || task.neighborhood || task.mahalle || "",
    task.detected_crop || task.crop_name || task.crop || "",
    task.production_year || task.productionYear || getYearFromDate(task.created_at),
    task.unit_no || "",
    task.producer_name || "",
    task.ada_no || "",
    task.parcel_no || "",
    task.updated_at || task.created_at ? formatDate(task.updated_at || task.created_at) : "",
  ]);

  return `\ufeff${[headers, ...rows].map((row) => row.map(csvCell).join(";")).join("\n")}`;
}

function startOfDay(date: Date) {
  const nextDate = new Date(date);
  nextDate.setHours(0, 0, 0, 0);
  return nextDate;
}

function parseDateInput(value: string) {
  const text = value.trim();

  if (!text) {
    return null;
  }

  const isoMatch = text.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  const localMatch = text.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  const parts = isoMatch
    ? { year: Number(isoMatch[1]), month: Number(isoMatch[2]), day: Number(isoMatch[3]) }
    : localMatch
      ? { year: Number(localMatch[3]), month: Number(localMatch[2]), day: Number(localMatch[1]) }
      : null;

  if (!parts) {
    return null;
  }

  const parsed = new Date(parts.year, parts.month - 1, parts.day);

  if (
    parsed.getFullYear() !== parts.year ||
    parsed.getMonth() !== parts.month - 1 ||
    parsed.getDate() !== parts.day
  ) {
    return null;
  }

  return parsed;
}

function endOfDay(date: Date) {
  const nextDate = new Date(date);
  nextDate.setHours(23, 59, 59, 999);
  return nextDate;
}

function matchesDateFilter(value: string | undefined, filter: DateFilter, rangeStart: string, rangeEnd: string) {
  if (filter === "all") {
    return true;
  }

  if (!value) {
    return false;
  }

  const reportDate = new Date(value);

  if (Number.isNaN(reportDate.getTime())) {
    return false;
  }

  const now = new Date();
  const today = startOfDay(now);

  if (filter === "today") {
    return reportDate >= today;
  }

  if (filter === "week") {
    const weekStart = startOfDay(now);
    weekStart.setDate(weekStart.getDate() - 6);
    return reportDate >= weekStart;
  }

  if (filter === "month") {
    const monthStart = startOfDay(now);
    monthStart.setDate(monthStart.getDate() - 29);
    return reportDate >= monthStart;
  }

  if (filter === "range") {
    const start = parseDateInput(rangeStart);
    const end = parseDateInput(rangeEnd);

    if (!start && !end) {
      return true;
    }

    return (!start || reportDate >= startOfDay(start)) && (!end || reportDate <= endOfDay(end));
  }

  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  return reportDate >= currentMonthStart;
}

function formatDate(value?: string) {
  if (!value) return "-";

  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
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
    gap: 12,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 14,
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
    marginTop: 5,
    lineHeight: 19,
  },
  headerIcon: {
    width: 46,
    height: 46,
    borderRadius: 8,
    backgroundColor: "#14532d",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#22c55e",
  },
  summaryCard: {
    backgroundColor: "#0f172a",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#1e293b",
    padding: 16,
    gap: 14,
  },
  summaryLabel: {
    color: "#94a3b8",
    fontWeight: "700",
  },
  summaryValue: {
    color: "#22c55e",
    fontSize: 32,
    fontWeight: "800",
    marginTop: 4,
    fontVariant: ["tabular-nums"],
  },
  summaryMeta: {
    color: "#94a3b8",
    fontWeight: "700",
  },
  primaryButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 8,
    backgroundColor: "#16a34a",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  excelButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 8,
    backgroundColor: "#15803d",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  primaryButtonText: {
    color: "white",
    fontWeight: "800",
  },
  dimmedButton: {
    opacity: 0.72,
  },
  filterWrap: {
    gap: 8,
  },
  filterButton: {
    minHeight: 54,
    borderRadius: 8,
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "#1e293b",
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  filterButtonLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  filterButtonTitle: {
    color: "white",
    fontWeight: "800",
  },
  filterButtonMeta: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 2,
  },
  filterDropdown: {
    backgroundColor: "#0f172a",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#1e293b",
    padding: 12,
    gap: 10,
  },
  filterHeader: {
    minHeight: 32,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  filterTitle: {
    color: "white",
    fontSize: 16,
    fontWeight: "800",
  },
  clearFilterButton: {
    minHeight: 32,
    borderRadius: 8,
    backgroundColor: "#111827",
    borderWidth: 1,
    borderColor: "#1e293b",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  clearFilterText: {
    color: "#38bdf8",
    fontSize: 12,
    fontWeight: "800",
  },
  filterInput: {
    minHeight: 44,
    borderRadius: 8,
    backgroundColor: "#111827",
    borderWidth: 1,
    borderColor: "#1e293b",
    color: "white",
    paddingHorizontal: 12,
  },
  dateFilterGroup: {
    gap: 8,
  },
  dateRangeFields: {
    gap: 8,
  },
  dateFilterTitle: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: "800",
  },
  dateFilterOption: {
    minHeight: 40,
    borderRadius: 8,
    backgroundColor: "#111827",
    borderWidth: 1,
    borderColor: "#1e293b",
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  dateFilterOptionActive: {
    backgroundColor: "#14532d",
    borderColor: "#22c55e",
  },
  dateFilterText: {
    color: "#cbd5e1",
    fontWeight: "800",
  },
  dateFilterTextActive: {
    color: "white",
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
  sectionMeta: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 2,
  },
  textButton: {
    minHeight: 34,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: "#111827",
    alignItems: "center",
    justifyContent: "center",
  },
  textButtonText: {
    color: "#38bdf8",
    fontWeight: "800",
  },
  loadingCard: {
    minHeight: 88,
    borderRadius: 8,
    backgroundColor: "#0f172a",
    alignItems: "center",
    justifyContent: "center",
  },
  reportCard: {
    backgroundColor: "#0f172a",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#1e293b",
    padding: 14,
    gap: 12,
  },
  reportTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
  },
  reportTitleWrap: {
    flex: 1,
  },
  reportTitle: {
    color: "white",
    fontSize: 18,
    fontWeight: "800",
  },
  reportMeta: {
    color: "#94a3b8",
    marginTop: 3,
  },
  reportDate: {
    color: "#22c55e",
    fontWeight: "800",
    fontSize: 12,
  },
  reportGrid: {
    flexDirection: "row",
    gap: 8,
  },
  reportActionGrid: {
    flexDirection: "row",
    gap: 8,
  },
  miniInfo: {
    flex: 1,
    backgroundColor: "#111827",
    borderRadius: 8,
    padding: 10,
  },
  miniInfoLabel: {
    color: "#94a3b8",
    fontSize: 11,
    fontWeight: "700",
  },
  miniInfoValue: {
    color: "white",
    marginTop: 4,
    fontWeight: "800",
  },
  secondaryButton: {
    minHeight: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#38bdf8",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  secondaryButtonText: {
    color: "#38bdf8",
    fontWeight: "800",
  },
  emptyCard: {
    backgroundColor: "#0f172a",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#1e293b",
    padding: 16,
    gap: 8,
  },
  emptyTitle: {
    color: "white",
    fontWeight: "800",
  },
  emptyText: {
    color: "#94a3b8",
    lineHeight: 20,
  },
});
