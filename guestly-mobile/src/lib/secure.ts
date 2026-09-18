// The one door to the device keychain. Native builds (iOS and Android) get
// expo-secure-store unchanged; this file only re-exports it. The web twin in
// secure.web.ts exists for the local layout rig and is never shipped.

export { getItemAsync, setItemAsync, deleteItemAsync } from "expo-secure-store";
