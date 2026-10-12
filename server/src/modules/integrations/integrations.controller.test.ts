import { describe, it, expect } from "vitest";
import { toClientSafe, toClientSafeList } from "./integrations.controller";

describe("toClientSafe", () => {
  it("strips secrets and secrets_encrypted before a connector reaches the client", () => {
    const record = {
      id: "1",
      name: "GitHub Connection",
      provider: "github",
      config: { apiBase: "https://api.github.com" },
      secrets: { token: "ghp_live_token" },
      secrets_encrypted: "enc:blob",
    };
    const safe = toClientSafe(record);
    expect(safe).not.toHaveProperty("secrets");
    expect(safe).not.toHaveProperty("secrets_encrypted");
    expect(safe).toMatchObject({ id: "1", name: "GitHub Connection", provider: "github" });
  });

  it("is a no-op when the record never had secret fields", () => {
    const record = { id: "1", name: "GitHub Connection" };
    expect(toClientSafe(record)).toEqual(record);
  });
});

describe("toClientSafeList", () => {
  it("strips secrets from every item in a list", () => {
    const records = [
      { id: "1", secrets: { token: "a" } },
      { id: "2", secrets_encrypted: "enc:blob" },
    ];
    const safe = toClientSafeList(records);
    expect(safe.every((r) => !("secrets" in r) && !("secrets_encrypted" in r))).toBe(true);
  });
});
