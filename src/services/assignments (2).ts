import { supabase } from "../lib/supabase";
import { sendPushToUser } from "./sendPush";
import { taskStatuses, validateTaskForAssignment } from "./workflowGuard";

export async function assignTaskToInspector(taskId: unknown, inspector: any) {
  if (!inspector?.id) {
    throw new Error("Denetçi seçmeden görev atanamaz.");
  }

  const taskResult = await supabase.from("tasks").select("*").eq("id", taskId).single();

  if (taskResult.error) {
    throw taskResult.error;
  }

  const missing = validateTaskForAssignment(taskResult.data);

  if (missing.length) {
    throw new Error(`Görev atanamaz. Eksik işlemler:\n${missing.join("\n")}`);
  }

  const assigneeName = inspector.full_name || inspector.email || inspector.id;

  const updateResult = await supabase
    .from("tasks")
    .update({
      assigned_to: inspector.id,
      assigned_name: assigneeName,
      user_id: inspector.id,
      workflow_status: taskStatuses.assigned,
      status: taskStatuses.waiting,
    })
    .eq("id", taskId)
    .select("*")
    .single();

  if (updateResult.error) {
    throw updateResult.error;
  }

  const title = "Yeni denetim görevi";
  const body = `${updateResult.data?.unit_no || "Ünite"} için yeni saha denetimi atandı.`;

  try {
    await sendPushToUser(inspector.push_token || null, title, body, {
      data: {
        taskId,
        unitNo: updateResult.data?.unit_no || null,
      },
      taskId,
      type: "task_assigned",
      userId: inspector.id,
    });
  } catch {
    // Bildirim kaydı yardımcı bir akış; görev ataması başarılıysa ekranı bloke etmeyelim.
  }

  return updateResult;
}
