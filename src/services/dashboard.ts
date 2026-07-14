import { supabase } from "../lib/supabase";
import { isTaskCancelled, isTaskCompleted, isTaskStarted } from "./workflowGuard";

export type RecentDashboardItem = {
  id: string | number;
  producer_name?: string;
  unit_no?: string;
  detected_crop?: string;
  city?: string;
  district?: string;
  district_name?: string;
  workflow_status?: string;
  status?: string;
  created_at?: string;
};

export type DashboardStats = {
  taskCount: number;
  cityCount: number;
  districtCount: number;
  personnelCount: number;
  fieldPersonnelCount: number;
  recentOperationCount: number;
  recentItems: RecentDashboardItem[];
};

export async function getDashboardStats(): Promise<DashboardStats> {
  const lastWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [tasksResult, personnelResult, fieldResult, recentItemsResult] =
    await Promise.allSettled([
      supabase.from("tasks").select("id,city,district,district_name,workflow_status,status,compliance_result,created_at"),
      supabase.from("profiles").select("*", { count: "exact", head: true }).neq("status", "passive"),
      supabase.from("tasks").select("user_id,assigned_to,workflow_status,status,compliance_result"),
      supabase
        .from("tasks")
        .select("id,producer_name,unit_no,detected_crop,city,district,district_name,workflow_status,status,compliance_result,created_at")
        .gte("created_at", lastWeek)
        .order("created_at", { ascending: false })
        .limit(25),
    ]);

  const taskRows =
    tasksResult.status === "fulfilled"
      ? (tasksResult.value.data || []).filter((task: any) => !isTaskCancelled(task))
      : [];
  const fieldRows =
    fieldResult.status === "fulfilled"
      ? (fieldResult.value.data || []).filter((task: any) => isTaskStarted(task) && !isTaskCompleted(task) && !isTaskCancelled(task))
      : [];
  const fieldPersonnel = new Set(
    fieldRows.map((item: any) => item.assigned_to || item.user_id).filter(Boolean),
  );
  const recentItems =
    recentItemsResult.status === "fulfilled"
      ? (recentItemsResult.value.data || []).filter((task: any) => !isTaskCancelled(task)).slice(0, 5)
      : [];
  const cities = new Set(taskRows.map((item: any) => String(item.city || "").trim()).filter(Boolean));
  const districts = new Set(
    taskRows.map((item: any) => String(item.district_name || item.district || "").trim()).filter(Boolean),
  );

  return {
    taskCount: taskRows.length,
    cityCount: cities.size,
    districtCount: districts.size,
    personnelCount: personnelResult.status === "fulfilled" ? personnelResult.value.count || 0 : 0,
    fieldPersonnelCount: fieldPersonnel.size,
    recentOperationCount: recentItems.length,
    recentItems,
  };
}
