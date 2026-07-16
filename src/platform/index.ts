import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { fetch as nativeFetch } from "@tauri-apps/plugin-http";

export const isWindowsPlatform =
  typeof navigator !== "undefined" && /windows/i.test(navigator.userAgent);

export function startCurrentWindowDrag(): void {
  void getCurrentWebviewWindow().startDragging();
}

export function collapseCurrentWindow(): void {
  void getCurrentWebviewWindow().hide();
}

function isRealTauriRuntime(): boolean {
  if (typeof window === "undefined") return false;
  const runtimeWindow = window as typeof window & {
    __TAURI_INTERNALS__?: unknown;
    __copetInvoke?: unknown;
  };
  return Boolean(runtimeWindow.__TAURI_INTERNALS__) && !runtimeWindow.__copetInvoke;
}

export const platformFetch: typeof fetch = (input, init) =>
  isRealTauriRuntime()
    ? nativeFetch(input as URL | Request | string, init)
    : globalThis.fetch(input, init);
