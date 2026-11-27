import { describe, expect, it } from "vitest";
import {
  AuthError,
  getSessionUserFromToken,
  loginWithCredentials,
  logout,
  registerCustomer,
} from "./service";
import { getSessionStore } from "./store";

describe("loginWithCredentials (memory adapter)", () => {
  it("logs in the demo customer and resolves the session user", async () => {
    const { user, token } = await loginWithCredentials("customer@sabzineh.ir", "demo1234");
    expect(user.role).toBe("CUSTOMER");
    expect(user.email).toBe("customer@sabzineh.ir");
    const resolved = await getSessionUserFromToken(token);
    expect(resolved?.id).toBe(user.id);
    await logout(token);
  });

  it("logs in the demo vendor with vendorId and the demo admin", async () => {
    const vendor = await loginWithCredentials("vendor@sabzineh.ir", "demo1234");
    expect(vendor.user.role).toBe("VENDOR");
    expect(vendor.user.vendorId).toBe("v01");
    const admin = await loginWithCredentials("admin@sabzineh.ir", "demo1234");
    expect(admin.user.role).toBe("ADMIN");
    await logout(vendor.token);
    await logout(admin.token);
  });

  it("returns the identical error for unknown email and wrong password", async () => {
    await expect(loginWithCredentials("nobody@sabzineh.ir", "demo1234")).rejects.toMatchObject({
      code: "invalid-credentials",
    });
    await expect(loginWithCredentials("customer@sabzineh.ir", "wrongpass1")).rejects.toMatchObject({
      code: "invalid-credentials",
    });
  });
});

describe("registerCustomer", () => {
  it("registers a customer and normalises the phone", async () => {
    const email = `test-${crypto.randomUUID()}@sabzineh.ir`;
    const { user } = await registerCustomer({
      name: "Test User",
      email,
      phone: "+989123456789",
      password: "secret123",
    });
    expect(user.role).toBe("CUSTOMER");
    expect(user.email).toBe(email);
  });

  it("rejects a duplicate email", async () => {
    const email = `dup-${crypto.randomUUID()}@sabzineh.ir`;
    await registerCustomer({ name: "A", email, phone: "09123456789", password: "secret123" });
    await expect(
      registerCustomer({ name: "B", email, phone: "09123456789", password: "secret123" }),
    ).rejects.toBeInstanceOf(AuthError);
    await expect(
      registerCustomer({ name: "B", email, phone: "09123456789", password: "secret123" }),
    ).rejects.toMatchObject({ code: "email-taken" });
  });

  it("rejects a weak password and an invalid phone", async () => {
    await expect(
      registerCustomer({
        name: "A",
        email: `weak-${crypto.randomUUID()}@sabzineh.ir`,
        phone: "09123456789",
        password: "short",
      }),
    ).rejects.toMatchObject({ code: "weak-password" });
    await expect(
      registerCustomer({
        name: "A",
        email: `phone-${crypto.randomUUID()}@sabzineh.ir`,
        phone: "02122334455",
        password: "secret123",
      }),
    ).rejects.toMatchObject({ code: "invalid-phone" });
  });
});

describe("sessions", () => {
  it("expires a session whose TTL has passed", async () => {
    const store = getSessionStore();
    const record = await store.create("u-customer", -1000);
    expect(await getSessionUserFromToken(record.token)).toBeNull();
  });

  it("logout invalidates the session server-side", async () => {
    const { token } = await loginWithCredentials("customer@sabzineh.ir", "demo1234");
    expect(await getSessionUserFromToken(token)).not.toBeNull();
    await logout(token);
    expect(await getSessionUserFromToken(token)).toBeNull();
  });

  it("an unknown token resolves to no session", async () => {
    expect(await getSessionUserFromToken("no-such-token")).toBeNull();
    expect(await getSessionUserFromToken(null)).toBeNull();
  });
});
