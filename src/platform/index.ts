import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";

export const isWindowsPlatform =
  typeof navigator !== "undefined" && /windows/i.test(navigator.userAgent);

export function startCurrentWindowDrag(): void {
  void getCurrentWebviewWindow().startDragging();
}

export function collapseCurrentWindow(): void {
  void getCurrentWebviewWindow().hide();
}
