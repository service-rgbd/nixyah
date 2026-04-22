import Constants, { ExecutionEnvironment } from "expo-constants";
import { Platform } from "react-native";

export function shouldUseNativeMaps(): boolean {
  if (Platform.OS !== "android") {
    return true;
  }

  const appOwnership = (Constants as any).appOwnership;
  const executionEnvironment = (Constants as any).executionEnvironment;

  return (
    appOwnership === "expo" ||
    executionEnvironment === ExecutionEnvironment.StoreClient ||
    executionEnvironment === "storeClient"
  );
}
