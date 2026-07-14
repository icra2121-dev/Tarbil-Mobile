import { supabase } from "../lib/supabase";
import { getMyProfile, isAdmin } from "./profile";
import { isTaskClosed } from "./workflowGuard";

async function findOpenDuplicateTask(values: any) {
  const unitNo = String(values?.unit_no || "").trim();

  if (!unitNo) {
    return null;
  }

  const result = await supabase
    .from("tasks")
    .select("id,unit_no,producer_name,status,workflow_status,created_at")
    .eq("unit_no", unitNo)
    .order("created_at", { ascending: false })
    .limit(10);

  if (result.error) {
    return null;
  }

  return (result.data || []).find((task) => !isTaskClosed(task)) || null;
}

function isMissingOptionalTaskColumn(error: any) {
  const errorText = [error?.code, error?.message, error?.details, error?.hint].filter(Boolean).join(" ").toLowerCase();
  return (
    errorText.includes("workflow_type") ||
    errorText.includes("parcel_polygon") ||
    errorText.includes("greenhouse_polygon") ||
    errorText.includes("schema cache") ||
    errorText.includes("pgrst204")
  );
}

function omitOptionalTaskColumns(values: any) {
  const { workflow_type: _workflowType, parcel_polygon: _parcelPolygon, greenhouse_polygon: _greenhousePolygon, ...safeValues } = values;
  return safeValues;
}

export async function createTask(values: any) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      data: null,
      error: {
        message: "Oturum bulunamadı.",
      },
    };
  }

  const profile = await getMyProfile();

  if (!isAdmin(profile)) {
    return {
      data: null,
      error: {
        message: "Görev oluşturma yetkisi sadece sistem yöneticisine açıktır.",
      },
    };
  }

  const duplicateTask = await findOpenDuplicateTask(values);

  if (duplicateTask) {
    return {
      data: null,
      error: {
        message: `Bu ünite için açık görev var: ${duplicateTask.unit_no}. Önce mevcut görev tamamlanmalı veya iptal edilmeli.`,
      },
    };
  }

  const result = await supabase
    .from("tasks")
    .insert({
      ...values,
      user_id: user.id,
    })
    .select()
    .single();

  if (!result.error || !isMissingOptionalTaskColumn(result.error)) {
    return result;
  }

  return await supabase
    .from("tasks")
    .insert({
      ...omitOptionalTaskColumns(values),
      user_id: user.id,
    })
    .select()
    .single();
}
