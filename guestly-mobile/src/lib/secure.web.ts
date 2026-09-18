// WEB ONLY, NEVER SHIPPED. Metro resolves this file instead of secure.ts only
// when the platform is web. Guest-ly has no web build of the app: the web
// export exists for the Part 9 layout rig (scripts/part9/web-rig.mjs), which
// checks every surface at 360 to 1440 px in a desktop browser.
//
// expo-secure-store has no web implementation (its web module is an empty
// object, so every call throws). Without this file the guest surface could
// not sign in on the rig. localStorage is NOT secure storage; that is fine
// here because the rig only ever holds a demo-review guest token on this Mac.
// An iOS or Android bundle never contains this file.

function store(): Storage | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

export async function getItemAsync(key: string): Promise<string | null> {
  return store()?.getItem(key) ?? null;
}

export async function setItemAsync(key: string, value: string): Promise<void> {
  store()?.setItem(key, value);
}

export async function deleteItemAsync(key: string): Promise<void> {
  store()?.removeItem(key);
}
