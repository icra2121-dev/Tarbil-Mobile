import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { RoleGate } from "../../components/RoleGate";
import { KobuksUnitRecord, searchKobuksUnits } from "../../services/kobuks";

export default function KobuksScreen() {
  return (
    <RoleGate adminOnly>
      <KobuksContent />
    </RoleGate>
  );
}

function KobuksContent() {
  const params = useLocalSearchParams<{ workflow?: string; mode?: string }>();
  const workflow = String(params.workflow || "inspection");
  const mode = String(params.mode || "units");
  const [query, setQuery] = useState("");
  const [units, setUnits] = useState<KobuksUnitRecord[]>([]);
  const [loading, setLoading] = useState(false);

  const parcelSummary = useMemo(() => {
    const first = units[0];
    return {
      adaNo: first?.ada_no || "-",
      parcelNo: first?.parcel_no || "-",
      producers: new Set(units.map((unit) => unit.tc_no || unit.producer_name).filter(Boolean)).size,
      crops: Array.from(new Set(units.map((unit) => unit.detected_crop).filter(Boolean))).join(", ") || "-",
    };
  }, [units]);

  async function searchUnits() {
    const normalized = query.trim();

    if (!normalized) {
      Alert.alert("Sorgu gerekli", "Ünite no, ada/parsel veya parsel numarası girin.");
      return;
    }

    setLoading(true);

    try {
      const result = await searchKobuksUnits(normalized);
      setUnits(result);

      if (!result.length) {
        Alert.alert("Kayıt bulunamadı", "Bu sorgu için KOBÜKS ünitesi bulunamadı.");
      }
    } catch (error: any) {
      setUnits([]);
      Alert.alert("Sorgu başarısız", error?.message || "KOBÜKS verisi alınamadı.");
    } finally {
      setLoading(false);
    }
  }

  function openInCbs(unit: KobuksUnitRecord) {
    router.push({
      pathname: "/cbs",
      params: {
        workflow,
        unit_no: unit.unit_no,
        ada_no: unit.ada_no,
        parcel_no: unit.parcel_no,
      },
    } as any);
  }

  function openTaskForm(unit: KobuksUnitRecord) {
    router.push({
      pathname: "/new-task",
      params: {
        workflow,
        tc_no: unit.tc_no || "",
        producer_name: unit.producer_name || "",
        phone: unit.phone || "",
        city: unit.city || "",
        district_name: unit.district_name || "",
        village: unit.village || "",
        ada_no: unit.ada_no || "",
        parcel_no: unit.parcel_no || "",
        detected_crop: unit.detected_crop || "",
        unit_no: unit.unit_no || "",
        greenhouse_area: unit.greenhouse_area || "",
        latitude: unit.latitude ? String(unit.latitude) : "",
        longitude: unit.longitude ? String(unit.longitude) : "",
        parcel_polygon: unit.parcel_polygon ? JSON.stringify(unit.parcel_polygon) : "",
        greenhouse_polygon: unit.greenhouse_polygon ? JSON.stringify(unit.greenhouse_polygon) : "",
      },
    } as any);
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.kicker}>Kurumsal KOBÜKS doğrulama</Text>
          <Text style={styles.title}>{mode === "identity" ? "TC/VKN Sorgusu" : "KOBÜKS Üniteleri"}</Text>
        </View>
        <View style={styles.iconBadge}>
          <MaterialCommunityIcons name="greenhouse" color="#bbf7d0" size={24} />
        </View>
      </View>

      <View style={styles.searchCard}>
        <View style={styles.searchLabelRow}>
          <Text style={styles.label}>Sorgu bilgisi</Text>
          <Text style={styles.hint}>Örn. 221/19, 19 veya KU-2026-0001</Text>
        </View>
        <View style={styles.searchRow}>
          <TextInput
              value={query}
              onChangeText={setQuery}
            placeholder={mode === "identity" ? "TC/VKN" : "Ada/parsel veya ünite no"}
            placeholderTextColor="#64748b"
            autoCapitalize="characters"
            returnKeyType="search"
            onSubmitEditing={searchUnits}
            style={styles.input}
          />
          <Pressable onPress={searchUnits} style={styles.searchButton} disabled={loading}>
            {loading ? (
              <ActivityIndicator color="white" />
            ) : (
              <MaterialCommunityIcons name="magnify" color="white" size={22} />
            )}
          </Pressable>
        </View>
      </View>

      {units.length ? (
        <View style={styles.summaryCard}>
          <View>
            <Text style={styles.summaryLabel}>Parsel</Text>
            <Text style={styles.summaryValue}>
              Ada {parcelSummary.adaNo} / Parsel {parcelSummary.parcelNo}
            </Text>
          </View>
          <View style={styles.summaryGrid}>
            <SummaryItem label="Ünite" value={String(units.length)} />
            <SummaryItem label="Üretici" value={String(parcelSummary.producers)} />
            <SummaryItem label="Ürün" value={parcelSummary.crops} wide />
          </View>
        </View>
      ) : null}

      <View style={styles.resultHeader}>
        <Text style={styles.sectionTitle}>Sorgu sonuçları</Text>
        <Text style={styles.resultCount}>{units.length} kayıt</Text>
      </View>

      {units.length ? (
        units.map((unit, index) => (
          <View key={`${unit.unit_no || "unit"}-${unit.tc_no || index}`} style={styles.unitCard}>
            <View style={styles.unitTop}>
              <View style={styles.unitTitleWrap}>
                <Text style={styles.unitNo}>{unit.unit_no || "Ünite no yok"}</Text>
                <Text style={styles.producer}>{unit.producer_name || "-"}</Text>
              </View>
              <Text style={styles.status}>{unit.registration_status || "Aktif"}</Text>
            </View>

            <View style={styles.grid}>
              <Info label="TC/VKN" value={unit.tc_no} />
              <Info label="İl / İlçe" value={`${unit.city || "-"} / ${unit.district_name || "-"}`} />
              <Info label="Mahalle" value={unit.village} />
              <Info label="Ada / Parsel" value={`${unit.ada_no || "-"} / ${unit.parcel_no || "-"}`} />
              <Info label="Ürün" value={unit.detected_crop} />
              <Info label="Kapalı alan" value={`${unit.greenhouse_area || "-"} m²`} />
            </View>

            <View style={styles.actions}>
              <Pressable onPress={() => openInCbs(unit)} style={styles.secondaryButton}>
                <MaterialCommunityIcons name="map-search-outline" color="#38bdf8" size={18} />
                <Text style={styles.secondaryButtonText}>CBS</Text>
              </Pressable>
              <Pressable onPress={() => openTaskForm(unit)} style={styles.createButton}>
                <MaterialCommunityIcons name="clipboard-plus-outline" color="white" size={18} />
                <Text style={styles.createButtonText}>Görev Aç</Text>
              </Pressable>
            </View>
          </View>
        ))
      ) : (
        <View style={styles.emptyCard}>
          <MaterialCommunityIcons name="database-search-outline" color="#38bdf8" size={28} />
          <Text style={styles.emptyTitle}>Henüz sonuç yok</Text>
        </View>
      )}
    </ScrollView>
  );
}

function SummaryItem({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <View style={[styles.summaryItem, wide && styles.summaryItemWide]}>
      <Text style={styles.summaryItemLabel}>{label}</Text>
      <Text style={styles.summaryItemValue} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

function Info({ label, value }: { label: string; value: unknown }) {
  return (
    <View style={styles.infoItem}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue} numberOfLines={2}>
        {String(value || "-")}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#020617",
  },
  content: {
    padding: 20,
    paddingBottom: 92,
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
    fontSize: 27,
    fontWeight: "800",
    marginTop: 3,
  },
  subtitle: {
    color: "#94a3b8",
    marginTop: 6,
    lineHeight: 19,
  },
  iconBadge: {
    width: 46,
    height: 46,
    borderRadius: 8,
    backgroundColor: "#14532d",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#22c55e",
  },
  searchCard: {
    backgroundColor: "#0f172a",
    borderRadius: 8,
    padding: 14,
    borderWidth: 1,
    borderColor: "#1e293b",
  },
  searchLabelRow: {
    gap: 4,
    marginBottom: 10,
  },
  label: {
    color: "#cbd5e1",
    fontWeight: "800",
  },
  hint: {
    color: "#64748b",
    fontSize: 12,
  },
  searchRow: {
    flexDirection: "row",
    gap: 10,
  },
  input: {
    flex: 1,
    backgroundColor: "#111827",
    color: "white",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#1e293b",
    minHeight: 48,
    paddingHorizontal: 14,
  },
  searchButton: {
    width: 52,
    minHeight: 48,
    backgroundColor: "#16a34a",
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  integrationCard: {
    backgroundColor: "#082f49",
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: "#0ea5e9",
    flexDirection: "row",
    gap: 10,
  },
  integrationReady: {
    backgroundColor: "#052e16",
    borderColor: "#22c55e",
  },
  integrationIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  integrationTextWrap: {
    flex: 1,
  },
  integrationTitle: {
    color: "#e0f2fe",
    fontWeight: "800",
  },
  integrationText: {
    color: "#bae6fd",
    marginTop: 4,
    lineHeight: 18,
  },
  summaryCard: {
    backgroundColor: "#0f172a",
    borderRadius: 8,
    padding: 14,
    borderWidth: 1,
    borderColor: "#1e293b",
    gap: 12,
  },
  summaryLabel: {
    color: "#94a3b8",
    fontWeight: "700",
  },
  summaryValue: {
    color: "white",
    fontSize: 20,
    fontWeight: "800",
    marginTop: 2,
  },
  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  summaryItem: {
    width: "48%",
    backgroundColor: "#111827",
    borderRadius: 8,
    padding: 10,
  },
  summaryItemWide: {
    width: "100%",
  },
  summaryItemLabel: {
    color: "#38bdf8",
    fontSize: 11,
    fontWeight: "800",
  },
  summaryItemValue: {
    color: "white",
    fontWeight: "800",
    marginTop: 4,
  },
  resultHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sectionTitle: {
    color: "white",
    fontSize: 18,
    fontWeight: "800",
  },
  resultCount: {
    color: "#94a3b8",
    fontWeight: "700",
  },
  unitCard: {
    backgroundColor: "#0f172a",
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: "#1e293b",
  },
  unitTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 12,
  },
  unitTitleWrap: {
    flex: 1,
  },
  unitNo: {
    color: "white",
    fontSize: 20,
    fontWeight: "800",
  },
  producer: {
    color: "#cbd5e1",
    marginTop: 4,
    fontWeight: "700",
  },
  status: {
    color: "#22c55e",
    fontWeight: "800",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  infoItem: {
    width: "48%",
    backgroundColor: "#111827",
    borderRadius: 8,
    padding: 10,
  },
  infoLabel: {
    color: "#94a3b8",
    fontSize: 11,
    fontWeight: "700",
  },
  infoValue: {
    color: "white",
    marginTop: 4,
    fontWeight: "800",
  },
  actions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 14,
  },
  secondaryButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#38bdf8",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
  },
  secondaryButtonText: {
    color: "#38bdf8",
    fontWeight: "800",
  },
  createButton: {
    flex: 1.5,
    minHeight: 46,
    borderRadius: 8,
    backgroundColor: "#16a34a",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 8,
  },
  createButtonText: {
    color: "white",
    fontWeight: "800",
    textAlign: "center",
  },
  emptyCard: {
    backgroundColor: "#0f172a",
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: "#1e293b",
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
