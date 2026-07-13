import { invoke } from "@tauri-apps/api/core";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { useCallback, useEffect, useRef } from "react";

const PET_CONTEXT_MENU_ACTION_EVENT = "copet-pet-context-menu-action";

export type PetContextMenuLabels = {
  askNianLun: string;
  openChat: string;
  messages: string;
  openSettings: string;
  changePet: string;
  hidePet: string;
  quit: string;
};

export type PetContextMenuAction =
  | "askNianLun"
  | "openChat"
  | "toggleMessages"
  | "openSettings"
  | "changePet"
  | "hidePet"
  | "quit";

const NATIVE_MENU_VERTICAL_GAP_PX = 4;
const NATIVE_MENU_MIN_WIDTH_PX = 148;
const NATIVE_MENU_HORIZONTAL_PADDING_PX = 48;
const NATIVE_MENU_AVERAGE_CHAR_WIDTH_PX = 7;

type UsePetContextMenuOptions = {
  labels: PetContextMenuLabels;
  onAskNianLun: () => void | Promise<void>;
  onOpenChat: () => void | Promise<void>;
  onToggleMessages: () => void | Promise<void>;
  onOpenSettings: () => void | Promise<void>;
  onChangePet: () => void | Promise<void>;
  onHidePet: () => void | Promise<void>;
  onQuit: () => void | Promise<void>;
  onPopupFailed: () => void;
};

function estimateNativeMenuWidth(labels: PetContextMenuLabels) {
  const longestLabelLength = Math.max(
    labels.askNianLun.length,
    labels.openChat.length,
    labels.messages.length,
    labels.openSettings.length,
    labels.changePet.length,
    labels.hidePet.length,
    labels.quit.length,
  );
  return Math.max(
    NATIVE_MENU_MIN_WIDTH_PX,
    longestLabelLength * NATIVE_MENU_AVERAGE_CHAR_WIDTH_PX +
      NATIVE_MENU_HORIZONTAL_PADDING_PX,
  );
}

function petMenuPosition(anchor: HTMLElement | null, labels: PetContextMenuLabels) {
  const estimatedMenuWidth = estimateNativeMenuWidth(labels);
  if (!anchor) {
    return {
      x: window.innerWidth / 2 - estimatedMenuWidth / 2,
      y: NATIVE_MENU_VERTICAL_GAP_PX,
    };
  }

  const rect = anchor.getBoundingClientRect();
  return {
    x: rect.left + rect.width / 2 - estimatedMenuWidth / 2,
    y: rect.bottom + NATIVE_MENU_VERTICAL_GAP_PX,
  };
}

export function usePetContextMenu(options: UsePetContextMenuOptions) {
  const optionsRef = useRef(options);

  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  const openMenu = useCallback(async (anchor?: HTMLElement | null) => {
    try {
      const current = optionsRef.current;
      await invoke("open_pet_context_menu", {
        labels: current.labels,
        position: petMenuPosition(anchor ?? null, current.labels),
      });
    } catch {
      optionsRef.current.onPopupFailed();
    }
  }, []);

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;

    void getCurrentWebviewWindow()
      .listen<PetContextMenuAction>(PET_CONTEXT_MENU_ACTION_EVENT, async (event) => {
        const current = optionsRef.current;
        if (event.payload === "askNianLun") {
          await current.onAskNianLun();
        } else if (event.payload === "openChat") {
          await current.onOpenChat();
        } else if (event.payload === "toggleMessages") {
          await current.onToggleMessages();
        } else if (event.payload === "openSettings") {
          await current.onOpenSettings();
        } else if (event.payload === "changePet") {
          await current.onChangePet();
        } else if (event.payload === "hidePet") {
          await current.onHidePet();
        } else if (event.payload === "quit") {
          await current.onQuit();
        }
      })
      .then((cleanup) => {
        if (disposed) {
          cleanup();
        } else {
          unlisten = cleanup;
        }
      });

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);

  return { openMenu };
}
