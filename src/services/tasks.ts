import { supabase } from "../lib/supabase";
import { createTask as insertTask } from "./createTask";

export async function createTask(values) {
  return await insertTask(values);
}

export async function getTasks() {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      data: [],
    };
  }

  const profile = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  const role = profile.data?.role;

  if (role === "admin" || role === "manager") {
    return await supabase
      .from("tasks")
      .select("*")
      .order("created_at", {
        ascending: false,
      });
  }

  const assignedResult = await supabase
    .from("tasks")
    .select("*")
    .or(`user_id.eq.${user.id},assigned_to.eq.${user.id}`)
    .order("created_at", {
      ascending: false,
    });

  if (!assignedResult.error) {
    return assignedResult;
  }

  return await supabase
    .from("tasks")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", {
      ascending: false,
    });
}

function isMissingNotificationTaskIdColumn(error) {
  const errorText = [error?.code, error?.message, error?.details, error?.hint]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return (
    errorText.includes("task_id") &&
    (errorText.includes("does not exist") || errorText.includes("schema cache") || errorText.includes("pgrst204"))
  );
}

export async function deleteTaskById(taskId) {
  const normalizedTaskId = String(Array.isArray(taskId) ? taskId[0] : taskId || "");

  if (!normalizedTaskId) {
    throw new Error("Görev ID bulunamadı.");
  }

  const notificationResult = await supabase.from("notifications").delete().eq("task_id", normalizedTaskId);

  if (notificationResult.error && !isMissingNotificationTaskIdColumn(notificationResult.error)) {
    throw notificationResult.error;
  }

  const evidenceResult = await supabase.from("task_evidence").delete().eq("task_id", normalizedTaskId);

  if (evidenceResult.error) {
    throw evidenceResult.error;
  }

  const taskResult = await supabase.from("tasks").delete().eq("id", normalizedTaskId);

  if (taskResult.error) {
    throw taskResult.error;
  }

  return taskResult;
}
