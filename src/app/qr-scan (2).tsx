import { MaterialCommunityIcons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from "react-native";

import { BottomTabMenu } from "../components/BottomTabMenu";
import { supabase } from "../lib/supabase";
import { type KobuksUnitRecord } from "../services/kobuks";
import { lookupMinistryUnit } from "../services/ministryLookup";
import { getMyProfile, isAdmin } from "../services/profile";

function singleParam(value: unknown) {
  return String(Array.isArray(value) ? value[0] : value || "");
}

function extractQrParams(data: string) {
  const trimmed = data.trim();

  try {
    const parsed = JSON.parse(trimmed);
    return {
      tc_no: parsed.tc_no || parsed.tc || parsed.vkn || "",
      unit_no: parsed.unit_no || parsed.unitNo || parsed.unite_no || "",
      ada_no: parsed.ada_no || parsed.ada || "",
      parcel_no: parsed.parcel_no || parsed.parsel || "",
    };
  } catch {
    // QR JSON degilse URL veya duz metin olarak ayrisitirilir.
  }

  try {
    const url = new URL(trimmed);
    return {
      tc_no: url.searchParams.get("tc_no") || url.searchParams.get("tc") || url.searchParams.get("vkn") || "",
      unit_no: url.searchParams.get("unit_no") || url.searchParams.get("unit") || url.searchParams.get("unite_no") || "",
      ada_no: url.searchParams.get("ada_no") || url.searchParams.get("ada") || "",
      parcel_no: url.searchParams.get("parcel_no") || url.searchParams.get("parsel") || "",
    };
  } catch {
    // URL degilse duz metin olarak islenir.
  }

  if (/^\d{10,11}$/.test(trimmed)) {
    return { tc_no: trimmed, unit_no: "", ada_no: "", parcel_no: "" };
  }

  return { tc_no: "", unit_no: trimmed, ada_no: "", parcel_no: "" };
}

function appendQrDetails(description: unknown, unit: KobuksUnitRecord) {
  const qrLabels = new Set(["qr ünite no", "qr üretici", "qr ürün", "qr ada/parsel"]);
  const existingLines = String(description || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => {
      const label = line.includes(":") ? line.slice(0, line.indexOf(":")).trim().toLocaleLowerCase("tr-TR") : "";
      return !qrLabels.has(label);
    });

  const qrLines = [
    `QR Ünite No: ${unit.unit_no || "-"}`,
    `QR Üretici: ${unit.producer_name || "-"}`,
    `QR Ürün: ${unit.detected_crop || "-"}`,
    `QR Ada/Parsel: ${unit.ada_no || "-"} / ${unit.parcel_no || "-"}`,
  ];

  return [...existingLines, ...qrLines].join("\n");
}

function buildTaskUpdate(task: any, unit: KobuksUnitRecord) {
  return {
    description: appendQrDetails(task?.description, unit),
    tc_no: task?.tc_no || unit.tc_no || null,
    producer_name: task?.producer_name || unit.producer_name || null,
    phone: task?.phone || unit.phone || null,
    city: task?.city || unit.city || null,
    district_name: task?.district_name || unit.district_name || null,
    village: task?.village || unit.village || null,
    ada_no: task?.ada_no || unit.ada_no || null,
    parcel_no: task?.parcel_no || unit.parcel_no || null,
    unit_no: task?.unit_no || unit.unit_no || null,
    greenhouse_area: task?.greenhouse_area || unit.greenhouse_area || null,
    detected_crop: task?.detected_crop || unit.detected_crop || null,
    latitude: task?.latitude || unit.latitude || null,
    longitude: task?.longitude || unit.longitude || null,
    ...(unit.parcel_polygon ? { parcel_polygon: unit.parcel_polygon } : {}),
    ...(unit.greenhouse_polygon ? { greenhouse_polygon: unit.greenhouse_polygon } : {}),
  };
}

function stripOptionalPolygonFields(payload: any) {
  const { parcel_polygon: _parcelPolygon, greenhouse_polygon: _greenhousePolygon, ...safePayload } = payload;
  return safePayload;
}

export default function QrScanScreen() {
  const params = useLocalSearchParams<{ workflow?: string; task_id?: string }>();
  const taskId = useMemo(() => singleParam(params.task_id), [params.task_id]);
  const [permission, requestPermission] = useCameraPermissions();
  const [locked, setLocked] = useState(false);
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    if (!permission) {
      requestPermission();
    }
  }, [permission, requestPermission]);

  useEffect(() => {
    let active = true;

    getMyProfile()
      .then((profile) => {
        if (active && (isAdmin(profile) || profile?.role === "manager")) {
          setBlocked(true);
        }
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, []);

  async function updateTaskWithQr(unit: KobuksUnitRecord) {
    if (!taskId) {
      throw new Error("QR tarama atanmış görev detayından başlatılmalıdır.");
    }

    const taskResult = await supabase.from("tasks").select("*").eq("id", taskId).single();

    if (taskResult.error) {
      throw taskResult.error;
    }

    const currentTask = taskResult.data;
    const taskUnitNo = String(currentTask?.unit_no || "").trim();
    const qrUnitNo = String(unit.unit_no || "").trim();

    if (taskUnitNo && qrUnitNo && taskUnitNo !== qrUnitNo) {
      throw new Error("Okutulan QR bu görevin ünitesiyle eşleşmiyor.");
    }

    const payload = buildTaskUpdate(currentTask, unit);
    let updateResult = await supabase.from("tasks").update(payload).eq("id", taskId).select("*").single();

    if (updateResult.error && String(updateResult.error.message || "").toLocaleLowerCase("tr-TR").includes("schema")) {
      updateResult = await supabase.from("tasks").update(stripOptionalPolygonFields(payload)).eq("id", taskId).select("*").single();
    }

    if (updateResult.error) {
      throw updateResult.error;
    }

    router.replace(`/task/${taskId}` as any);
  }

  async function handleCode(data: string) {
    if (locked || blocked) {
      return;
    }

    setLocked(true);

    try {
      const parsed = extractQrParams(data);
      const unit = await lookupMinistryUnit(parsed);
      await updateTaskWithQr(unit);
    } catch (error: any) {
      Alert.alert("QR okunamadı", error?.message || "Bakanlık kaydı bulunamadı.");
      setLocked(false);
    }
  }

  if (blocked) {
    return (
      <View style={styles.center}>
        <MaterialCommunityIcons name="qrcode-remove" color="#fca5a5" size={38} />
        <Text style={styles.title}>QR denetçi ekranında</Text>
        <Pressable onPress={() => router.back()} style={styles.permissionButton}>
          <Text style={styles.buttonText}>Geri Dön</Text>
        </Pressable>
        <BottomTabMenu />
      </View>
    );
  }

  if (!taskId) {
    return (
      <View style={styles.center}>
        <MaterialCommunityIcons name="clipboard-alert-outline" color="#38bdf8" size={38} />
        <Text style={styles.title}>Görev seçilmeli</Text>
        <Pressable onPress={() => router.back()} style={styles.permissionButton}>
          <Text style={styles.buttonText}>Geri Dön</Text>
        </Pressable>
        <BottomTabMenu />
      </View>
    );
  }

  if (!permission?.granted) {
    return (
      <View style={styles.center}>
        <MaterialCommunityIcons name="qrcode-scan" color="#38bdf8" size={38} />
        <Text style={styles.title}>Sera QR</Text>
        <Pressable onPress={requestPermission} style={styles.permissionButton}>
          <Text style={styles.buttonText}>İzin Ver</Text>
        </Pressable>
        <BottomTabMenu />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <CameraView
        style={styles.camera}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        onBarcodeScanned={({ data }) => handleCode(data)}
      />
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} style={styles.iconButton}>
          <MaterialCommunityIcons name="close" color="white" size={22} />
        </Pressable>
        <Text style={styles.topTitle}>Sera QR</Text>
        <View style={styles.iconButtonGhost} />
      </View>
      {locked ? (
        <View style={styles.loadingPill}>
          <ActivityIndicator color="#020617" />
        </View>
      ) : null}
      <BottomTabMenu />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "black",
  },
  camera: {
    flex: 1,
  },
  center: {
    flex: 1,
    backgroundColor: "#020617",
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    padding: 24,
  },
  title: {
    color: "white",
    fontSize: 24,
    fontWeight: "800",
    textAlign: "center",
  },
  topBar: {
    position: "absolute",
    top: 44,
    left: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  topTitle: {
    color: "white",
    fontSize: 20,
    fontWeight: "800",
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 8,
    backgroundColor: "rgba(15,23,42,0.72)",
    alignItems: "center",
    justifyContent: "center",
  },
  iconButtonGhost: {
    width: 42,
    height: 42,
  },
  loadingPill: {
    position: "absolute",
    alignSelf: "center",
    bottom: 60,
    width: 62,
    height: 42,
    borderRadius: 8,
    backgroundColor: "white",
    alignItems: "center",
    justifyContent: "center",
  },
  permissionButton: {
    minHeight: 48,
    borderRadius: 8,
    backgroundColor: "#16a34a",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  buttonText: {
    color: "white",
    fontWeight: "800",
  },
});
