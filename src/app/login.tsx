import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { signIn } from "../services/auth";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function login() {
    if (!email.trim() || !password) {
      Alert.alert("Bilgi eksik", "Bakanlık personel e-postası ve kurumsal şifrenizi girin.");
      return;
    }

    setLoading(true);

    try {
      const result = await signIn(email.trim(), password);

      if (result.error) {
        Alert.alert("Giriş yapılamadı", result.error.message);
        return;
      }

      router.replace("/(tabs)");
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      contentInsetAdjustmentBehavior="automatic"
    >
      <View style={styles.brandBlock}>
        <View style={styles.logo}>
          <MaterialCommunityIcons name="shield-account-outline" color="#bbf7d0" size={30} />
        </View>
        <Text style={styles.kicker}>Tarım ve Orman Bakanlığı</Text>
        <Text style={styles.title}>KOBÜDS</Text>
        <Text style={styles.subtitle}>Kapalı ortamda bitkisel üretim denetimleri için kurumsal saha girişi</Text>
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Kurumsal Giriş</Text>
          <Text style={styles.cardText}>Yalnızca bakanlık personel kaydında aktif görünen kullanıcılar oturum açabilir.</Text>
        </View>

        <Text style={styles.label}>Personel e-postası</Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="ad.soyad@tarimorman.gov.tr"
          placeholderTextColor="#64748b"
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          style={styles.input}
        />

        <Text style={styles.label}>Bakanlık şifresi</Text>
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder="Kurumsal şifre"
          secureTextEntry
          placeholderTextColor="#64748b"
          autoComplete="password"
          style={styles.input}
        />

        <Pressable onPress={login} style={styles.button} disabled={loading}>
          <MaterialCommunityIcons name="login" color="white" size={19} />
          <Text style={styles.buttonText}>{loading ? "Kontrol ediliyor..." : "Giriş Yap"}</Text>
        </Pressable>
      </View>

      <View style={styles.policyCard}>
        <MaterialCommunityIcons name="domain" color="#38bdf8" size={20} />
        <Text style={styles.policyText}>
          Bakanlık merkezi kimlik servisi hazır olduğunda bu giriş aynı ekran üzerinden SSO veya kurumsal parola doğrulamasına bağlanacak.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#020617",
  },
  content: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 22,
    gap: 18,
  },
  brandBlock: {
    gap: 6,
  },
  logo: {
    width: 58,
    height: 58,
    borderRadius: 8,
    backgroundColor: "#14532d",
    borderWidth: 1,
    borderColor: "#22c55e",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  kicker: {
    color: "#38bdf8",
    fontSize: 13,
    fontWeight: "800",
  },
  title: {
    color: "white",
    fontSize: 40,
    fontWeight: "800",
  },
  subtitle: {
    color: "#94a3b8",
    lineHeight: 20,
  },
  card: {
    backgroundColor: "#0f172a",
    borderRadius: 8,
    padding: 18,
    borderWidth: 1,
    borderColor: "#1e293b",
  },
  cardHeader: {
    gap: 5,
    marginBottom: 16,
  },
  cardTitle: {
    color: "white",
    fontSize: 20,
    fontWeight: "800",
  },
  cardText: {
    color: "#94a3b8",
    lineHeight: 19,
  },
  label: {
    color: "#cbd5e1",
    fontWeight: "800",
    marginBottom: 8,
  },
  input: {
    backgroundColor: "#111827",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#1e293b",
    padding: 15,
    color: "white",
    marginBottom: 14,
  },
  button: {
    minHeight: 52,
    backgroundColor: "#16a34a",
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    marginTop: 4,
  },
  buttonText: {
    color: "white",
    fontWeight: "800",
    fontSize: 16,
  },
  policyCard: {
    backgroundColor: "#082f49",
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: "#0ea5e9",
    flexDirection: "row",
    gap: 10,
  },
  policyText: {
    flex: 1,
    color: "#e0f2fe",
    lineHeight: 18,
  },
});
