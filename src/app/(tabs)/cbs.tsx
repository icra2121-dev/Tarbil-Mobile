import AsyncStorage from "@react-native-async-storage/async-storage";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { router, useLocalSearchParams } from "expo-router";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import MapView, { Callout, Marker, Polygon } from "react-native-maps";

import { RoleGate } from "../../components/RoleGate";
import {
  ANTALYA_REGION,
  CbsUnit,
  STATUS_COLOR,
  STATUS_LABEL,
  getCenter,
  loadCbsUnits,
} from "../../services/cbs";
import { canUseManagementScreens, getMyProfile } from "../../services/profile";
import { getLiveFieldLocations, type LiveFieldLocation } from "../../services/tracking";

const CACHE_KEY = "tarbil:cbs-units:v3";
const LOAD_TIMEOUT_MS = 15000;

type UserMapLocation = {
  latitude: number;
  longitude: number;
};

class CbsLoadTimeoutError extends Error {
  constructor(ms: number) {
    super(`CBS_LOAD_TIMEOUT:${ms}`);
    this.name = "CbsLoadTimeoutError";
  }
}

async function loadCachedUnits() {
  try {
    const cached = await AsyncStorage.getItem(CACHE_KEY);
    if (!cached) return null;

    const parsed = JSON.parse(cached);
    return Array.isArray(parsed) ? (parsed as CbsUnit[]) : null;
  } catch (error) {
    console.warn("CBS cache read failed, will fetch fresh data:", error);
    return null;
  }
}

async function cacheUnits(units: CbsUnit[]) {
  await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(units));
}

function createTimeoutRejection(ms: number) {
  return new Promise<never>((_, reject) => {
    setTimeout(() => reject(new CbsLoadTimeoutError(ms)), ms);
  });
}

function getHeadingDegree(heading: Location.LocationHeadingObject | null) {
  if (!heading) {
    return null;
  }

  const value = heading.trueHeading >= 0 ? heading.trueHeading : heading.magHeading;
  return Number.isFinite(value) ? value : null;
}

export default function CBSScreen() {
  return (
    <RoleGate>
      <CBSContent />
    </RoleGate>
  );
}

function CBSContent() {
  const params = useLocalSearchParams();
  const mapRef = useRef<MapView | null>(null);
  const markerRefs = useRef<Record<string, any>>({});
  const [units, setUnits] = useState<CbsUnit[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [loadIssue, setLoadIssue] = useState<"timeout" | "error" | null>(null);
  const [showParcels, setShowParcels] = useState(true);
  const [showGreenhouses, setShowGreenhouses] = useState(true);
  const [showMarkers, setShowMarkers] = useState(true);
  const [showStaffLocations, setShowStaffLocations] = useState(true);
  const [showLayerPanel, setShowLayerPanel] = useState(false);
  const [nearbyMode, setNearbyMode] = useState(false);
  const [openingAssignment, setOpeningAssignment] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [staffLocations, setStaffLocations] = useState<LiveFieldLocation[]>([]);
  const [userLocation, setUserLocation] = useState<UserMapLocation | null>(null);
  const [userHeading, setUserHeading] = useState<number | null>(null);
  const [locating, setLocating] = useState(false);
  const assignedTaskId = String(params.task_id || "");
  const assignedUnitNo = String(params.unit_no || "");
  const assignedAdaNo = String(params.ada_no || "");
  const assignedParcelNo = String(params.parcel_no || "");
  const management = canUseManagementScreens(profile);

  const filteredUnits = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("tr-TR");
    if (!needle) return units;

    return units.filter((unit) =>
      [
        unit.producerName,
        unit.registrationNo,
        unit.unitNo,
        unit.city,
        unit.district,
        unit.village,
        unit.adaNo,
        unit.parcelNo,
        unit.crop,
        STATUS_LABEL[unit.status],
      ]
        .join(" ")
        .toLocaleLowerCase("tr-TR")
        .includes(needle),
    );
  }, [query, units]);

  const visibleUnits = useMemo(() => {
    if (!nearbyMode) {
      return filteredUnits;
    }

    const selectedUnit = units.find((unit) => unit.id === selectedId);
    const anchor = selectedUnit ? getCenter(selectedUnit.greenhousePolygon) : ANTALYA_REGION;

    return [...filteredUnits]
      .sort((first, second) => distanceFrom(anchor, first) - distanceFrom(anchor, second))
      .slice(0, 8);
  }, [filteredUnits, nearbyMode, selectedId, units]);

  const safeStaffLocations = useMemo(
    () =>
      staffLocations.reduce<(LiveFieldLocation & { latitudeNumber: number; longitudeNumber: number })[]>((list, staff) => {
        const latitudeNumber = Number(staff.latitude);
        const longitudeNumber = Number(staff.longitude);

        if (Number.isFinite(latitudeNumber) && Number.isFinite(longitudeNumber)) {
          list.push({
            ...staff,
            latitudeNumber,
            longitudeNumber,
          });
        }

        return list;
      }, []),
    [staffLocations],
  );

  function isAssignedUnit(unit: CbsUnit) {
    if (!assignedTaskId) {
      return false;
    }

    return (
      (assignedUnitNo && unit.unitNo === assignedUnitNo) ||
      (assignedAdaNo && assignedParcelNo && unit.adaNo === assignedAdaNo && unit.parcelNo === assignedParcelNo)
    );
  }

  const focusUserLocation = useCallback(async (showAlert = true) => {
    setLocating(true);

    try {
      const permission = await Location.requestForegroundPermissionsAsync();

      if (!permission.granted) {
        if (showAlert) {
          Alert.alert("Konum izni gerekli", "CBS haritasında konumunuzu ve yönünüzü göstermek için konum izni verin.");
        }
        return;
      }

      const lastKnown = await Location.getLastKnownPositionAsync({ maxAge: 60000 });
      const position =
        lastKnown ||
        (await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        }));
      const heading = await Location.getHeadingAsync().catch(() => null);
      const coordinate = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      };
      const nextHeading = getHeadingDegree(heading);

      setUserLocation(coordinate);
      setUserHeading(nextHeading);
      mapRef.current?.animateCamera(
        {
          center: coordinate,
          heading: nextHeading || 0,
          zoom: 16,
        },
        { duration: 500 },
      );
    } catch (error: any) {
      if (showAlert) {
        Alert.alert("Konum alınamadı", error?.message || "Cihaz konumu okunamadı.");
      }
    } finally {
      setLocating(false);
    }
  }, []);

  const loadUnits = useCallback(async () => {
    setLoading(true);

    try {
      const nextUnits = await Promise.race([loadCbsUnits(), createTimeoutRejection(LOAD_TIMEOUT_MS)]);

      setUnits(nextUnits);
      setSelectedId((current) => (current && nextUnits.some((unit) => unit.id === current) ? current : null));
      setOffline(false);
      setLoadIssue(null);
      await cacheUnits(nextUnits).catch((error) => {
        console.warn("CBS cache write failed (non-fatal):", error);
      });
    } catch (error: unknown) {
      const cached = await loadCachedUnits();
      const fallback = cached?.length ? cached : [];
      const timeout = error instanceof CbsLoadTimeoutError;

      setUnits(fallback);
      setSelectedId((current) => (current && fallback.some((unit) => unit.id === current) ? current : null));
      setOffline(true);
      setLoadIssue(timeout ? "timeout" : "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // `loadUnits` sets local state immediately; defer one tick to satisfy
    // react-hooks/set-state-in-effect lint rule and avoid sync state updates in effect body.
    const timer = setTimeout(() => {
      void loadUnits();
    }, 0);

    return () => {
      clearTimeout(timer);
    };
  }, [loadUnits]);

  useEffect(() => {
    getMyProfile()
      .then(setProfile)
      .catch(() => setProfile(null));
  }, []);

  useEffect(() => {
    let active = true;

    const refreshStaffLocations = () => {
      getLiveFieldLocations()
        .then((locations) => {
          if (active) {
            setStaffLocations(management ? locations : []);
          }
        })
        .catch(() => {
          if (active) {
            setStaffLocations([]);
          }
        });
    };

    refreshStaffLocations();
    const timer = setInterval(refreshStaffLocations, 20000);

    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [management]);

  useEffect(() => {
    let active = true;

    Location.getForegroundPermissionsAsync()
      .then((permission) => {
        if (active && permission.granted) {
          focusUserLocation(false);
        }
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, [focusUserLocation]);

  const focusUnit = useCallback((unit: CbsUnit, animate = true) => {
    const center = getCenter(unit.greenhousePolygon);
    const nextRegion = {
      latitude: center.latitude,
      longitude: center.longitude,
      latitudeDelta: 0.016,
      longitudeDelta: 0.016,
    };

    setSelectedId(unit.id);

    if (animate) {
      mapRef.current?.animateToRegion(nextRegion, 450);
    }

    setTimeout(() => {
      markerRefs.current[unit.id]?.showCallout?.();
    }, animate ? 480 : 80);
  }, []);

  function canToggleLayer(nextParcels: boolean, nextGreenhouses: boolean, nextMarkers: boolean) {
    if (!nextParcels && !nextGreenhouses && !nextMarkers) {
      Alert.alert("Katman gerekli", "Haritada en az bir CBS katmanı açık kalmalı.");
      return false;
    }

    return true;
  }

  function toggleParcels() {
    const nextValue = !showParcels;
    if (!canToggleLayer(nextValue, showGreenhouses, showMarkers)) {
      return;
    }

    setShowParcels(nextValue);
  }

  function toggleGreenhouses() {
    const nextValue = !showGreenhouses;
    if (!canToggleLayer(showParcels, nextValue, showMarkers)) {
      return;
    }

    setShowGreenhouses(nextValue);
  }

  function toggleMarkers() {
    const nextValue = !showMarkers;
    if (!canToggleLayer(showParcels, showGreenhouses, nextValue)) {
      return;
    }

    setShowMarkers(nextValue);
  }

  useEffect(() => {
    if (!units.length || (!assignedUnitNo && !assignedAdaNo && !assignedParcelNo)) {
      return;
    }

    const match = units.find(
      (unit) =>
        (assignedUnitNo && unit.unitNo === assignedUnitNo) ||
        (assignedAdaNo && assignedParcelNo && unit.adaNo === assignedAdaNo && unit.parcelNo === assignedParcelNo),
    );

    if (match) {
      setTimeout(() => focusUnit(match), 0);
    }
  }, [assignedAdaNo, assignedParcelNo, assignedUnitNo, focusUnit, units]);

  async function openAssignmentScreen(unit: CbsUnit) {
    if (openingAssignment) {
      return;
    }

    setOpeningAssignment(true);

    try {
      const taskId = params.task_id ? String(params.task_id) : "";

      if (taskId) {
        router.push(`/task/${taskId}` as any);
        return;
      }

      if (!management) {
        Alert.alert("Atanmış görev gerekli", "Denetim işlemi yalnızca size atanmış görev üzerinden başlatılır.");
        return;
      }

      const center = getCenter(unit.greenhousePolygon);

      router.push({
        pathname: "/new-task",
        params: {
          workflow: String(params.workflow || "inspection"),
          tc_no: unit.producerTc,
          producer_name: unit.producerName,
          phone: unit.producerPhone || "",
          city: unit.city,
          district_name: unit.district,
          village: unit.village,
          ada_no: unit.adaNo,
          parcel_no: unit.parcelNo,
          detected_crop: unit.crop,
          unit_no: unit.unitNo,
          greenhouse_area: String(unit.greenhouseArea || ""),
          latitude: String(center.latitude),
          longitude: String(center.longitude),
          parcel_polygon: JSON.stringify(unit.parcelPolygon),
          greenhouse_polygon: JSON.stringify(unit.greenhousePolygon),
        },
      } as any);
    } catch (error: any) {
      Alert.alert("Görevlendirme ekranı açılamadı", error?.message || "Kayıt oluşturulamadı.");
    } finally {
      setOpeningAssignment(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#22c55e" size="large" />
        <Text style={styles.loadingText}>CBS katmanları yükleniyor...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      contentInsetAdjustmentBehavior="automatic"
    >
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.kicker}>CBS merkezi</Text>
          <Text style={styles.title}>Sera Haritası</Text>
          <Text style={styles.subtitle}>Üniteye dokununca bilgi kartı açılır; karttan görevlendirme ekranına geçilir.</Text>
        </View>
        <View style={styles.headerIcon}>
          <MaterialCommunityIcons name="map-marker-radius-outline" color="#bbf7d0" size={24} />
        </View>
      </View>

      <View style={styles.searchRow}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Ünite, üretici, ada/parsel veya ilçe ara"
          placeholderTextColor="#64748b"
          style={styles.search}
        />
        <Pressable onPress={loadUnits} style={styles.iconButton}>
          <MaterialCommunityIcons name="refresh" color="white" size={20} />
        </Pressable>
      </View>

      <View style={styles.mapToolbarHeader}>
        <View>
          <Text style={styles.toolbarTitle}>Harita</Text>
          <Text style={styles.toolbarMeta}>
            {visibleUnits.length} ünite gösteriliyor{nearbyMode ? " · yakındaki görünüm" : ""}
          </Text>
        </View>
        <Pressable
          onPress={() => {
            setQuery("");
            setNearbyMode(false);
            setSelectedId(null);
          }}
          style={styles.clearMapButton}
        >
          <MaterialCommunityIcons name="map-marker-off-outline" color="#cbd5e1" size={17} />
        </Pressable>
      </View>

      {offline ? (
        <View style={styles.warning}>
          <Text style={styles.warningText}>
            {loadIssue === "timeout"
              ? "CBS verisi zamanında alınamadı. Önbellekteki kayıtlar gösteriliyor."
              : "Çevrimdışı kayıtlar gösteriliyor. Bağlantı gelince CBS verileri yenilenir."}
          </Text>
        </View>
      ) : null}

      {assignedTaskId ? (
        <View style={styles.assignedNotice}>
          <MaterialCommunityIcons name="map-marker-check-outline" color="#bfdbfe" size={18} />
          <Text style={styles.assignedNoticeText}>
            Admin tarafından atanan görev haritada mavi işaretlidir. Seraya dokunun, açılan karttan görev detayına geçin.
          </Text>
        </View>
      ) : null}

      <View style={styles.mapCard}>
        <MapView
          ref={mapRef}
          style={styles.map}
          initialRegion={ANTALYA_REGION}
          scrollEnabled
          zoomEnabled
          zoomControlEnabled
          rotateEnabled
          showsCompass
        >
          {visibleUnits.map((unit) => {
            const assigned = isAssignedUnit(unit);
            const selected = selectedId === unit.id;
            const unitColor = assigned ? "#2563eb" : selected ? "#eab308" : STATUS_COLOR[unit.status];
            const openUnitCard = () => focusUnit(unit);

            return (
              <Fragment key={unit.id}>
                {showParcels ? (
                  <Polygon
                    coordinates={unit.parcelPolygon}
                    strokeColor={assigned ? "#60a5fa" : "#38bdf8"}
                    fillColor={assigned ? "rgba(37,99,235,0.18)" : "rgba(56,189,248,0.16)"}
                    strokeWidth={assigned || selected ? 3 : 2}
                    tappable
                    onPress={openUnitCard}
                  />
                ) : null}
                {showGreenhouses ? (
                  <Polygon
                    coordinates={unit.greenhousePolygon}
                    strokeColor={unitColor}
                    fillColor={`${unitColor}33`}
                    strokeWidth={assigned || selected ? 3 : 2}
                    tappable
                    onPress={openUnitCard}
                  />
                ) : null}
                {showMarkers ? (
                  <Marker
                    ref={(ref) => {
                      if (ref) {
                        markerRefs.current[unit.id] = ref;
                      } else {
                        delete markerRefs.current[unit.id];
                      }
                    }}
                    coordinate={getCenter(unit.greenhousePolygon)}
                    pinColor={unitColor}
                    onPress={openUnitCard}
                  >
                    <Callout tooltip onPress={() => openAssignmentScreen(unit)}>
                      <View style={[styles.unitCallout, assigned && styles.unitCalloutAssigned]}>
                        <View style={styles.unitCalloutHeader}>
                          <View>
                            <Text style={styles.unitCalloutKicker}>{assigned ? "Atanan görev" : STATUS_LABEL[unit.status]}</Text>
                            <Text style={styles.unitCalloutTitle}>{unit.unitNo || "Ünite"}</Text>
                          </View>
                          <MaterialCommunityIcons name="chevron-right" color="#cbd5e1" size={20} />
                        </View>
                        <Text style={styles.unitCalloutText} numberOfLines={1}>
                          {unit.producerName || "-"} · {unit.crop || "-"}
                        </Text>
                        <Text style={styles.unitCalloutMeta} numberOfLines={1}>
                          {unit.district || "-"} / {unit.village || "-"} · {unit.adaNo || "-"}/{unit.parcelNo || "-"}
                        </Text>
                      </View>
                    </Callout>
                  </Marker>
                ) : null}
              </Fragment>
            );
          })}
          {userLocation ? (
            <Marker coordinate={userLocation} anchor={{ x: 0.5, y: 0.5 }}>
              <View style={styles.userLocationMarker}>
                <View style={[styles.userDirectionMarker, { transform: [{ rotate: `${userHeading || 0}deg` }] }]}>
                  <MaterialCommunityIcons name="navigation" color="white" size={18} />
                </View>
              </View>
            </Marker>
          ) : null}
          {management && showStaffLocations
            ? safeStaffLocations.map((staff) => (
                <Marker
                  key={String(staff.user_id)}
                  coordinate={{
                    latitude: staff.latitudeNumber,
                    longitude: staff.longitudeNumber,
                  }}
                  anchor={{ x: 0.5, y: 0.5 }}
                >
                  <View style={styles.staffMarker}>
                    <MaterialCommunityIcons name="account-hard-hat-outline" color="white" size={17} />
                  </View>
                  <Callout tooltip>
                    <View style={styles.staffCallout}>
                      <Text style={styles.staffCalloutTitle}>{staff.full_name || "Saha personeli"}</Text>
                      <Text style={styles.staffCalloutMeta}>{formatLiveLocationTime(staff.updated_at)}</Text>
                    </View>
                  </Callout>
                </Marker>
              ))
            : null}
        </MapView>
        <View style={styles.mapControlStack}>
          <Pressable
            accessibilityLabel="Konum ve yön"
            onPress={() => focusUserLocation()}
            style={[styles.locationButton, locating && styles.locationButtonActive]}
          >
            {locating ? (
              <ActivityIndicator color="#2563eb" size="small" />
            ) : (
              <MaterialCommunityIcons name="crosshairs-gps" color="#2563eb" size={23} />
            )}
          </Pressable>
        </View>
        <View style={styles.layerControl}>
          <Pressable
            accessibilityLabel="Harita katmanları"
            onPress={() => setShowLayerPanel((value) => !value)}
            style={[styles.layerControlButton, showLayerPanel && styles.layerControlButtonActive]}
          >
            <MaterialCommunityIcons name="layers-outline" color={showLayerPanel ? "#16a34a" : "#1f2937"} size={24} />
          </Pressable>
          {showLayerPanel ? (
            <View style={styles.layerPanel}>
              <View style={styles.layerPanelHeader}>
                <Text style={styles.layerPanelTitle}>Katmanlar</Text>
                <Text style={styles.layerPanelCount}>4 ana durum</Text>
              </View>
              <LayerPanelRow
                active={showParcels}
                color="#38bdf8"
                icon="shape-polygon-plus"
                title="TKGM Parseller"
                subtitle="Parsel sınırları"
                onPress={toggleParcels}
              />
              <LayerPanelRow
                active={showGreenhouses}
                color="#22c55e"
                icon="greenhouse"
                title="KOBÜKS Seralar"
                subtitle="Kapalı üretim alanları"
                onPress={toggleGreenhouses}
              />
              <LayerPanelRow
                active={showMarkers}
                color="#2563eb"
                icon="map-marker-radius-outline"
                title="Ünite Noktaları"
                subtitle="Bilgi kartı işaretleri"
                onPress={toggleMarkers}
              />
              <LayerPanelRow
                active={nearbyMode}
                color="#f59e0b"
                icon="crosshairs-gps"
                title="Yakındaki Üniteler"
                subtitle="En yakın 8 kayıt"
                onPress={() => setNearbyMode((value) => !value)}
              />
              {management ? (
                <LayerPanelRow
                  active={showStaffLocations}
                  color="#a855f7"
                  icon="account-hard-hat-outline"
                  title="Sahadaki Personel"
                  subtitle={`${safeStaffLocations.length} aktif konum`}
                  onPress={() => setShowStaffLocations((value) => !value)}
                />
              ) : null}
              <LayerLegendRow color="#22c55e" icon="greenhouse" title="Kayıtlı sera" />
              <LayerLegendRow color="#38bdf8" icon="map-marker-check-outline" title="Denetime gidilecek" />
              <LayerLegendRow color="#f59e0b" icon="alert-circle-outline" title="Eksik bilgi" />
              <LayerLegendRow color="#ef4444" icon="alert-octagon-outline" title="Riskli sera" />
            </View>
          ) : null}
        </View>
      </View>
    </ScrollView>
  );
}

function distanceFrom(anchor: { latitude: number; longitude: number }, unit: CbsUnit) {
  const center = getCenter(unit.greenhousePolygon);
  return Math.hypot(center.latitude - anchor.latitude, center.longitude - anchor.longitude);
}

function formatLiveLocationTime(value?: string) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleTimeString("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function LayerPanelRow({
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
  onPress?: () => void;
  subtitle: string;
  title: string;
}) {
  return (
    <Pressable onPress={onPress} style={styles.layerPanelRow}>
      <View style={[styles.layerSymbol, { borderColor: color }]}>
        <MaterialCommunityIcons name={icon} color={color} size={17} />
      </View>
      <View style={styles.layerPanelText}>
        <Text style={styles.layerPanelName}>{title}</Text>
        <Text style={styles.layerPanelMeta}>{subtitle}</Text>
      </View>
      <View style={[styles.layerSwitch, active && styles.layerSwitchActive]}>
        <View style={[styles.layerSwitchKnob, active && styles.layerSwitchKnobActive]} />
      </View>
    </Pressable>
  );
}

function LayerLegendRow({
  color,
  icon,
  title,
}: {
  color: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  title: string;
}) {
  return (
    <View style={styles.layerLegendRow}>
      <View style={[styles.layerSymbol, { borderColor: color }]}>
        <MaterialCommunityIcons name={icon} color={color} size={17} />
      </View>
      <Text style={styles.layerPanelName}>{title}</Text>
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
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#020617",
  },
  loadingText: {
    color: "#cbd5e1",
    marginTop: 12,
    fontWeight: "700",
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
  searchRow: {
    flexDirection: "row",
    gap: 8,
  },
  search: {
    flex: 1,
    minHeight: 46,
    backgroundColor: "#0f172a",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#1e293b",
    color: "white",
    paddingHorizontal: 12,
  },
  iconButton: {
    width: 48,
    borderRadius: 8,
    backgroundColor: "#2563eb",
    alignItems: "center",
    justifyContent: "center",
  },
  mapToolbarHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 2,
  },
  toolbarTitle: {
    color: "white",
    fontSize: 16,
    fontWeight: "800",
  },
  toolbarMeta: {
    color: "#94a3b8",
    marginTop: 3,
    fontSize: 12,
    fontWeight: "700",
  },
  clearMapButton: {
    width: 40,
    minHeight: 38,
    borderRadius: 8,
    backgroundColor: "#111827",
    borderWidth: 1,
    borderColor: "#1e293b",
    alignItems: "center",
    justifyContent: "center",
  },
  warning: {
    backgroundColor: "#422006",
    borderWidth: 1,
    borderColor: "#92400e",
    borderRadius: 8,
    padding: 10,
  },
  warningText: {
    color: "#fed7aa",
    fontSize: 12,
    fontWeight: "700",
  },
  assignedNotice: {
    backgroundColor: "#172554",
    borderWidth: 1,
    borderColor: "#2563eb",
    borderRadius: 8,
    padding: 10,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  assignedNoticeText: {
    flex: 1,
    color: "#dbeafe",
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 17,
  },
  mapCard: {
    height: 520,
    borderRadius: 8,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#1e293b",
  },
  map: {
    flex: 1,
  },
  mapControlStack: {
    position: "absolute",
    left: 12,
    top: 12,
  },
  locationButton: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.96)",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  locationButtonActive: {
    opacity: 0.82,
  },
  layerControl: {
    position: "absolute",
    right: 12,
    top: 12,
    alignItems: "flex-end",
    gap: 8,
  },
  layerControlButton: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.96)",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  layerControlButtonActive: {
    borderColor: "rgba(22,163,74,0.75)",
  },
  layerPanel: {
    width: 248,
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
    gap: 10,
    paddingBottom: 2,
  },
  layerPanelTitle: {
    color: "white",
    fontWeight: "800",
  },
  layerPanelCount: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: "800",
  },
  layerPanelRow: {
    minHeight: 48,
    borderRadius: 8,
    backgroundColor: "rgba(17,24,39,0.92)",
    borderWidth: 1,
    borderColor: "rgba(30,41,59,0.95)",
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    paddingHorizontal: 9,
  },
  layerLegendRow: {
    minHeight: 38,
    borderRadius: 8,
    backgroundColor: "rgba(17,24,39,0.72)",
    borderWidth: 1,
    borderColor: "rgba(30,41,59,0.78)",
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
  layerPanelText: {
    flex: 1,
  },
  layerPanelName: {
    color: "white",
    fontSize: 12,
    fontWeight: "800",
  },
  layerPanelMeta: {
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
  userLocationMarker: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(37,99,235,0.2)",
    borderWidth: 1,
    borderColor: "rgba(96,165,250,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  userDirectionMarker: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#2563eb",
    borderWidth: 2,
    borderColor: "white",
    alignItems: "center",
    justifyContent: "center",
  },
  staffMarker: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#7c3aed",
    borderWidth: 2,
    borderColor: "white",
    alignItems: "center",
    justifyContent: "center",
  },
  staffCallout: {
    minWidth: 150,
    borderRadius: 8,
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "#334155",
    padding: 10,
  },
  staffCalloutTitle: {
    color: "white",
    fontWeight: "800",
  },
  staffCalloutMeta: {
    color: "#94a3b8",
    marginTop: 3,
    fontSize: 12,
  },
  unitCallout: {
    width: 260,
    borderRadius: 8,
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "#334155",
    padding: 12,
    gap: 6,
  },
  unitCalloutAssigned: {
    borderColor: "#60a5fa",
    backgroundColor: "#172554",
  },
  unitCalloutHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  unitCalloutKicker: {
    color: "#38bdf8",
    fontSize: 11,
    fontWeight: "800",
  },
  unitCalloutTitle: {
    color: "white",
    fontSize: 17,
    fontWeight: "800",
    marginTop: 2,
  },
  unitCalloutText: {
    color: "#cbd5e1",
    fontWeight: "700",
  },
  unitCalloutMeta: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: "700",
  },
});
