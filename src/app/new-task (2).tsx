import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { BottomTabMenu } from "../components/BottomTabMenu";
import { RoleGate } from "../components/RoleGate";
import { createTask } from "../services/createTask";
import { KobuksUnitRecord } from "../services/kobuks";
import { getCurrentLocation } from "../services/location";
import { lookupMinistryUnit } from "../services/ministryLookup";

type AdminWorkflowType = "inspection" | "detection" | "classification";

const workflowTypeOptions: {
  key: AdminWorkflowType;
  title: string;
  subtitle: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
}[] = [
  {
    key: "inspection",
    title: "Başvurulu Denetim",
    subtitle: "KOBÜKS kaydının saha uygunluğu",
    icon: "clipboard-check-outline",
  },
  {
    key: "detection",
    title: "Re'sen Tespit",
    subtitle: "Sahada yeni/farklı ürün veya kayıt",
    icon: "sprout-outline",
  },
  {
    key: "classification",
    title: "Sınıflandırma",
    subtitle: "Seranın güncel sınıf ve özellikleri",
    icon: "greenhouse",
  },
];

function getWorkflowTypeTitle(value: AdminWorkflowType) {
  return workflowTypeOptions.find((item) => item.key === value)?.title || "Başvurulu Denetim";
}

function parseRouteJson(value: unknown) {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(String(Array.isArray(value) ? value[0] : value));
  } catch {
    return null;
  }
}

export default function NewTaskScreen() {
  return (
    <RoleGate adminOnly>
      <NewTaskContent />
    </RoleGate>
  );
}

function NewTaskContent() {
  const params = useLocalSearchParams();
  const [tcNo, setTcNo] = useState("");
  const [producerName, setProducerName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [districtName, setDistrictName] = useState("");
  const [village, setVillage] = useState("");
  const [adaNo, setAdaNo] = useState("");
  const [parcelNo, setParcelNo] = useState("");
  const [unitNo, setUnitNo] = useState("");
  const [greenhouseArea, setGreenhouseArea] = useState("");
  const [crop, setCrop] = useState("");
  const [description, setDescription] = useState("");
  const [gpsText, setGpsText] = useState("GPS alınmadı");
  const [selectedLatitude, setSelectedLatitude] = useState<number | null>(null);
  const [selectedLongitude, setSelectedLongitude] = useState<number | null>(null);
  const [selectedParcelPolygon, setSelectedParcelPolygon] = useState<any>(null);
  const [selectedGreenhousePolygon, setSelectedGreenhousePolygon] = useState<any>(null);
  const [workflowType, setWorkflowType] = useState<AdminWorkflowType>("inspection");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!params.tc_no && !params.unit_no && !params.ada_no && !params.parcel_no) {
      return;
    }

    applyKobuksRecord({
      tc_no: String(params.tc_no || ""),
      producer_name: String(params.producer_name || ""),
      phone: String(params.phone || ""),
      city: String(params.city || ""),
      district_name: String(params.district_name || ""),
      village: String(params.village || ""),
      ada_no: String(params.ada_no || ""),
      parcel_no: String(params.parcel_no || ""),
      detected_crop: String(params.detected_crop || ""),
      unit_no: String(params.unit_no || ""),
      greenhouse_area: String(params.greenhouse_area || ""),
      latitude: Number(params.latitude || 0) || undefined,
      longitude: Number(params.longitude || 0) || undefined,
      parcel_polygon: parseRouteJson(params.parcel_polygon),
      greenhouse_polygon: parseRouteJson(params.greenhouse_polygon),
    });
  }, [params]);

  function applyKobuksRecord(data: KobuksUnitRecord) {
    setTcNo(data.tc_no || "");
    setProducerName(data.producer_name || "");
    setPhone(data.phone || "");
    setCity(data.city || "");
    setDistrictName(data.district_name || "");
    setVillage(data.village || "");
    setAdaNo(data.ada_no || "");
    setParcelNo(data.parcel_no || "");
    setCrop(data.detected_crop || "");
    setUnitNo(data.unit_no || "");
    setGreenhouseArea(data.greenhouse_area || "");
    setSelectedLatitude(Number(data.latitude || 0) || null);
    setSelectedLongitude(Number(data.longitude || 0) || null);
    setSelectedParcelPolygon(data.parcel_polygon || null);
    setSelectedGreenhousePolygon(data.greenhouse_polygon || null);

    if (data.latitude && data.longitude) {
      setGpsText("CBS konumu alındı");
    }
  }

  function buildWorkflowDescription() {
    const lines = [
      "İş akışı: KOBÜKS/CBS kaynaklı saha görevi",
      "Kaynak: Bakanlık veri tabanı",
      `Görev türü: ${getWorkflowTypeTitle(workflowType)}`,
      description.trim() ? `Not: ${description.trim()}` : null,
    ].filter(Boolean);

    return lines.join("\n");
  }

  async function loadFromKobuks() {
    try {
      const data = await lookupMinistryUnit({
        tc_no: tcNo,
        unit_no: unitNo,
        city,
        district_name: districtName,
        village,
        ada_no: adaNo,
        parcel_no: parcelNo,
      });
      applyKobuksRecord(data);
      Alert.alert("Başarılı", "Bakanlık bilgileri göreve aktarıldı.");
    } catch (error: any) {
      Alert.alert("Hata", error?.message || "Bakanlık sorgusu başarısız.");
    }
  }

  function openUnitFinder(method: string) {
    if (method.includes("CBS")) {
      router.push({
        pathname: "/cbs",
        params: { workflow: workflowType },
      } as any);
      return;
    }

    router.push({
      pathname: "/kobuks",
      params: { workflow: workflowType, mode: method.includes("Ada") ? "parcel" : "units" },
    } as any);
  }

  async function saveTask() {
    if (!producerName.trim() || !unitNo.trim() || !adaNo.trim() || !parcelNo.trim()) {
      Alert.alert("Bilgi eksik", "Üretici, ünite no ve ada/parsel bilgileri görev için zorunludur.");
      return;
    }

    setLoading(true);

    try {
      const location =
        selectedLatitude && selectedLongitude
          ? {
              latitude: selectedLatitude,
              longitude: selectedLongitude,
            }
          : await getCurrentLocation();

      if (location) {
        setGpsText("GPS alındı");
      }

      const result = await createTask({
        tc_no: tcNo,
        producer_name: producerName,
        phone,
        city,
        district_name: districtName,
        village,
        business_no: "",
        ada_no: adaNo,
        parcel_no: parcelNo,
        unit_no: unitNo,
        greenhouse_area: greenhouseArea,
        detected_crop: crop,
        workflow_type: workflowType,
        description: buildWorkflowDescription(),
        status: "Bekliyor",
        workflow_status: "Bekliyor",
        compliance_result: null,
        latitude: location?.latitude,
        longitude: location?.longitude,
        ...(selectedParcelPolygon ? { parcel_polygon: selectedParcelPolygon } : {}),
        ...(selectedGreenhousePolygon ? { greenhouse_polygon: selectedGreenhousePolygon } : {}),
      });

      if (result.error) {
        Alert.alert("Hata", result.error.message);
        return;
      }

      Alert.alert("Başarılı", "Görev oluşturuldu. Denetçi atama ekranı açılıyor.");

      if (result.data?.id) {
        router.replace(`/task/${result.data.id}` as any);
      } else {
        router.back();
      }
    } catch {
      Alert.alert("Hata", "Görev oluşturulamadı.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.root}>
      <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      contentInsetAdjustmentBehavior="automatic"
    >
      <View style={styles.header}>
        <View style={styles.headerIcon}>
          <MaterialCommunityIcons name="clipboard-plus-outline" color="#bbf7d0" size={24} />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.kicker}>Admin işlem ekranı</Text>
          <Text style={styles.title}>Yeni Saha Görevi</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Kayıt Bul</Text>
        <View style={styles.twoColumn}>
          <Field label="Ünite no" value={unitNo} onChangeText={setUnitNo} placeholder="Ünite no" compact />
          <Field label="TC/VKN" value={tcNo} onChangeText={setTcNo} placeholder="TC/VKN" compact keyboardType="number-pad" />
        </View>
        <View style={styles.twoColumn}>
          <Field label="İl" value={city} onChangeText={setCity} placeholder="İl" compact />
          <Field label="İlçe" value={districtName} onChangeText={setDistrictName} placeholder="İlçe" compact />
        </View>
        <Field label="Mahalle" value={village} onChangeText={setVillage} placeholder="Mahalle" />
        <View style={styles.twoColumn}>
          <Field label="Ada" value={adaNo} onChangeText={setAdaNo} placeholder="Ada" compact />
          <Field label="Parsel" value={parcelNo} onChangeText={setParcelNo} placeholder="Parsel" compact />
        </View>
        <View style={styles.lookupActions}>
          <Pressable onPress={() => openUnitFinder("CBS Haritası")} style={styles.primaryLookupButton}>
            <MaterialCommunityIcons name="map-search-outline" color="white" size={18} />
            <Text style={styles.primaryLookupText}>{"CBS'den Seç"}</Text>
          </Pressable>
          <Pressable onPress={loadFromKobuks} style={styles.secondaryLookupButton}>
            <MaterialCommunityIcons name="database-import-outline" color="#38bdf8" size={18} />
            <Text style={styles.secondaryButtonText}>Bilgileri Getir</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.summaryHeader}>
          <Text style={styles.sectionTitle}>Seçilen Kayıt</Text>
          <View style={[styles.statusBadge, producerName ? styles.statusBadgeReady : null]}>
            <Text style={[styles.statusBadgeText, producerName ? styles.statusBadgeTextReady : null]}>
              {producerName ? "Hazır" : "Bekliyor"}
            </Text>
          </View>
        </View>
        <View style={styles.summaryGrid}>
          <SummaryItem label="Üretici" value={producerName} />
          <SummaryItem label="Telefon" value={phone} />
          <SummaryItem label="İl / İlçe" value={city || districtName ? `${city || "-"} / ${districtName || "-"}` : ""} />
          <SummaryItem label="Mahalle" value={village} />
          <SummaryItem label="Ünite" value={unitNo} />
          <SummaryItem label="Ada / Parsel" value={adaNo || parcelNo ? `${adaNo || "-"} / ${parcelNo || "-"}` : ""} />
          <SummaryItem label="Ürün" value={crop} />
          <SummaryItem label="Kapalı Alan" value={greenhouseArea ? `${greenhouseArea} m²` : ""} />
        </View>
        <View style={styles.gpsRow}>
          <MaterialCommunityIcons name="crosshairs-gps" color="#22c55e" size={18} />
          <Text style={styles.gpsText}>{gpsText}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Görev Notu</Text>
        <TextInput
          value={description}
          onChangeText={setDescription}
          placeholder="Denetçiye kısa not"
          placeholderTextColor="#64748b"
          multiline
          style={[styles.input, styles.textArea]}
          textAlignVertical="top"
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Görev Türü</Text>
        <View style={styles.workflowTypeList}>
          {workflowTypeOptions.map((item) => {
            const selected = workflowType === item.key;

            return (
              <Pressable
                key={item.key}
                onPress={() => setWorkflowType(item.key)}
                style={[styles.workflowTypeOption, selected && styles.workflowTypeOptionActive]}
              >
                <MaterialCommunityIcons name={item.icon} color={selected ? "#bbf7d0" : "#38bdf8"} size={22} />
                <View style={styles.workflowTypeText}>
                  <Text style={[styles.workflowTypeTitle, selected && styles.workflowTypeTitleActive]}>
                    {item.title}
                  </Text>
                  <Text style={styles.workflowTypeSubtitle} numberOfLines={1}>
                    {item.subtitle}
                  </Text>
                </View>
                {selected ? <MaterialCommunityIcons name="check-circle" color="#22c55e" size={20} /> : null}
              </Pressable>
            );
          })}
        </View>
      </View>

      <Pressable onPress={saveTask} style={styles.saveButton} disabled={loading}>
        <MaterialCommunityIcons name="check-circle-outline" color="white" size={20} />
        <Text style={styles.saveButtonText}>{loading ? "Oluşturuluyor..." : "Görevi Oluştur"}</Text>
      </Pressable>
      </ScrollView>
      <BottomTabMenu />
    </View>
  );
}

function Field({
  label,
  compact,
  ...props
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  compact?: boolean;
  keyboardType?: "default" | "number-pad" | "phone-pad";
}) {
  return (
    <View style={compact ? styles.compactField : styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput {...props} placeholderTextColor="#64748b" style={styles.input} />
    </View>
  );
}

function SummaryItem({ label, value }: { label: string; value: unknown }) {
  return (
    <View style={styles.summaryItem}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue} numberOfLines={2}>{String(value || "-")}</Text>
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
    paddingBottom: 110,
    gap: 12,
  },
  header: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
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
  headerText: {
    flex: 1,
  },
  kicker: {
    color: "#38bdf8",
    fontWeight: "800",
    fontSize: 12,
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
  lookupActions: {
    flexDirection: "row",
    gap: 8,
  },
  primaryLookupButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 8,
    backgroundColor: "#16a34a",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 10,
  },
  primaryLookupText: {
    color: "white",
    fontWeight: "800",
    textAlign: "center",
  },
  secondaryLookupButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#38bdf8",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 10,
  },
  summaryHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  statusBadge: {
    minHeight: 28,
    borderRadius: 8,
    backgroundColor: "#111827",
    borderWidth: 1,
    borderColor: "#334155",
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  statusBadgeReady: {
    backgroundColor: "#14532d",
    borderColor: "#22c55e",
  },
  statusBadgeText: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: "800",
  },
  statusBadgeTextReady: {
    color: "#bbf7d0",
  },
  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  summaryItem: {
    width: "48%",
    minHeight: 62,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#1e293b",
    backgroundColor: "#111827",
    padding: 10,
    justifyContent: "center",
  },
  summaryLabel: {
    color: "#38bdf8",
    fontSize: 11,
    fontWeight: "800",
  },
  summaryValue: {
    color: "white",
    marginTop: 5,
    fontWeight: "800",
    lineHeight: 17,
  },
  field: {
    gap: 6,
  },
  compactField: {
    flex: 1,
    gap: 6,
  },
  label: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: "800",
  },
  input: {
    backgroundColor: "#111827",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#1e293b",
    minHeight: 48,
    paddingHorizontal: 12,
    color: "white",
  },
  textArea: {
    minHeight: 112,
    paddingTop: 12,
  },
  workflowTypeList: {
    gap: 8,
  },
  workflowTypeOption: {
    minHeight: 64,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#1e293b",
    backgroundColor: "#111827",
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  workflowTypeOptionActive: {
    borderColor: "#22c55e",
    backgroundColor: "#10251f",
  },
  workflowTypeText: {
    flex: 1,
    minWidth: 0,
  },
  workflowTypeTitle: {
    color: "white",
    fontWeight: "800",
  },
  workflowTypeTitleActive: {
    color: "#bbf7d0",
  },
  workflowTypeSubtitle: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 3,
  },
  twoColumn: {
    flexDirection: "row",
    gap: 8,
  },
  secondaryButtonText: {
    color: "#38bdf8",
    fontWeight: "800",
  },
  gpsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  gpsText: {
    color: "#22c55e",
    fontWeight: "800",
  },
  saveButton: {
    minHeight: 54,
    borderRadius: 8,
    backgroundColor: "#16a34a",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  saveButtonText: {
    color: "white",
    fontWeight: "800",
    fontSize: 16,
  },
});
