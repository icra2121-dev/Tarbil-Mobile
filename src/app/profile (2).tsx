import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";

import { BottomTabMenu } from "../components/BottomTabMenu";
import { getMyProfile } from "../services/profile";

function displayValue(value: unknown) {
  return String(value || "-");
}

export default function ProfileScreen() {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    getMyProfile()
      .then((result) => {
        if (active) {
          setProfile(result);
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
  }, []);

  const initials = useMemo(() => {
    const name = profile?.full_name || profile?.email || "K";
    return String(name)
      .split(" ")
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toLocaleUpperCase("tr-TR");
  }, [profile]);

  if (loading) {
    return (
      <View style={styles.root}>
        <View style={styles.center}>
          <ActivityIndicator color="#22c55e" />
          <Text style={styles.loadingText}>Profil yükleniyor...</Text>
        </View>
        <BottomTabMenu />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={styles.root}>
        <View style={styles.center}>
          <Text style={styles.loadingText}>Profil bilgisi bulunamadı.</Text>
        </View>
        <BottomTabMenu />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic">
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <View style={styles.headerText}>
          <Text style={styles.kicker}>Bakanlık personel kaydı</Text>
          <Text style={styles.title}>{displayValue(profile.full_name || profile.email)}</Text>
          <Text style={styles.subtitle}>{displayValue(profile.title || profile.role)}</Text>
        </View>
      </View>

      <View style={styles.card}>
        <ProfileRow icon="email-outline" label="E-posta" value={profile.email} />
        <ProfileRow icon="shield-account-outline" label="Rol" value={profile.title || profile.role} />
        <ProfileRow icon="map-marker-radius-outline" label="İl / İlçe" value={[profile.city, profile.district].filter(Boolean).join(" / ")} />
        <ProfileRow icon="domain" label="Birim" value={profile.work_office || profile.office_name || profile.institution_name} />
        <ProfileRow icon="identifier" label="Kullanıcı ID" value={profile.id} compact />
      </View>
      </ScrollView>
      <BottomTabMenu />
    </View>
  );
}

function ProfileRow({
  compact,
  icon,
  label,
  value,
}: {
  compact?: boolean;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  value: unknown;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.rowIcon}>
        <MaterialCommunityIcons name={icon} color="#38bdf8" size={18} />
      </View>
      <View style={styles.rowBody}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={[styles.rowValue, compact && styles.compactValue]} numberOfLines={compact ? 2 : 1}>
          {displayValue(value)}
        </Text>
      </View>
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
    gap: 14,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#020617",
  },
  loadingText: {
    color: "#cbd5e1",
    marginTop: 10,
    fontWeight: "700",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: 8,
    backgroundColor: "#14532d",
    borderWidth: 1,
    borderColor: "#22c55e",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: "#bbf7d0",
    fontWeight: "800",
    fontSize: 17,
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
    fontSize: 25,
    fontWeight: "800",
    marginTop: 2,
  },
  subtitle: {
    color: "#94a3b8",
    marginTop: 3,
    fontWeight: "700",
  },
  card: {
    backgroundColor: "#0f172a",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#1e293b",
    padding: 14,
    gap: 10,
  },
  row: {
    minHeight: 54,
    borderRadius: 8,
    backgroundColor: "#111827",
    borderWidth: 1,
    borderColor: "#1e293b",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 10,
  },
  rowIcon: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: "#082f49",
    alignItems: "center",
    justifyContent: "center",
  },
  rowBody: {
    flex: 1,
  },
  rowLabel: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: "800",
  },
  rowValue: {
    color: "white",
    fontWeight: "800",
    marginTop: 3,
  },
  compactValue: {
    fontSize: 12,
    lineHeight: 17,
  },
});
