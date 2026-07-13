/// <reference types="vite/client" />

import "react";

declare global {
  const __APP_VERSION__: string;

  interface ImportMetaEnv {
    readonly NIANLUN_AGENT_BASE_URL?: string;
    readonly NIANLUN_AGENT_CHAT_PATH?: string;
    readonly NIANLUN_AGENT_HEALTH_PATH?: string;
    readonly NIANLUN_AGENT_STREAM_ENABLED?: string;
    readonly NIANLUN_AGENT_TIMEOUT_MS?: string;
    readonly NIANLUN_AGENT_MOCK_MODE?: string;
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }
}

declare module "react" {
  interface InputHTMLAttributes<T> {
    directory?: string;
    webkitdirectory?: string;
  }
}
