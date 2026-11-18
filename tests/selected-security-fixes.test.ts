import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { getStripeErrorMessage } from "@/lib/stripe.server";
import { stripeMessage } from "@/lib/billing.server";

const mocks = vi.hoisted(() => ({
  assertModerator: vi.fn(),
  processModerationQueue: vi.fn(),
}));

vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    const builder = {
      middleware: () => builder,
      inputValidator: () => builder,
      handler: (fn: unknown) => fn,
    };
    return builder;
  },
}));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("@/lib/admin.server", () => ({ assertModerator: mocks.assertModerator }));
vi.mock("@/lib/moderation-queue.server", () => ({
  processModerationQueue: mocks.processModerationQueue,
}));

describe("selected payment diagnostic findings", () => {
  it.each([
    new Error("private provider message"),
    { raw: { message: "private", type: "internal", code: "secret", param: "customer", requestId: "req_private" } },
    { message: "private", decline_code: "private" },
    "private",
    null,
    undefined,
  ])("returns only a constant safe message for %s", async (error) => {
    const expected = "Die Zahlungsanfrage konnte nicht verarbeitet werden. Bitte versuche es später erneut.";
    expect(getStripeErrorMessage(error)).toBe(expected);
    expect(await stripeMessage(error)).toBe(expected);
  });

  it("does not inspect provider diagnostics", () => {
    const error = { get message() { throw new Error("must not read diagnostics"); } };
    expect(() => getStripeErrorMessage(error)).not.toThrow();
  });

  it("all seven selected provider catches pass through the safe helper", () => {
    const business = readFileSync("src/lib/billing.server.ts", "utf8");
    const creator = readFileSync("src/lib/creator-subscription.server.ts", "utf8");
    expect(business.match(/throw new Error\(await stripeMessage\(error\)\)/g)).toHaveLength(5);
    expect(creator.match(/throw new Error\(await stripeMessage\(error\)\)/g)).toHaveLength(2);
  });
});

describe("selected moderation authorization finding", () => {
  it("denies an ordinary user before running any queue work", async () => {
    mocks.processModerationQueue.mockClear();
    mocks.assertModerator.mockRejectedValueOnce(new Error("Forbidden"));
    const { runModerationQueue } = await import("@/lib/moderation.functions");
    const handler = runModerationQueue as unknown as (args: unknown) => Promise<unknown>;
    await expect(handler({ context: { userId: "ordinary-user" } })).rejects.toThrow("Forbidden");
    expect(mocks.processModerationQueue).not.toHaveBeenCalled();
  });

  it("allows a verified moderator and preserves the batch limit", async () => {
    mocks.assertModerator.mockResolvedValueOnce("moderator");
    mocks.processModerationQueue.mockResolvedValueOnce([{}, {}]);
    const { runModerationQueue } = await import("@/lib/moderation.functions");
    const handler = runModerationQueue as unknown as (args: unknown) => Promise<unknown>;
    await expect(handler({ context: { userId: "moderator" } })).resolves.toEqual({ processed: 2 });
    expect(mocks.processModerationQueue).toHaveBeenCalledWith(5);
  });
});

async function clickPush(raw: unknown, withWindow: boolean) {
  const listeners: Record<string, (event: unknown) => void> = {};
  const destinations: string[] = [];
  const messages: { link: string }[] = [];
  const origin = "https://app.example.test";
  const client = {
    id: "own", url: origin + "/dev", visibilityState: "visible",
    focus: async () => {},
    postMessage: (message: { link: string }) => messages.push(message),
  };
  runInNewContext(readFileSync("public/push-sw.js", "utf8"), {
    URL, String, Date,
    self: {
      location: { origin },
      addEventListener: (name: string, fn: (event: unknown) => void) => { listeners[name] = fn; },
      clients: {
        matchAll: async () => withWindow ? [client] : [],
        openWindow: async (url: string) => { destinations.push(url); },
      },
    },
  });
  let work: Promise<unknown> | undefined;
  listeners.notificationclick({
    notification: { close() {}, data: { link: raw } },
    waitUntil: (promise: Promise<unknown>) => { work = promise; },
  });
  await work;
  return { destinations, messages, origin };
}

describe("selected off-site push redirect finding", () => {
  it.each(["//evil.example", "/\\evil.example", "///evil.example", "/\n/evil.example", "https://evil.example", "javascript:alert(1)", null])(
    "keeps unsafe destination %s inside the app", async (raw) => {
      const closed = await clickPush(raw, false);
      expect(closed.destinations).toEqual([closed.origin + "/dev"]);
      const open = await clickPush(raw, true);
      expect(open.messages[0].link).toBe("/dev");
    },
  );

  it("preserves an ordinary internal destination including query and fragment", async () => {
    const link = "/feed?chat=123#message";
    const closed = await clickPush(link, false);
    expect(closed.destinations).toEqual([closed.origin + link]);
    expect((await clickPush(link, true)).messages[0].link).toBe(link);
  });

  it("the app independently enforces same-origin before its navigation fallback", () => {
    const root = readFileSync("src/routes/__root.tsx", "utf8");
    const block = root.slice(root.indexOf('if (data?.type !== "push-navigate")'), root.indexOf('navigator.serviceWorker.addEventListener("message"'));
    expect(block).toContain("target.origin === window.location.origin");
    expect(block.indexOf("target.origin === window.location.origin")).toBeLessThan(block.indexOf("window.location.assign(link)"));
  });
});