import NetInfo from "@react-native-community/netinfo";

import {
  getOfflineOperations,
  isDeviceOnline,
  markOfflineOperationFailed,
  removeOfflineOperation,
  runOfflineOperation,
} from "./offline";

let syncing = false;

export async function syncOfflineTasks() {
  if (syncing) {
    return {
      synced: 0,
      pending: 0,
    };
  }

  const online = await isDeviceOnline();

  if (!online) {
    return {
      synced: 0,
      pending: (await getOfflineOperations()).length,
    };
  }

  syncing = true;

  try {
    const operations = await getOfflineOperations();
    let synced = 0;

    for (const operation of operations) {
      try {
        await runOfflineOperation(operation);
        await removeOfflineOperation(operation.id);
        synced += 1;
      } catch (error) {
        await markOfflineOperationFailed(operation, error);
      }
    }

    return {
      synced,
      pending: (await getOfflineOperations()).length,
    };
  } finally {
    syncing = false;
  }
}

export function startOfflineSyncListener() {
  const unsubscribe = NetInfo.addEventListener((state) => {
    if (state.isConnected && state.isInternetReachable !== false) {
      syncOfflineTasks().catch(() => undefined);
    }
  });

  syncOfflineTasks().catch(() => undefined);

  return unsubscribe;
}
