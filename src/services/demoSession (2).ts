import AsyncStorage from "@react-native-async-storage/async-storage";

const DEMO_SESSION_KEY = "tarbil:demo-session";

export async function clearDemoSession() {
  await AsyncStorage.removeItem(DEMO_SESSION_KEY);
}
