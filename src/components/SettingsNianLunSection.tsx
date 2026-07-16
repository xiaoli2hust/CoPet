import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import {
  getNianLunAccessToken,
  saveNianLunAccessToken,
  setNianLunSettings,
} from "../lib/appCommands";
import {
  clearSessions,
  createNianLunClient,
  normalizeNianLunConfig,
  resolveNianLunConfig,
  safeErrorMessage,
} from "../services/nianlun";
import type { NianLunConfig } from "../services/nianlun";

export function SettingsNianLunSection({
  locale,
  settings,
  userConfigured,
}: {
  locale: "en-US" | "zh-CN";
  settings: NianLunConfig | undefined;
  userConfigured: boolean | undefined;
}) {
  const resolved = useMemo(
    () => resolveNianLunConfig(settings, Boolean(userConfigured)),
    [settings, userConfigured],
  );
  const [form, setForm] = useState(resolved);
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState<"save" | "test" | null>(null);
  const zh = locale === "zh-CN";

  useEffect(() => setForm(resolved), [resolved]);
  useEffect(() => {
    void getNianLunAccessToken().then(setToken);
  }, []);

  const update = <K extends keyof NianLunConfig>(
    key: K,
    value: NianLunConfig[K],
  ) => setForm((current) => ({ ...current, [key]: value }));

  const save = async () => {
    setBusy("save");
    const normalized = normalizeNianLunConfig(form);
    const configResult = await setNianLunSettings(normalized);
    const tokenResult = await saveNianLunAccessToken(token);
    setBusy(null);
    const error = configResult.errorMessage ?? tokenResult.errorMessage;
    if (error) {
      toast.error(error);
      return;
    }
    setForm(normalized);
    toast.success(zh ? "年轮连接设置已保存" : "NianLun connection saved");
  };

  const test = async () => {
    setBusy("test");
    try {
      const result = await createNianLunClient(
        normalizeNianLunConfig(form),
        token,
      ).healthCheck();
      if (result.ok) toast.success(result.message);
      else toast.error(result.message);
    } catch (error) {
      toast.error(safeErrorMessage(error, token));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="settings-nianlun">
      <header className="settings-section-header">
        <div>
          <h2 id="settings-section-panel-heading">
            {zh ? "年轮连接" : "NianLun connection"}
          </h2>
          <p>
            {zh
              ? "配置经营问答后台。访问 Token 只保存在系统安全凭据库。"
              : "Configure the business Q&A backend. The token stays in the OS credential vault."}
          </p>
        </div>
      </header>

      <div className="nianlun-settings-grid">
        <label>
          <span>{zh ? "后台地址" : "Base URL"}</span>
          <input
            aria-label={zh ? "后台地址" : "Base URL"}
            onChange={(event) => update("baseUrl", event.target.value)}
            value={form.baseUrl}
          />
        </label>
        <label>
          <span>{zh ? "问答接口路径" : "Chat path"}</span>
          <input
            aria-label={zh ? "问答接口路径" : "Chat path"}
            onChange={(event) => update("chatPath", event.target.value)}
            value={form.chatPath}
          />
        </label>
        <label>
          <span>{zh ? "健康检查路径" : "Health path"}</span>
          <input
            aria-label={zh ? "健康检查路径" : "Health path"}
            onChange={(event) => update("healthPath", event.target.value)}
            value={form.healthPath}
          />
        </label>
        <label>
          <span>{zh ? "请求超时时间（毫秒）" : "Timeout (ms)"}</span>
          <input
            aria-label={zh ? "请求超时时间（毫秒）" : "Timeout (ms)"}
            min={50}
            onChange={(event) => update("timeoutMs", Number(event.target.value))}
            type="number"
            value={form.timeoutMs}
          />
        </label>
        <label>
          <span>{zh ? "访问 Token（测试阶段）" : "Access token (testing)"}</span>
          <input
            aria-label={zh ? "访问 Token（测试阶段）" : "Access token (testing)"}
            autoComplete="off"
            onChange={(event) => setToken(event.target.value)}
            placeholder={zh ? "默认留空" : "Leave empty by default"}
            type="password"
            value={token}
          />
        </label>
      </div>

      <div className="nianlun-setting-switches">
        <label>
          <input
            checked={form.enableStreaming}
            onChange={(event) => update("enableStreaming", event.target.checked)}
            role="switch"
            type="checkbox"
          />
          {zh ? "启用 SSE 流式响应" : "Enable SSE streaming"}
        </label>
        <label>
          <input
            checked={form.mockMode}
            onChange={(event) => update("mockMode", event.target.checked)}
            role="switch"
            type="checkbox"
          />
          {zh ? "使用内置 Mock 模式" : "Use built-in Mock mode"}
        </label>
        <label>
          <input
            checked={form.saveHistory}
            onChange={(event) => update("saveHistory", event.target.checked)}
            role="switch"
            type="checkbox"
          />
          {zh ? "保存最近 10 个本地会话" : "Keep the latest 10 local sessions"}
        </label>
      </div>

      <p className="nianlun-security-note">
        {zh
          ? "客户端声明的 super-readonly 不是安全边界，正式权限必须由年轮服务端校验。V1 仅用于可信测试环境。"
          : "The super-readonly client header is not a security boundary. Production authorization must be enforced by the server."}
      </p>

      <div className="nianlun-settings-actions">
        <button disabled={busy !== null} onClick={() => void test()} type="button">
          {busy === "test" ? (zh ? "测试中…" : "Testing…") : zh ? "测试连接" : "Test connection"}
        </button>
        <button disabled={busy !== null} onClick={() => void save()} type="button">
          {busy === "save" ? (zh ? "保存中…" : "Saving…") : zh ? "保存设置" : "Save"}
        </button>
        <button
          className="secondary"
          onClick={() => {
            clearSessions();
            toast.success(zh ? "本地会话已清空" : "Local history cleared");
          }}
          type="button"
        >
          {zh ? "清空全部历史" : "Clear all history"}
        </button>
      </div>
    </div>
  );
}
