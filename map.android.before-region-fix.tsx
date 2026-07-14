import { useEffect, useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import MapView, { Marker } from "react-native-maps";

import { supabase } from "./src/lib/supabase";

export default function MapScreenBackup() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [workers, setWorkers] = useState<any[]>([]);

  useEffect(() => {
    loadTasks();
    loadWorkers();

    const interval = setInterval(() => {
      loadTasks();
      loadWorkers();
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  async function loadTasks() {
    const result = await supabase.from("tasks").select("*").not("latitude", "is", null);
    setTasks(result.data || []);
  }

  async function loadWorkers() {
    const result = await supabase.from("live_locations").select("*");
    setWorkers(result.data || []);
  }

  return (
    <View style={{ flex: 1 }}>
      <MapView
        style={{ flex: 1 }}
        initialRegion={{
          latitude: 39,
          longitude: 35,
          latitudeDelta: 8,
          longitudeDelta: 8,
        }}
      >
        {tasks.map((task) => (
          <Marker
            key={`task-${task.id}`}
            coordinate={{ latitude: task.latitude, longitude: task.longitude }}
            title={task.detected_crop || "Görev"}
            description={`Ada:${task.ada_no || "-"} Parsel:${task.parcel_no || "-"}`}
            pinColor={task.compliance_result === "Uyumlu" ? "green" : task.compliance_result === "Uyumsuz" ? "red" : "orange"}
            onCalloutPress={() => router.push(`/task/${task.id}`)}
          />
        ))}

        {workers.map((worker) => (
          <Marker
            key={`worker-${worker.id}`}
            coordinate={{ latitude: worker.latitude, longitude: worker.longitude }}
            title="Saha Ekibi"
            pinColor="blue"
          />
        ))}
      </MapView>
    </View>
  );
}
