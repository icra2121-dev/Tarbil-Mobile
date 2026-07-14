import { useLocalSearchParams } from "expo-router";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";

import { BottomTabMenu } from "../../../components/BottomTabMenu";
import { supabase } from "../../../lib/supabase";

type Point = {
  latitude: number;
  longitude: number;
};

const FALLBACK_CENTER: Point = {
  latitude: 36.8969,
  longitude: 30.7133,
};

function toNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function buildFallbackPolygon(center: Point): Point[] {
  const delta = 0.0012;
  return [
    { latitude: center.latitude + delta, longitude: center.longitude - delta },
    { latitude: center.latitude + delta, longitude: center.longitude + delta },
    { latitude: center.latitude - delta, longitude: center.longitude + delta },
    { latitude: center.latitude - delta, longitude: center.longitude - delta },
  ];
}

function parsePolygon(value: unknown, center: Point): Point[] {
  if (Array.isArray(value)) {
    const points = value
      .map((item) => ({
        latitude: toNumber(item?.latitude ?? item?.lat, NaN),
        longitude: toNumber(item?.longitude ?? item?.lng, NaN),
      }))
      .filter((point) => Number.isFinite(point.latitude) && Number.isFinite(point.longitude));

    if (points.length >= 3) return points;
  }

  return buildFallbackPolygon(center);
}

function getCenter(points: Point[]) {
  if (!points.length) return FALLBACK_CENTER;

  const total = points.reduce(
    (sum, point) => ({
      latitude: sum.latitude + point.latitude,
      longitude: sum.longitude + point.longitude,
    }),
    { latitude: 0, longitude: 0 },
  );

  return {
    latitude: total.latitude / points.length,
    longitude: total.longitude / points.length,
  };
}

function formatCoord(value: number) {
  return value.toFixed(6);
}

export default function Ek8Screen() {
  const { id } = useLocalSearchParams();
  const [task, setTask] = useState<any>(null);
  const [unit, setUnit] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadData() {
      setLoading(true);

      const taskResult = await supabase.from("tasks").select("*").eq("id", id).single();
      const nextTask = taskResult.data;

      let nextUnit = null;

      if (nextTask?.unit_no) {
        const unitResult = await supabase.from("kobuks_units").select("*").eq("unit_no", nextTask.unit_no).single();
        nextUnit = unitResult.data;
      }

      if (!active) {
        return;
      }

      setTask(nextTask);
      setUnit(nextUnit);
      setLoading(false);
    }

    loadData();

    return () => {
      active = false;
    };
  }, [id]);

  const center = useMemo(
    () => ({
      latitude: toNumber(task?.latitude ?? unit?.latitude ?? unit?.unit_latitude, FALLBACK_CENTER.latitude),
      longitude: toNumber(task?.longitude ?? unit?.longitude ?? unit?.unit_longitude, FALLBACK_CENTER.longitude),
    }),
    [task, unit],
  );

  const parcelPolygon = useMemo(
    () => parsePolygon(task?.parcel_polygon ?? unit?.parcel_polygon ?? unit?.polygon, center),
    [center, task, unit],
  );

  const greenhousePolygon = useMemo(
    () => parsePolygon(task?.greenhouse_polygon ?? unit?.greenhouse_polygon ?? unit?.unit_polygon, center),
    [center, task, unit],
  );

  const greenhouseCenter = getCenter(greenhousePolygon);

  if (loading) {
    return (
      <View style={styles.root}>
        <View style={styles.center}>
          <ActivityIndicator color="#22c55e" size="large" />
          <Text style={styles.loadingText}>Ek-8 raporu hazırlanıyor...</Text>
        </View>
        <BottomTabMenu />
      </View>
    );
  }

  if (!task) {
    return (
      <View style={styles.root}>
        <View style={styles.center}>
          <Text style={styles.loadingText}>Kayıt bulunamadı.</Text>
        </View>
        <BottomTabMenu />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>EK-8 Tespit Tutanağı</Text>
      <Text style={styles.subtitle}>KOBÜKS ve CBS koordinat uyum raporu</Text>

      <View style={styles.card}>
        <Section title="Üretici ve ünite">
          <Line label="İl" value={task.city} />
          <Line label="İlçe" value={task.district_name} />
          <Line label="Mahalle" value={task.village} />
          <Line label="TC" value={task.tc_no} />
          <Line label="Ad Soyad" value={task.producer_name} />
          <Line label="Ünite No" value={task.unit_no} />
          <Line label="Ada" value={task.ada_no} />
          <Line label="Parsel" value={task.parcel_no} />
          <Line label="Ürün" value={task.detected_crop} />
          <Line label="Alan" value={`${task.greenhouse_area || unit?.greenhouse_area || "-"} m²`} />
        </Section>

        <Section title="Parsel koordinatları">
          {parcelPolygon.map((point, index) => (
            <Line
              key={`parcel-${index}`}
              label={String.fromCharCode(65 + index)}
              value={`${formatCoord(point.latitude)}, ${formatCoord(point.longitude)}`}
            />
          ))}
        </Section>

        <Section title="Kapalı üretim ünitesi koordinatları">
          {greenhousePolygon.map((point, index) => (
            <Line
              key={`greenhouse-${index}`}
              label={String.fromCharCode(97 + index)}
              value={`${formatCoord(point.latitude)}, ${formatCoord(point.longitude)}`}
            />
          ))}
          <Line label="Merkez" value={`${formatCoord(greenhouseCenter.latitude)}, ${formatCoord(greenhouseCenter.longitude)}`} strong />
        </Section>

        <View style={styles.noteBox}>
          <Text style={styles.noteText}>
            Bu rapor, Bakanlık CBS sisteminden alınan parsel ve kapalı üretim ünitesi koordinatlarının KOBÜKS Ek-8
            kaydı ile eşleştirilmesi için hazırlanmıştır.
          </Text>
        </View>
      </View>
      </ScrollView>
      <BottomTabMenu />
    </View>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Line({ label, value, strong }: { label: string; value: unknown; strong?: boolean }) {
  return (
    <View style={styles.line}>
      <Text style={styles.lineLabel}>{label}</Text>
      <Text style={[styles.lineValue, strong && styles.strongValue]}>{String(value || "-")}</Text>
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
    paddingBottom: 96,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#020617",
  },
  loadingText: {
    color: "#cbd5e1",
    marginTop: 12,
    fontWeight: "700",
  },
  title: {
    color: "white",
    fontSize: 28,
    fontWeight: "800",
  },
  subtitle: {
    color: "#94a3b8",
    marginTop: 6,
    marginBottom: 18,
  },
  card: {
    backgroundColor: "#0f172a",
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#1e293b",
  },
  section: {
    marginBottom: 22,
  },
  sectionTitle: {
    color: "#38bdf8",
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 10,
  },
  line: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#1e293b",
  },
  lineLabel: {
    color: "#94a3b8",
    fontWeight: "700",
  },
  lineValue: {
    color: "white",
    flex: 1,
    textAlign: "right",
  },
  strongValue: {
    color: "#22c55e",
    fontWeight: "800",
  },
  noteBox: {
    backgroundColor: "#111827",
    borderRadius: 8,
    padding: 12,
  },
  noteText: {
    color: "#cbd5e1",
    lineHeight: 20,
  },
});
