import { supabase } from "../lib/supabase";

export type UserRole = "admin" | "manager" | "inspector" | "worker";

export async function getMyProfile() {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data
    ? {
        ...data,
        email: data.email || user.email,
      }
    : null;
}

export function isAdmin(profile:any) {
  return profile?.role === "admin";
}

export function canUseManagementScreens(profile:any) {
  return isAdmin(profile) || profile?.role === "manager";
}

export function canCreateTasks(profile:any) {
  return canUseManagementScreens(profile);
}
