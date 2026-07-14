import * as Location from "expo-location";

import { supabase } from "../lib/supabase";
import { enqueueOfflineOperation, isDeviceOnline, isNetworkError } from "./offline";

type EvidenceLocation = {
  latitude: number | null;
  longitude: number | null;
};

async function getEvidenceLocation(): Promise<EvidenceLocation> {
  try {
    const permission = await Location.requestForegroundPermissionsAsync();

    if (!permission.granted) {
      return {
        latitude: null,
        longitude: null,
      };
    }

    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });

    return {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
    };
  } catch {
    return {
      latitude: null,
      longitude: null,
    };
  }
}

async function getEvidenceTaskTarget(taskId: string) {
  try {
    const result = await supabase
      .from("tasks")
      .select("inspection_id,greenhouse_unit_id")
      .eq("id", taskId)
      .maybeSingle();

    return result.data || null;
  } catch {
    return null;
  }
}

export async function uploadTaskEvidencePhoto(taskId: unknown, uri: string) {
  const normalizedTaskId = String(Array.isArray(taskId) ? taskId[0] : taskId || "");

  if (!normalizedTaskId) {
    throw new Error("Görev bilgisi bulunamadı.");
  }

  const [location, userResult, taskResult] = await Promise.all([
    getEvidenceLocation(),
    supabase.auth.getUser(),
    getEvidenceTaskTarget(normalizedTaskId),
  ]);
  const uploadedBy = userResult.data.user?.id || null;
  const offlinePayload = {
    task_id: normalizedTaskId,
    image_url: uri,
    latitude: location.latitude,
    longitude: location.longitude,
    uploaded_by: uploadedBy,
  };
  const online = await isDeviceOnline();

  if (!online) {
    await enqueueOfflineOperation({
      type: "insert_task_evidence",
      payload: offlinePayload,
      label: "Kanıt fotoğrafı",
    });

    if (taskResult?.inspection_id || taskResult?.greenhouse_unit_id) {
      await enqueueOfflineOperation({
        type: "insert_photo",
        payload: {
          inspection_id: taskResult?.inspection_id || null,
          greenhouse_unit_id: taskResult?.greenhouse_unit_id || null,
          file_url: uri,
          latitude: location.latitude,
          longitude: location.longitude,
          taken_at: new Date().toISOString(),
          created_by: uploadedBy,
        },
        label: "Saha fotoğrafı",
      });
    }

    return {
      offline: true,
      data: offlinePayload,
      publicUrl: uri,
      latitude: location.latitude,
      longitude: location.longitude,
    };
  }

  let publicUrl = uri;

  try {
    const response = await fetch(uri);
    const blob = await response.blob();
    const filePath = `${normalizedTaskId}/evidence-${Date.now()}.jpg`;
    const uploadResult = await supabase.storage.from("task-evidence").upload(filePath, blob, {
      contentType: "image/jpeg",
      upsert: false,
    });

    if (!uploadResult.error) {
      publicUrl = supabase.storage.from("task-evidence").getPublicUrl(uploadResult.data.path).data.publicUrl;
    }
  } catch {
    publicUrl = uri;
  }
  const evidencePayload = {
    task_id: normalizedTaskId,
    image_url: publicUrl,
    latitude: location.latitude,
    longitude: location.longitude,
    uploaded_by: uploadedBy,
  };
  const evidenceResult = await supabase.from("task_evidence").insert(evidencePayload).select().maybeSingle();

  if (evidenceResult.error) {
    if (isNetworkError(evidenceResult.error)) {
      await enqueueOfflineOperation({
        type: "insert_task_evidence",
        payload: offlinePayload,
        label: "Kanıt fotoğrafı",
      });

      return {
        offline: true,
        data: offlinePayload,
        publicUrl: uri,
        latitude: location.latitude,
        longitude: location.longitude,
      };
    }

    throw evidenceResult.error;
  }

  const photoPayload = {
    inspection_id: taskResult?.inspection_id || null,
    greenhouse_unit_id: taskResult?.greenhouse_unit_id || null,
    file_url: publicUrl,
    latitude: location.latitude,
    longitude: location.longitude,
    taken_at: new Date().toISOString(),
    created_by: uploadedBy,
  };
  const photoResult = await supabase.from("photos").insert(photoPayload);

  if (photoResult.error && isNetworkError(photoResult.error)) {
    await enqueueOfflineOperation({
      type: "insert_photo",
      payload: {
        ...photoPayload,
        file_url: uri,
      },
      label: "Saha fotoğrafı",
    });
  }

  return {
    data: evidenceResult.data,
    publicUrl,
    latitude: location.latitude,
    longitude: location.longitude,
  };
}
