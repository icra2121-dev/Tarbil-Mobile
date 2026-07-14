import { supabase } from "../lib/supabase";

export type IntegrationStatus = {
  mode: "gateway" | "local";
  label: string;
  detail: string;
};

const gatewayUrl = process.env.EXPO_PUBLIC_INTEGRATION_API_URL?.replace(/\/$/, "");

export function getIntegrationStatus(): IntegrationStatus {
  if (gatewayUrl) {
    return {
      mode: "gateway",
      label: "Resmi entegrasyon hazır",
      detail: "KOBÜKS ve CBS sorguları kurumsal arka uç üzerinden çalışacak.",
    };
  }

  return {
    mode: "local",
    label: "Hazırlık modu",
    detail:
      "API anahtarları mobil uygulamaya gömülmeden, bakanlık arka ucunda tutulacak şekilde entegrasyon noktaları hazır.",
  };
}

export async function integrationFetch<T>(path: string, options: RequestInit = {}): Promise<T | null> {
  if (!gatewayUrl) {
    return null;
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const response = await fetch(`${gatewayUrl}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);
    throw new Error(errorBody?.message || `Entegrasyon servisi yanıt vermedi. HTTP ${response.status}`);
  }

  return response.json();
}
