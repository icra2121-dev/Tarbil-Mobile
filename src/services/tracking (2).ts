import * as Location from "expo-location";

import { supabase } from "../lib/supabase";
import { getMyProfile } from "./profile";

export type LiveFieldLocation = {
  id?: string;
  user_id: string;
  full_name?: string;
  role?: string;
  latitude: number;
  longitude: number;
  heading?: number | null;
  accuracy?: number | null;
  updated_at?: string;
};

let watchSubscription: Location.LocationSubscription | null = null;

async function writeLiveLocation(location: Location.LocationObject) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return;
  }

  const profile = await getMyProfile().catch(() => null);
  const payload = {
    user_id: user.id,
    full_name: profile?.full_name || profile?.email || null,
    role: profile?.role || null,
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
    heading: location.coords.heading ?? null,
    accuracy: location.coords.accuracy ?? null,
    updated_at: new Date().toISOString(),
  };

  const result = await supabase.from("live_locations").upsert(payload, { onConflict: "user_id" });

  if (result.error) {
    await supabase.from("live_locations").insert(payload);
  }
}

export async function startLiveTracking() {
  if (watchSubscription) {
    return;
  }

  const permission = await Location.requestForegroundPermissionsAsync();

  if (permission.status !== "granted") {
    return;
  }

  const current = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  }).catch(() => null);

  if (current) {
    await writeLiveLocation(current);
  }

  watchSubscription = await Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.Balanced,
      timeInterval: 15000,
      distanceInterval: 20,
    },
    (location) => {
      writeLiveLocation(location).catch(() => undefined);
    },
  );
}

export async function stopLiveTracking() {
  watchSubscription?.remove();
  watchSubscription = null;
}

export async function getLiveFieldLocations(): Promise<LiveFieldLocation[]> {
  const since = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  const result = await supabase
    .from("live_locations")
    .select("*")
    .gte("updated_at", since)
    .order("updated_at", { ascending: false });

  if (result.error) {
    return [];
  }

  return (result.data || []).filter((item) => Number.isFinite(Number(item.latitude)) && Number.isFinite(Number(item.longitude)));
}
