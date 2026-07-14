import { supabase } from "../lib/supabase";

type PushMetadata = {
  data?: Record<string, unknown>;
  taskId?: unknown;
  type?: string;
  userId?: string | null;
};

export async function sendPushToUser(pushToken: string | null | undefined, title: string, body: string, metadata: PushMetadata = {}) {
  const notificationResult = await supabase.from("notifications").insert({
    user_id: metadata.userId || null,
    push_token: pushToken || null,
    title,
    body,
    task_id: metadata.taskId || null,
    type: metadata.type || "task_assigned",
    read: false,
  });

  if (pushToken) {
    try {
      await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Accept-Encoding": "gzip, deflate",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to: pushToken,
          title,
          body,
          data: metadata.data || {},
          sound: "default",
        }),
      });
    } catch {
      // Push servisi geçici olarak erişilemezse görev atamasını bozmayalım.
    }
  }

  return notificationResult;
}
