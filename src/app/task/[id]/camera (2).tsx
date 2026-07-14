import { MaterialCommunityIcons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions, type CameraType } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from "react-native";

import { BottomTabMenu } from "../../../components/BottomTabMenu";
import { uploadTaskEvidencePhoto } from "../../../services/taskEvidence";

export default function TaskEvidenceCameraScreen() {
  const { id } = useLocalSearchParams();
  const taskId = String(Array.isArray(id) ? id[0] : id || "");
  const cameraRef = useRef<CameraView | null>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>("back");
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!permission) {
      requestPermission();
    }
  }, [permission, requestPermission]);

  async function takePhoto() {
    if (!cameraRef.current || saving) {
      return;
    }

    setSaving(true);

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.82,
        skipProcessing: false,
      });

      if (!photo?.uri) {
        throw new Error("Fotoğraf alınamadı.");
      }

      await uploadTaskEvidencePhoto(taskId, photo.uri);
      Alert.alert("Kanıt kaydedildi", "Fotoğraf ve konum bilgisi denetime eklendi.");
      router.replace(`/task/${taskId}` as any);
    } catch (error: any) {
      Alert.alert("Kanıt kaydedilemedi", error?.message || "Fotoğraf yüklenemedi.");
      setSaving(false);
    }
  }

  async function selectPhoto() {
    if (saving) {
      return;
    }

    setSaving(true);

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: "images",
        quality: 0.82,
      });

      if (result.canceled || !result.assets?.[0]?.uri) {
        setSaving(false);
        return;
      }

      await uploadTaskEvidencePhoto(taskId, result.assets[0].uri);
      Alert.alert("Kanıt kaydedildi", "Fotoğraf ve konum bilgisi denetime eklendi.");
      router.replace(`/task/${taskId}` as any);
    } catch (error: any) {
      Alert.alert("Kanıt kaydedilemedi", error?.message || "Fotoğraf yüklenemedi.");
      setSaving(false);
    }
  }

  if (!permission?.granted) {
    return (
      <View style={styles.permissionScreen}>
        <View style={styles.permissionIcon}>
          <MaterialCommunityIcons name="camera-lock-outline" color="#bbf7d0" size={32} />
        </View>
        <Text style={styles.permissionTitle}>Kamera izni gerekli</Text>
        <Text style={styles.permissionText}>Saha kanıtı çekebilmek için cihaz kamerasına erişim verin.</Text>
        <Pressable onPress={requestPermission} style={styles.permissionButton}>
          <Text style={styles.permissionButtonText}>İzin Ver</Text>
        </Pressable>
        <BottomTabMenu />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing={facing}
        enableTorch={torchEnabled}
        mirror={facing === "front"}
      />

      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} style={styles.iconButton} disabled={saving}>
          <MaterialCommunityIcons name="close" color="white" size={22} />
        </Pressable>
        <View style={styles.topTitleWrap}>
          <Text style={styles.kicker}>Saha kanıtı</Text>
          <Text style={styles.title}>Fotoğraf Çek</Text>
        </View>
        <Pressable onPress={() => setTorchEnabled((value) => !value)} style={styles.iconButton} disabled={saving}>
          <MaterialCommunityIcons name={torchEnabled ? "flashlight" : "flashlight-off"} color="white" size={21} />
        </Pressable>
      </View>

      <View style={styles.footer}>
        <View style={styles.captureHint}>
          <MaterialCommunityIcons name="map-marker-radius-outline" color="#bfdbfe" size={17} />
          <Text style={styles.captureHintText}>Fotoğraf GPS bilgisiyle denetime kaydedilir.</Text>
        </View>

        <View style={styles.controls}>
          <Pressable onPress={selectPhoto} style={styles.roundButton} disabled={saving}>
            <MaterialCommunityIcons name="image-outline" color="white" size={23} />
          </Pressable>

          <Pressable onPress={takePhoto} style={styles.captureButton} disabled={saving}>
            {saving ? <ActivityIndicator color="#020617" /> : <View style={styles.captureInner} />}
          </Pressable>

          <Pressable
            onPress={() => setFacing((value) => (value === "back" ? "front" : "back"))}
            style={styles.roundButton}
            disabled={saving}
          >
            <MaterialCommunityIcons name="camera-flip-outline" color="white" size={23} />
          </Pressable>
        </View>
      </View>
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
  topBar: {
    position: "absolute",
    top: 44,
    left: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  topTitleWrap: {
    flex: 1,
  },
  kicker: {
    color: "#bfdbfe",
    fontSize: 12,
    fontWeight: "800",
  },
  title: {
    color: "white",
    fontSize: 21,
    fontWeight: "800",
    marginTop: 2,
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 8,
    backgroundColor: "rgba(15,23,42,0.72)",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.28)",
    alignItems: "center",
    justifyContent: "center",
  },
  footer: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 96,
    gap: 18,
  },
  captureHint: {
    alignSelf: "center",
    maxWidth: 300,
    minHeight: 38,
    borderRadius: 8,
    paddingHorizontal: 12,
    backgroundColor: "rgba(15,23,42,0.78)",
    borderWidth: 1,
    borderColor: "rgba(96,165,250,0.38)",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  captureHintText: {
    color: "#dbeafe",
    fontWeight: "800",
    fontSize: 12,
  },
  controls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  roundButton: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: "rgba(15,23,42,0.72)",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.32)",
    alignItems: "center",
    justifyContent: "center",
  },
  roundButtonPlaceholder: {
    width: 54,
    height: 54,
  },
  captureButton: {
    width: 78,
    height: 78,
    borderRadius: 39,
    backgroundColor: "white",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 5,
    borderColor: "rgba(255,255,255,0.52)",
  },
  captureInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#e2e8f0",
  },
  permissionScreen: {
    flex: 1,
    backgroundColor: "#020617",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  permissionIcon: {
    width: 64,
    height: 64,
    borderRadius: 8,
    backgroundColor: "#14532d",
    borderWidth: 1,
    borderColor: "#22c55e",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  permissionTitle: {
    color: "white",
    fontSize: 22,
    fontWeight: "800",
  },
  permissionText: {
    color: "#94a3b8",
    lineHeight: 20,
    textAlign: "center",
    marginTop: 8,
  },
  permissionButton: {
    minHeight: 48,
    borderRadius: 8,
    backgroundColor: "#16a34a",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
    marginTop: 18,
  },
  permissionButtonText: {
    color: "white",
    fontWeight: "800",
  },
});
