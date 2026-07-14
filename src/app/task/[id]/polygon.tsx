import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { router, useLocalSearchParams } from "expo-router";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import MapView, { Circle, Polygon, type MapPressEvent } from "react-native-maps";

import { BottomTabMenu } from "../../../components/BottomTabMenu";
import {
  ANTALYA_REGION,
  STATUS_COLOR,
  STATUS_LABEL,
  getCenter,
  loadCbsUnits,
  parsePolygon,
  type CbsUnit,
  type MapPoint,
} from "../../../services/cbs";
import { updateTaskOnlineOrQueue } from "../../../services/offline";
import { getTaskById } from "../../../services/taskDetail";

function singleParam(value: unknown) {
  return String(Array.isArray(value) ? value[0] : value || "");
}

function normalizePoint(point: MapPoint, index: number) {
  return {
    corner: index + 1,
    latitude: Number(point.latitude.toFixed(8)),
    longitude: Number(point.longitude.toFixed(8)),
  };
}

function formatPoint(point: MapPoint, index: number) {
  return `${index + 1}. ${point.latitude.toFixed(8)}, ${point.longitude.toFixed(8)}`;
}

function stripPolygonDescription(description: unknown) {
  const lines = String(description || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const nextLines: string[] = [];
  let skippingCoordinates = false;

  lines.forEach((line) => {
    const normalized = line.toLocaleLowerCase("tr-TR");

    if (normalized.startsWith("cbs köşe koordinatları:")) {
      skippingCoordinates = true;
      return;
    }

    if (normalized.startsWith("cbs köşe koordinatları sonu")) {
      skippingCoordinates = false;
      return;
    }

    if (skippingCoordinates || normalized.startsWith("cbs poligonu:")) {
      return;
    }

    nextLines.push(line);
  });

  return nextLines;
}

function mergePolygonDescription(description: unknown, points: MapPoint[]) {
  const coordinateLines = points.map(formatPoint);

  return [
    ...stripPolygonDescription(description),
    `CBS Poligonu: ${points.length} köşe`,
    "CBS Köşe Koordinatları:",
    ...coordinateLines,
    "CBS Köşe Koordinatları Sonu",
  ].join("\n");
}

function removePolygonDescription(description: unknown) {
  return stripPolygonDescription(description).join("\n");
}

function getPolygonFallbackPayload(description: unknown, points: MapPoint[]) {
  const polygonCenter = getCenter(points);

  return {
    latitude: polygonCenter.latitude,
    longitude: polygonCenter.longitude,
    description: mergePolygonDescription(description, points),
  };
}

function getDeleteFallbackPayload(description: unknown) {
  return {
    description: removePolygonDescription(description),
  };
}

type LayerKey =
  | "parcels"
  | "registeredGreenhouses"
  | "assignedGreenhouses"
  | "missingGreenhouses"
  | "riskGreenhouses"
  | "unitPoints"
  | "selectedPolygon"
  | "selectedCorners"
  | "orthophoto"
  | "administrative"
  | "landUse"
  | "soil"
  | "irrigation"
  | "protection";

const MINISTRY_LAYERS: {
  key: LayerKey;
  title: string;
  subtitle: string;
  color: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  defaultActive: boolean;
  dataBacked: boolean;
}[] = [
  { key: "parcels", title: "TKGM Parseller", subtitle: "Ada/parsel sınırları", color: "#38bdf8", icon: "shape-polygon-plus", defaultActive: true, dataBacked: true },
  { key: "registeredGreenhouses", title: "Kayıtlı Seralar", subtitle: "KOBÜKS aktif üniteleri", color: "#22c55e", icon: "greenhouse", defaultActive: true, dataBacked: true },
  { key: "assignedGreenhouses", title: "Denetime Gidilecek", subtitle: "Atanmış saha görevleri", color: "#38bdf8", icon: "map-marker-check-outline", defaultActive: true, dataBacked: true },
  { key: "missingGreenhouses", title: "Eksik Bilgi", subtitle: "Taslak veya eksik kayıtlar", color: "#f59e0b", icon: "alert-circle-outline", defaultActive: true, dataBacked: true },
  { key: "riskGreenhouses", title: "Riskli Sera", subtitle: "Uyumsuz veya riskli üniteler", color: "#ef4444", icon: "alert-octagon-outline", defaultActive: true, dataBacked: true },
  { key: "unitPoints", title: "Ünite Noktaları", subtitle: "Sera merkez noktaları", color: "#2563eb", icon: "map-marker-radius-outline", defaultActive: false, dataBacked: true },
  { key: "selectedPolygon", title: "Çizilen Poligon", subtitle: "Sahada seçilen ünite alanı", color: "#16a34a", icon: "vector-polygon", defaultActive: true, dataBacked: true },
  { key: "selectedCorners", title: "Köşe Koordinatları", subtitle: "Seçilen tüm köşe noktaları", color: "#a3e635", icon: "crosshairs-gps", defaultActive: true, dataBacked: true },
  { key: "orthophoto", title: "Ortofoto / Uydu", subtitle: "Google hibrit altlık", color: "#94a3b8", icon: "satellite-variant", defaultActive: false, dataBacked: true },
  { key: "administrative", title: "İdari Sınırlar", subtitle: "İl, ilçe, mahalle", color: "#c084fc", icon: "map-outline", defaultActive: false, dataBacked: false },
  { key: "landUse", title: "Arazi Kullanımı", subtitle: "Tarım alanı sınıfları", color: "#84cc16", icon: "terrain", defaultActive: false, dataBacked: false },
  { key: "soil", title: "Toprak Sınıfı", subtitle: "Toprak ve kabiliyet verisi", color: "#a16207", icon: "layers-triple-outline", defaultActive: false, dataBacked: false },
  { key: "irrigation", title: "Sulama Altyapısı", subtitle: "Sulama kanalı ve hatları", color: "#06b6d4", icon: "water-outline", defaultActive: false, dataBacked: false },
  { key: "protection", title: "Koruma Alanları", subtitle: "Sit, mera ve kısıt alanları", color: "#fb7185", icon: "shield-alert-outline", defaultActive: false, dataBacked: false },
];

function createDefaultLayerState() {
  return MINISTRY_LAYERS.reduce<Record<LayerKey, boolean>>((state, layer) => {
    state[layer.key] = layer.defaultActive;
    return state;
  }, {} as Record<LayerKey, boolean>);
}

function isUnitLayerVisible(unit: CbsUnit, layers: Record<LayerKey, boolean>) {
  if (unit.status === "aktif") {
    return layers.registeredGreenhouses;
  }

  if (unit.status === "inceleme") {
    return layers.assignedGreenhouses;
  }

  if (unit.status === "taslak") {
    return layers.missingGreenhouses;
  }

  if (unit.status === "ihlal") {
    return layers.riskGreenhouses;
  }

  return layers.registeredGreenhouses;
}

function getLayerCount(units: CbsUnit[], key: LayerKey) {
  if (key === "parcels") return units.length;
  if (key === "registeredGreenhouses") return units.filter((unit) => unit.status === "aktif").length;
  if (key === "assignedGreenhouses") return units.filter((unit) => unit.status === "inceleme").length;
  if (key === "missingGreenhouses") return units.filter((unit) => unit.status === "taslak").length;
  if (key === "riskGreenhouses") return units.filter((unit) => unit.status === "ihlal").length;
  if (key === "unitPoints") return units.length;
  return 0;
}

function getLayerSubtitle(layer: (typeof MINISTRY_LAYERS)[number], units: CbsUnit[]) {
  const count = getLayerCount(units, layer.key);

  if (layer.dataBacked && count) {
    return `${layer.subtitle} · ${count} kayıt`;
  }

  if (!layer.dataBacked) {
    return `${layer.subtitle} · veri tabanı bağlantısı bekliyor`;
  }

  return layer.subtitle;
}

function getPolygonPayload(description: unknown, points: MapPoint[]) {
  const normalizedPoints = points.map(normalizePoint);
  const polygonCenter = getCenter(normalizedPoints);

  return {
    greenhouse_polygon: normalizedPoints,
    latitude: polygonCenter.latitude,
    longitude: polygonCenter.longitude,
    description: mergePolygonDescription(description, normalizedPoints),
  };
}

function getDeletePayload(description: unknown) {
  return {
    greenhouse_polygon: null,
    description: removePolygonDescription(description),
  };
}

export default function TaskPolygonScreen() {
  const { id } = useLocalSearchParams();
  const taskId = singleParam(id);
  const mapRef = useRef<MapView | null>(null);
  const [task, setTask] = useState<any>(null);
  const [units, setUnits] = useState<CbsUnit[]>([]);
  const [points, setPoints] = useState<MapPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showLayerPanel, setShowLayerPanel] = useState(false);
  const [layers, setLayers] = useState<Record<LayerKey, boolean>>(() => createDefaultLayerState());

  const center = useMemo(() => {
    if (points.length) {
      return getCenter(points);
    }

    if (task?.latitude && task?.longitude) {
      return {
        latitude: Number(task.latitude),
        longitude: Number(task.longitude),
      };
    }

    return {
      latitude: ANTALYA_REGION.latitude,
      longitude: ANTALYA_REGION.longitude,
    };
  }, [points, task]);

  useEffect(() => {
    let active = true;

    Promise.all([getTaskById(taskId), loadCbsUnits().catch(() => [])])
      .then(([result, cbsUnits]) => {
        if (!active) {
          return;
        }

        const nextTask = result.data;
        const taskCenter =
          nextTask?.latitude && nextTask?.longitude
            ? { latitude: Number(nextTask.latitude), longitude: Number(nextTask.longitude) }
            : { latitude: ANTALYA_REGION.latitude, longitude: ANTALYA_REGION.longitude };

        setTask(nextTask);
        setUnits(cbsUnits);

        if (nextTask?.greenhouse_polygon) {
          setPoints(parsePolygon(nextTask.greenhouse_polygon, taskCenter));
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
  }, [taskId]);

  async function locateMe() {
    const permission = await Location.requestForegroundPermissionsAsync();

    if (permission.status !== "granted") {
      return;
    }

    const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    const coordinate = {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
    };

    mapRef.current?.animateToRegion(
      {
        ...coordinate,
        latitudeDelta: 0.006,
        longitudeDelta: 0.006,
      },
      350,
    );
  }

  function addPoint(event: MapPressEvent) {
    const coordinate = event.nativeEvent.coordinate;

    if (!Number.isFinite(coordinate.latitude) || !Number.isFinite(coordinate.longitude)) {
      return;
    }

    setPoints((current) => [...current, coordinate]);
  }

  function undoPoint() {
    setPoints((current) => current.slice(0, -1));
  }

  function toggleLayer(key: LayerKey) {
    setLayers((current) => ({
      ...current,
      [key]: !current[key],
    }));
  }

  async function savePolygon() {
    if (points.length < 3) {
      Alert.alert("Poligon eksik", "Sera poligonu için en az 3 nokta işaretlenmeli.");
      return;
    }

    setSaving(true);

    try {
      const payload = getPolygonPayload(task?.description, points);
      const fallbackPayload = getPolygonFallbackPayload(task?.description, points);
      const result = await updateTaskOnlineOrQueue(taskId, payload, "CBS poligonu kaydı", fallbackPayload);

      if (result.queued) {
        setTask((current: any) => ({
          ...current,
          ...payload,
        }));
        Alert.alert("Sıraya alındı", "CBS poligonu internet geldiğinde sisteme aktarılacak.");
      } else {
        Alert.alert("Kaydedildi", "CBS poligonu göreve aktarıldı.");
      }

      router.back();
    } catch (error: any) {
      Alert.alert("Kaydedilemedi", error?.message || "CBS poligonu kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  }

  async function deletePolygon() {
    if (!points.length && !task?.greenhouse_polygon) {
      return;
    }

    Alert.alert("Poligonu sil", "Çizilen saha poligonu ve kayıtlı köşe koordinatları silinecek.", [
      {
        text: "Vazgeç",
        style: "cancel",
      },
      {
        text: "Sil",
        style: "destructive",
        onPress: async () => {
          setDeleting(true);

          try {
            const payload = getDeletePayload(task?.description);
            const fallbackPayload = getDeleteFallbackPayload(task?.description);
            const result = await updateTaskOnlineOrQueue(taskId, payload, "CBS poligonu silme", fallbackPayload);

            setPoints([]);
            setTask((current: any) => ({
              ...current,
              ...payload,
            }));

            Alert.alert(
              result.queued ? "Sıraya alındı" : "Silindi",
              result.queued ? "Poligon silme işlemi internet geldiğinde sisteme aktarılacak." : "Çizilen poligon silindi.",
            );
          } catch (error: any) {
            Alert.alert("Silinemedi", error?.message || "CBS poligonu silinemedi.");
          } finally {
            setDeleting(false);
          }
        },
      },
    ]);
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#22c55e" />
        <BottomTabMenu />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={{
          latitude: center.latitude,
          longitude: center.longitude,
          latitudeDelta: 0.012,
          longitudeDelta: 0.012,
        }}
        mapType={layers.orthophoto ? "hybrid" : "standard"}
        onPress={addPoint}
      >
        {units.map((unit) => {
          const color = STATUS_COLOR[unit.status] || "#22c55e";
          const unitCenter = getCenter(unit.greenhousePolygon);
          const unitVisible = isUnitLayerVisible(unit, layers);

          return (
            <Fragment key={unit.id}>
              {layers.parcels ? (
                <Polygon
                  coordinates={unit.parcelPolygon}
                  strokeColor="rgba(56,189,248,0.78)"
                  fillColor="rgba(56,189,248,0.08)"
                  strokeWidth={1}
                  tappable={false}
                />
              ) : null}
              {unitVisible ? (
                <Polygon
                  coordinates={unit.greenhousePolygon}
                  strokeColor={color}
                  fillColor={`${color}22`}
                  strokeWidth={2}
                  tappable={false}
                />
              ) : null}
              {layers.unitPoints && unitVisible ? (
                <Circle
                  center={unitCenter}
                  radius={7}
                  strokeColor="white"
                  fillColor={color}
                  strokeWidth={2}
                />
              ) : null}
            </Fragment>
          );
        })}
        {layers.selectedPolygon && points.length >= 3 ? (
          <Polygon coordinates={points} strokeColor="#22c55e" fillColor="rgba(34,197,94,0.28)" strokeWidth={3} />
        ) : null}
        {layers.selectedCorners
          ? points.map((point, index) => (
              <Circle
                key={`${point.latitude}-${point.longitude}-${index}`}
                center={point}
                radius={4}
                strokeColor="white"
                fillColor="#16a34a"
                strokeWidth={2}
              />
            ))
          : null}
      </MapView>

      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} style={styles.iconButton}>
          <MaterialCommunityIcons name="chevron-left" color="white" size={26} />
        </Pressable>
        <View style={styles.counterPill}>
          <Text style={styles.counterText}>{points.length} nokta</Text>
        </View>
        <View style={styles.topRightButtons}>
          <Pressable onPress={locateMe} style={styles.iconButton}>
            <MaterialCommunityIcons name="crosshairs-gps" color="white" size={22} />
          </Pressable>
          <Pressable onPress={() => setShowLayerPanel((value) => !value)} style={[styles.iconButton, showLayerPanel && styles.iconButtonActive]}>
            <MaterialCommunityIcons name="layers-outline" color="white" size={22} />
          </Pressable>
        </View>
      </View>

      {showLayerPanel ? (
        <View style={styles.layerPanel}>
          <View style={styles.layerPanelHeader}>
            <Text style={styles.layerPanelTitle}>CBS Katmanları</Text>
            <Text style={styles.layerPanelCount}>{MINISTRY_LAYERS.length} katman</Text>
          </View>
          <ScrollView style={styles.layerList} contentContainerStyle={styles.layerListContent} nestedScrollEnabled>
            {MINISTRY_LAYERS.map((layer) => (
              <LayerRow
                key={layer.key}
                active={layers[layer.key]}
                color={layer.color}
                icon={layer.icon}
                subtitle={getLayerSubtitle(layer, units)}
                title={layer.title}
                onPress={() => toggleLayer(layer.key)}
              />
            ))}
            <View style={styles.legendBlock}>
              <LegendRow color={STATUS_COLOR.aktif} title={STATUS_LABEL.aktif} />
              <LegendRow color={STATUS_COLOR.inceleme} title={STATUS_LABEL.inceleme} />
              <LegendRow color={STATUS_COLOR.taslak} title={STATUS_LABEL.taslak} />
              <LegendRow color={STATUS_COLOR.ihlal} title={STATUS_LABEL.ihlal} />
            </View>
          </ScrollView>
        </View>
      ) : null}

      {points.length ? (
        <View style={styles.coordinatePanel}>
          <Text style={styles.coordinateTitle}>Köşe koordinatları</Text>
          {points.slice(0, 5).map((point, index) => (
            <Text key={`${point.latitude}-${point.longitude}-${index}`} style={styles.coordinateText}>
              {formatPoint(point, index)}
            </Text>
          ))}
          {points.length > 5 ? <Text style={styles.coordinateText}>+{points.length - 5} köşe daha</Text> : null}
        </View>
      ) : null}

      <View style={styles.bottomBar}>
        <Pressable onPress={undoPoint} style={[styles.toolbarButton, !points.length && styles.disabledButton]} disabled={!points.length}>
          <MaterialCommunityIcons name="undo" color="white" size={18} />
          <Text style={styles.toolbarText}>Geri Al</Text>
        </Pressable>
        <Pressable onPress={deletePolygon} style={[styles.deleteButton, (!points.length && !task?.greenhouse_polygon) || deleting ? styles.disabledButton : null]} disabled={(!points.length && !task?.greenhouse_polygon) || deleting}>
          <MaterialCommunityIcons name="trash-can-outline" color="white" size={18} />
          <Text style={styles.toolbarText}>{deleting ? "Siliniyor" : "Sil"}</Text>
        </Pressable>
        <Pressable onPress={savePolygon} style={[styles.saveButton, (points.length < 3 || saving) && styles.disabledButton]} disabled={points.length < 3 || saving}>
          <MaterialCommunityIcons name="content-save-outline" color="white" size={18} />
          <Text style={styles.toolbarText}>{saving ? "Kaydediliyor" : "Kaydet"}</Text>
        </Pressable>
      </View>
      <BottomTabMenu />
    </View>
  );
}

function LayerRow({
  active,
  color,
  icon,
  onPress,
  subtitle,
  title,
}: {
  active: boolean;
  color: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  onPress: () => void;
  subtitle: string;
  title: string;
}) {
  return (
    <Pressable onPress={onPress} style={styles.layerRow}>
      <View style={[styles.layerSymbol, { borderColor: color }]}>
        <MaterialCommunityIcons name={icon} color={color} size={17} />
      </View>
      <View style={styles.layerTextWrap}>
        <Text style={styles.layerText}>{title}</Text>
        <Text style={styles.layerSubtitle} numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
      <View style={[styles.layerSwitch, active && styles.layerSwitchActive]}>
        <View style={[styles.layerSwitchKnob, active && styles.layerSwitchKnobActive]} />
      </View>
    </Pressable>
  );
}

function LegendRow({ color, title }: { color: string; title: string }) {
  return (
    <View style={styles.legendRow}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#020617",
  },
  center: {
    flex: 1,
    backgroundColor: "#020617",
    alignItems: "center",
    justifyContent: "center",
  },
  map: {
    flex: 1,
  },
  topBar: {
    position: "absolute",
    top: 48,
    left: 14,
    right: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: "rgba(15,23,42,0.82)",
    alignItems: "center",
    justifyContent: "center",
  },
  iconButtonActive: {
    borderWidth: 1,
    borderColor: "#22c55e",
  },
  topRightButtons: {
    flexDirection: "row",
    gap: 8,
  },
  counterPill: {
    minHeight: 40,
    borderRadius: 8,
    backgroundColor: "rgba(15,23,42,0.82)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  counterText: {
    color: "white",
    fontWeight: "800",
  },
  layerPanel: {
    position: "absolute",
    top: 102,
    right: 14,
    width: 292,
    maxHeight: "62%",
    borderRadius: 8,
    backgroundColor: "rgba(15,23,42,0.96)",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.35)",
    padding: 10,
    gap: 8,
  },
  layerPanelHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  layerPanelTitle: {
    color: "white",
    fontWeight: "800",
  },
  layerPanelCount: {
    color: "#94a3b8",
    fontSize: 11,
    fontWeight: "800",
  },
  layerList: {
    maxHeight: 430,
  },
  layerListContent: {
    gap: 8,
    paddingBottom: 2,
  },
  layerRow: {
    minHeight: 52,
    borderRadius: 8,
    backgroundColor: "rgba(17,24,39,0.92)",
    borderWidth: 1,
    borderColor: "rgba(30,41,59,0.95)",
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    paddingHorizontal: 9,
  },
  layerSymbol: {
    width: 29,
    height: 29,
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: "rgba(2,6,23,0.86)",
    alignItems: "center",
    justifyContent: "center",
  },
  layerTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  layerText: {
    color: "white",
    fontSize: 12,
    fontWeight: "800",
  },
  layerSubtitle: {
    color: "#94a3b8",
    fontSize: 10,
    fontWeight: "700",
    marginTop: 2,
  },
  layerSwitch: {
    width: 36,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#334155",
    padding: 3,
    justifyContent: "center",
  },
  layerSwitchActive: {
    backgroundColor: "#16a34a",
  },
  layerSwitchKnob: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "white",
  },
  layerSwitchKnobActive: {
    alignSelf: "flex-end",
  },
  legendRow: {
    minHeight: 28,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 4,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendText: {
    color: "#cbd5e1",
    fontSize: 12,
    fontWeight: "700",
  },
  legendBlock: {
    borderTopWidth: 1,
    borderTopColor: "rgba(148,163,184,0.22)",
    paddingTop: 6,
    gap: 2,
  },
  coordinatePanel: {
    position: "absolute",
    left: 14,
    right: 14,
    bottom: 154,
    borderRadius: 8,
    backgroundColor: "rgba(15,23,42,0.9)",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.25)",
    padding: 10,
    gap: 3,
  },
  coordinateTitle: {
    color: "white",
    fontSize: 12,
    fontWeight: "800",
  },
  coordinateText: {
    color: "#cbd5e1",
    fontSize: 11,
    fontWeight: "700",
  },
  bottomBar: {
    position: "absolute",
    left: 14,
    right: 14,
    bottom: 96,
    flexDirection: "row",
    gap: 8,
  },
  toolbarButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 8,
    backgroundColor: "#334155",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
  },
  deleteButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 8,
    backgroundColor: "#991b1b",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
  },
  saveButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 8,
    backgroundColor: "#16a34a",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
  },
  disabledButton: {
    opacity: 0.55,
  },
  toolbarText: {
    color: "white",
    fontWeight: "800",
  },
});
