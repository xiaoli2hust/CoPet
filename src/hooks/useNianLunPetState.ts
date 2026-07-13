import { listen } from "@tauri-apps/api/event";
import { useEffect, useState } from "react";

import type { NianLunPetStatus } from "../lib/appTypes";

const VISUAL_BY_STATUS = {
  listening: {
    bodySpriteRow: "review",
    emotionOverlay: "question-mark",
    dragging: false,
  },
  thinking: {
    bodySpriteRow: "waiting",
    emotionOverlay: "loading-bubble",
    dragging: false,
  },
  working: {
    bodySpriteRow: "running",
    emotionOverlay: "loading-bubble",
    dragging: false,
  },
  success: {
    bodySpriteRow: "waving",
    emotionOverlay: "sparkle",
    dragging: false,
  },
  error: {
    bodySpriteRow: "failed",
    emotionOverlay: "smoke",
    dragging: false,
  },
} as const;

export function useNianLunPetState() {
  const [status, setStatus] = useState<NianLunPetStatus | null>(null);

  useEffect(() => {
    const unlisten = listen<NianLunPetStatus>("nianlun-pet-status", (event) => {
      setStatus(event.payload);
    });
    return () => {
      void unlisten.then((dispose) => dispose());
    };
  }, []);

  if (status === null || status === "idle") return null;
  return VISUAL_BY_STATUS[status];
}
