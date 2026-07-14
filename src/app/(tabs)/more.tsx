import { router } from "expo-router";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { signOut } from "../../services/auth";

export default function MoreScreen() {
  async function logout() {
    await signOut();
    router.replace("/login");
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Diğer</Text>
      <Text style={styles.subtitle}>Sistem ve kullanıcı işlemleri</Text>

      <View style={styles.menu}>
        <MenuItem title="Profil" text="Kullanıcı bilgileri ve rol" onPress={() => router.push("/profile")} />
        <MenuItem title="Raporlar" text="Ek-8 ve saha denetim çıktıları" onPress={() => router.push("/reports" as any)} />
        <MenuItem title="Ayarlar" text="Bildirim, konum ve çevrimdışı ayarlar" onPress={() => Alert.alert("Ayarlar", "Ayarlar modülü hazırlanıyor.")} />
        <MenuItem
          title="Hakkında"
          text="Tarım ve Orman Bakanlığı saha denetim sistemi"
          onPress={() => Alert.alert("KOBÜDS", "Tarım ve Orman Bakanlığı Kapalı Ortamda Bitkisel Üretim Denetim Sistemi")}
        />
      </View>

      <Pressable onPress={logout} style={styles.logout}>
        <Text style={styles.logoutText}>Çıkış Yap</Text>
      </Pressable>
    </ScrollView>
  );
}

function MenuItem({ title, text, onPress }: { title: string; text: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.item}>
      <View>
        <Text style={styles.itemTitle}>{title}</Text>
        <Text style={styles.itemText}>{text}</Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
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
  },
  title: {
    color: "white",
    fontSize: 30,
    fontWeight: "800",
  },
  subtitle: {
    color: "#94a3b8",
    marginTop: 6,
    marginBottom: 18,
  },
  menu: {
    gap: 10,
  },
  item: {
    minHeight: 76,
    backgroundColor: "#0f172a",
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: "#1e293b",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  itemTitle: {
    color: "white",
    fontSize: 17,
    fontWeight: "800",
  },
  itemText: {
    color: "#94a3b8",
    marginTop: 4,
  },
  chevron: {
    color: "#38bdf8",
    fontSize: 28,
    fontWeight: "800",
  },
  logout: {
    marginTop: 24,
    minHeight: 54,
    borderRadius: 8,
    backgroundColor: "#dc2626",
    alignItems: "center",
    justifyContent: "center",
  },
  logoutText: {
    color: "white",
    fontSize: 16,
    fontWeight: "800",
  },
});
