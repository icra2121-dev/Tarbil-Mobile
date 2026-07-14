import NetInfo
from "@react-native-community/netinfo";

export async function checkConnection() {

  const state =
    await NetInfo.fetch();

  return state.isConnected;
}
