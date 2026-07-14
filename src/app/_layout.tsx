import {
  Stack,
} from "expo-router";

import {
  useEffect,
} from "react";

import {
  startOfflineSyncListener,
} from "../services/sync";



export default function RootLayout() {

  useEffect(() => {

  const stopOfflineSync = startOfflineSyncListener();

  // startLiveTracking();

  // startBackgroundTracking();

  return stopOfflineSync;

}, []);
  return (
    <Stack
      screenOptions={{
        headerShown:false,
      }}
    />
  );
}
