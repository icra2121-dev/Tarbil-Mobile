import "react-native-url-polyfill/auto";

import AsyncStorage
from "@react-native-async-storage/async-storage";

import {
  createClient,
  type SupabaseClient,
} from "@supabase/supabase-js";

const supabaseUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";

const supabaseAnonKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const isSupabaseConfigured =
  supabaseUrl.length > 0 && supabaseAnonKey.length > 0;

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        auth:{
          storage:AsyncStorage,
          autoRefreshToken:true,
          persistSession:true,
          detectSessionInUrl:false,
        },
      }
    )
  : null;
