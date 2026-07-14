import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";

import { supabase } from "../lib/supabase";
import { createTask as createRemoteTask } from "./createTask";

const LEGACY_TASK_KEY = "offline_tasks";
const QUEUE_KEY = "kobuds_offline_operation_queue";

type OfflineOperationType =
  | "create_task"
  | "update_task"
  | "insert_task_evidence"
  | "insert_photo";

export type OfflineOperation = {
  id: string;
  type: OfflineOperationType;
  table?: string;
  match?: Record<string, unknown>;
  payload: Record<string, unknown>;
  fallbackPayload?: Record<string, unknown>;
  label?: string;
  createdAt: string;
  attempts?: number;
  lastError?: string;
};

function makeOperationId() {
  return `offline-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function normalizeTaskId(taskId: unknown) {
  return String(Array.isArray(taskId) ? taskId[0] : taskId || "");
}

function isMissingColumnError(error: any) {
  const text = [error?.code, error?.message, error?.details, error?.hint]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase("tr-TR");

  return text.includes("schema") || text.includes("pgrst204") || text.includes("does not exist");
}

export function isNetworkError(error: any) {
  const text = [error?.name, error?.code, error?.message, error?.details]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase("tr-TR");

  return (
    text.includes("network") ||
    text.includes("fetch") ||
    text.includes("internet") ||
    text.includes("offline") ||
    text.includes("timeout") ||
    text.includes("failed to fetch")
  );
}

export async function isDeviceOnline() {
  const state = await NetInfo.fetch();
  return Boolean(state.isConnected && state.isInternetReachable !== false);
}

async function readQueue(): Promise<OfflineOperation[]> {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  const parsed = raw ? JSON.parse(raw) : [];
  return Array.isArray(parsed) ? parsed : [];
}

async function writeQueue(queue: OfflineOperation[]) {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export async function enqueueOfflineOperation(operation: Omit<OfflineOperation, "id" | "createdAt">) {
  const queue = await readQueue();
  const nextOperation: OfflineOperation = {
    ...operation,
    id: makeOperationId(),
    createdAt: new Date().toISOString(),
    attempts: 0,
  };

  await writeQueue([...queue, nextOperation]);

  return nextOperation;
}

export async function getOfflineOperations() {
  const queue = await readQueue();
  const legacyTasks = await getLegacyOfflineTasks();

  if (!legacyTasks.length) {
    return queue;
  }

  const migrated = legacyTasks.map((task: any) => ({
    id: makeOperationId(),
    type: "create_task" as const,
    payload: task,
    label: "Offline görev oluşturma",
    createdAt: new Date().toISOString(),
    attempts: 0,
  }));

  const nextQueue = [...queue, ...migrated];
  await writeQueue(nextQueue);
  await AsyncStorage.removeItem(LEGACY_TASK_KEY);

  return nextQueue;
}

export async function removeOfflineOperation(operationId: string) {
  const queue = await readQueue();
  await writeQueue(queue.filter((operation) => operation.id !== operationId));
}

export async function markOfflineOperationFailed(operation: OfflineOperation, error: any) {
  const queue = await readQueue();
  const message = String(error?.message || error || "Senkronizasyon başarısız.");

  await writeQueue(
    queue.map((item) =>
      item.id === operation.id
        ? {
            ...item,
            attempts: (item.attempts || 0) + 1,
            lastError: message,
          }
        : item,
    ),
  );
}

async function getLegacyOfflineTasks() {
  const raw = await AsyncStorage.getItem(LEGACY_TASK_KEY);
  const parsed = raw ? JSON.parse(raw) : [];
  return Array.isArray(parsed) ? parsed : [];
}

export async function saveOfflineTask(task: Record<string, unknown>) {
  return enqueueOfflineOperation({
    type: "create_task",
    payload: task,
    label: "Görev oluşturma",
  });
}

export async function getOfflineTasks() {
  const operations = await getOfflineOperations();
  return operations.filter((operation) => operation.type === "create_task").map((operation) => operation.payload);
}

export async function clearOfflineTasks() {
  await AsyncStorage.removeItem(LEGACY_TASK_KEY);
  await writeQueue([]);
}

export async function queueTaskUpdate(
  taskId: unknown,
  payload: Record<string, unknown>,
  label = "Görev güncelleme",
  fallbackPayload?: Record<string, unknown>,
) {
  const normalizedTaskId = normalizeTaskId(taskId);

  if (!normalizedTaskId) {
    throw new Error("Görev ID bulunamadı.");
  }

  return enqueueOfflineOperation({
    type: "update_task",
    table: "tasks",
    match: { id: normalizedTaskId },
    payload,
    fallbackPayload,
    label,
  });
}

export async function updateTaskOnlineOrQueue(
  taskId: unknown,
  payload: Record<string, unknown>,
  label = "Görev güncelleme",
  fallbackPayload?: Record<string, unknown>,
) {
  const normalizedTaskId = normalizeTaskId(taskId);

  if (!normalizedTaskId) {
    throw new Error("Görev ID bulunamadı.");
  }

  const online = await isDeviceOnline();

  if (!online) {
    await queueTaskUpdate(normalizedTaskId, payload, label, fallbackPayload);
    return {
      queued: true,
      data: {
        id: normalizedTaskId,
        ...payload,
      },
    };
  }

  try {
    let result = await supabase.from("tasks").update(payload).eq("id", normalizedTaskId).select("*").maybeSingle();

    if (result.error && fallbackPayload && isMissingColumnError(result.error)) {
      result = await supabase.from("tasks").update(fallbackPayload).eq("id", normalizedTaskId).select("*").maybeSingle();
    }

    if (result.error) {
      throw result.error;
    }

    return {
      queued: false,
      data: result.data,
    };
  } catch (error) {
    if (isNetworkError(error)) {
      await queueTaskUpdate(normalizedTaskId, payload, label, fallbackPayload);
      return {
        queued: true,
        data: {
          id: normalizedTaskId,
          ...payload,
        },
      };
    }

    throw error;
  }
}

async function uploadEvidenceUri(taskId: string, imageUrl: string) {
  if (!imageUrl || imageUrl.startsWith("http")) {
    return imageUrl;
  }

  const response = await fetch(imageUrl);
  const blob = await response.blob();
  const filePath = `${taskId}/evidence-${Date.now()}.jpg`;
  const uploadResult = await supabase.storage.from("task-evidence").upload(filePath, blob, {
    contentType: "image/jpeg",
    upsert: false,
  });

  if (uploadResult.error) {
    throw uploadResult.error;
  }

  return supabase.storage.from("task-evidence").getPublicUrl(uploadResult.data.path).data.publicUrl;
}

async function insertTaskEvidence(payload: Record<string, unknown>) {
  const taskId = normalizeTaskId(payload.task_id);
  const imageUrl = await uploadEvidenceUri(taskId, String(payload.image_url || ""));
  const nextPayload = {
    ...payload,
    image_url: imageUrl,
  };

  const result = await supabase.from("task_evidence").insert(nextPayload);

  if (result.error) {
    throw result.error;
  }
}

async function insertGeneric(table: string, payload: Record<string, unknown>) {
  const result = await supabase.from(table).insert(payload);

  if (result.error) {
    throw result.error;
  }
}

export async function runOfflineOperation(operation: OfflineOperation) {
  if (operation.type === "create_task") {
    await createRemoteTask(operation.payload);
    return;
  }

  if (operation.type === "update_task") {
    const table = operation.table || "tasks";
    const match = operation.match || {};
    const entries = Object.entries(match);
    let query = supabase.from(table).update(operation.payload);

    entries.forEach(([key, value]) => {
      query = query.eq(key, value);
    });

    let result = await query;

    if (result.error && operation.fallbackPayload && isMissingColumnError(result.error)) {
      let fallbackQuery = supabase.from(table).update(operation.fallbackPayload);
      entries.forEach(([key, value]) => {
        fallbackQuery = fallbackQuery.eq(key, value);
      });
      result = await fallbackQuery;
    }

    if (result.error) {
      throw result.error;
    }

    return;
  }

  if (operation.type === "insert_task_evidence") {
    await insertTaskEvidence(operation.payload);
    return;
  }

  if (operation.type === "insert_photo") {
    await insertGeneric("photos", operation.payload);
  }
}
