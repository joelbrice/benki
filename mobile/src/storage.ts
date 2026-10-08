import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

// Device keychain/keystore on iOS and Android. Expo's web build has no secure
// store, so web falls back to localStorage (development preview only).
export async function getItem(key: string): Promise<string | null> {
  if (Platform.OS === "web") {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }
  return SecureStore.getItemAsync(key);
}

export async function setItem(key: string, value: string): Promise<void> {
  if (Platform.OS === "web") {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* storage unavailable */
    }
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

export async function deleteItem(key: string): Promise<void> {
  if (Platform.OS === "web") {
    try {
      localStorage.removeItem(key);
    } catch {
      /* storage unavailable */
    }
    return;
  }
  await SecureStore.deleteItemAsync(key);
}
