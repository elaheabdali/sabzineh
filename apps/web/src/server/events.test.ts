import { describe, expect, it } from "vitest";
import {
  countSubscribers,
  publishEvent,
  subscribeToUserEvents,
  type AppEvent,
} from "@/server/events";
import { MemoryDataStore } from "@/server/store";

describe("event bus — per-user scoping", () => {
  it("delivers only to the target user's subscribers", () => {
    const seenA: AppEvent[] = [];
    const seenB: AppEvent[] = [];
    const unsubA = subscribeToUserEvents("user-a", (e) => seenA.push(e));
    const unsubB = subscribeToUserEvents("user-b", (e) => seenB.push(e));

    publishEvent("user-a", { type: "order-status", payload: { orderId: "o1" }, createdAt: new Date().toISOString() });

    expect(seenA).toHaveLength(1);
    expect(seenA[0].payload.orderId).toBe("o1");
    expect(seenB).toHaveLength(0);

    unsubA();
    unsubB();
  });

  it("stops delivering after unsubscribe", () => {
    const seen: AppEvent[] = [];
    const unsub = subscribeToUserEvents("user-c", (e) => seen.push(e));
    expect(countSubscribers("user-c")).toBe(1);
    unsub();
    expect(countSubscribers("user-c")).toBe(0);
    publishEvent("user-c", { type: "order-status", payload: {}, createdAt: new Date().toISOString() });
    expect(seen).toHaveLength(0);
  });

  it("a throwing listener does not break other subscribers", () => {
    const seen: AppEvent[] = [];
    const unsubBad = subscribeToUserEvents("user-d", () => {
      throw new Error("boom");
    });
    const unsubGood = subscribeToUserEvents("user-d", (e) => seen.push(e));
    publishEvent("user-d", { type: "order-status", payload: {}, createdAt: new Date().toISOString() });
    expect(seen).toHaveLength(1);
    unsubBad();
    unsubGood();
  });
});

describe("MemoryDataStore — notifications", () => {
  it("creates, lists newest-first, counts unread, marks read", async () => {
    const store = new MemoryDataStore();
    const first = await store.createNotification("u1", "order-status", { orderId: "o1" });
    await store.createNotification("u1", "order-paid", { orderId: "o1" });
    await store.createNotification("u2", "order-status", { orderId: "o2" });

    expect(await store.countUnreadNotifications("u1")).toBe(2);
    expect(await store.countUnreadNotifications("u2")).toBe(1);

    const list = await store.listNotifications("u1");
    expect(list).toHaveLength(2);
    expect(list[0].type).toBe("order-paid"); // newest first
    expect(list[0].readAt).toBeNull();

    // Marking another user's notification fails.
    expect(await store.markNotificationRead("u2", first.id)).toBe(false);
    expect(await store.markNotificationRead("u1", first.id)).toBe(true);
    expect(await store.countUnreadNotifications("u1")).toBe(1);

    await store.markAllNotificationsRead("u1");
    expect(await store.countUnreadNotifications("u1")).toBe(0);
    expect(await store.countUnreadNotifications("u2")).toBe(1);
  });
});
