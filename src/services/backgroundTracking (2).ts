import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";

import { supabase } from "../lib/supabase";

const TASK_NAME = "background-location-task";

TaskManager.defineTask(TASK_NAME, async ({ data, error }) => {
  if (error) {
    return;
  }

  const taskData = data as { locations?: Location.LocationObject[] };
  const location = taskData.locations?.[0];

  if (!location) {
    return;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return;
  }

  await supabase.from("live_locations").upsert(
    {
      user_id: user.id,
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      heading: location.coords.heading ?? null,
      accuracy: location.coords.accuracy ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
});

export async function startBackgroundTracking() {
  const foreground = await Location.requestForegroundPermissionsAsync();

  if (foreground.status !== "granted") {
    return;
  }

  const background = await Location.requestBackgroundPermissionsAsync();

  if (background.status !== "granted") {
    return;
  }

  const started = await Location.hasStartedLocationUpdatesAsync(TASK_NAME);

  if (started) {
    return;
  }

  await Location.startLocationUpdatesAsync(TASK_NAME, {
    accuracy: Location.Accuracy.Balanced,
    timeInterval: 15000,
    distanceInterval: 20,
    foregroundService: {
      notificationTitle: "KOBÜDS",
      notificationBody: "Saha konumu izleniyor",
    },
  });
}
