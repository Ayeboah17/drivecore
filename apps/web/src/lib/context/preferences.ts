const prefix = "drivecore.v1.";
export function readPreference(key: string): string | null {
  try {
    return window.localStorage.getItem(prefix + key);
  } catch {
    return null;
  }
}
export function writePreference(key: string, value: string) {
  try {
    window.localStorage.setItem(prefix + key, value);
  } catch {
    /* Preferences are optional when storage is blocked. */
  }
}
