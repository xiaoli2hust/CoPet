import { expect, test } from "@playwright/test";

import { createAppHarness } from "./app-harness";

test("double-clicking the pet opens the NianLun Q&A window", async ({ browser }) => {
  const harness = await createAppHarness(browser);
  const page = await harness.openPage("pet");

  await page.locator(".pet-sprite-frame").dblclick();

  await expect.poll(() => harness.invocations("open_nianlun_window").length).toBe(1);
});

test("NianLun window completes an HTTP question and follow-up", async ({ browser }) => {
  const harness = await createAppHarness(browser);
  const page = await harness.openPage("nianlun" as "pet");

  await expect(page.getByText("问年轮", { exact: true })).toBeVisible();
  await page.evaluate(() => {
    const internals = (window as unknown as {
      __TAURI_INTERNALS__: {
        invoke: (command: string, args?: unknown) => Promise<unknown>;
      };
    }).__TAURI_INTERNALS__;
    const originalInvoke = internals.invoke;
    internals.invoke = (command, args) => {
      if (command.startsWith("set_nianlun_") || command.includes("nianlun_token")) {
        return Promise.resolve(null);
      }
      return originalInvoke(command, args);
    };
    window.fetch = async () =>
      new Response(
        JSON.stringify({
          requestId: crypto.randomUUID(),
          conversationId: "conv_ui_followup",
          answer: "模拟数据\n\n经营问题回答完成。",
          summary: "经营问题回答完成",
          status: "completed",
          evidence: [{ title: "经营月报", source: "CRM", time: "2026-07-13" }],
          actions: [],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
  });
  const input = page.locator("textarea");
  await input.fill("华东区本月签单为什么下降？");
  await page.getByRole("button", { name: "发送" }).click();
  await expect(page.getByText(/模拟数据/).last()).toBeVisible();

  await input.fill("主要是哪几个项目？");
  await input.press("Enter");
  await expect(page.getByText(/模拟数据/)).toHaveCount(2);
});
