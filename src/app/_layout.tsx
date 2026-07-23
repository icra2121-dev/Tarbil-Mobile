import {
  Stack,
} from "expo-router";

import {
  useEffect,
} from "react";

import {
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  isSupabaseConfigured,
} from "../lib/supabase";

import {
  startOfflineSyncListener,
} from "../services/sync";



export default function RootLayout() {

  useEffect(() => {

  if (!isSupabaseConfigured) {
    return;
  }

  const stopOfflineSync = startOfflineSyncListener();

  // startLiveTracking();

  // startBackgroundTracking();

  return stopOfflineSync;

}, []);

  if (!isSupabaseConfigured) {
    return (
      <View style={styles.errorScreen}>
        <Text style={styles.errorTitle}>Yapılandırma Eksik</Text>
        <Text style={styles.errorBody}>
          Uygulama başlatılamadı. Gerekli ortam değişkenleri (EXPO_PUBLIC_SUPABASE_URL,
          EXPO_PUBLIC_SUPABASE_ANON_KEY) bu APK derlemesinde tanımlanmamış.
          Lütfen EAS build sırasında bu değerleri sağlayın.
        </Text>
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerShown:false,
      }}
    />
  );
}

const styles = StyleSheet.create({
  errorScreen: {
    flex: 1,
    backgroundColor: "#020617",
    alignItems: "center",
    justifyContent: "center",
    padding: 28,
    gap: 16,
  },
  errorTitle: {
    color: "#f87171",
    fontSize: 22,
    fontWeight: "800",
    textAlign: "center",
  },
  errorBody: {
    color: "#94a3b8",
    fontSize: 14,
    lineHeight: 22,
    textAlign: "center",
  },
});
