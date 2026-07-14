import { supabase } from "../lib/supabase";
import { clearDemoSession } from "./demoSession";

const institutionalEmailDomain = process.env.EXPO_PUBLIC_INSTITUTIONAL_EMAIL_DOMAIN || "tarimorman.gov.tr";

export async function signIn(email: string, password: string) {
  const normalizedEmail = email.trim().toLowerCase();

  await clearDemoSession();

  if (!normalizedEmail.endsWith(`@${institutionalEmailDomain}`)) {
    return {
      data: { user: null, session: null },
      error: {
        message: `Giriş sadece @${institutionalEmailDomain} kurumsal e-postalarıyla yapılabilir.`,
      },
    };
  }

  const result = await supabase.auth.signInWithPassword({
    email: normalizedEmail,
    password,
  });

  if (result.error) {
    return result;
  }

  const user = result.data.user;
  const profileResult = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  const profile = profileResult.data;

  if (profileResult.error || !profile || profile.status === "passive") {
    await supabase.auth.signOut();

    return {
      ...result,
      error: {
        message: "Bu kullanıcı Bakanlık personel listesinde aktif değildir.",
      },
    };
  }

  return result;
}

export async function signUp(email: string, password: string) {
  const result = await supabase.auth.signUp({
    email,
    password,
  });

  const user = result.data.user;

  if (user) {
    await supabase.from("profiles").insert({
      id: user.id,
      email: user.email,
      role: "worker",
      status: "passive",
    });
  }

  return result;
}

export async function signOut() {
  await clearDemoSession();
  return await supabase.auth.signOut();
}
