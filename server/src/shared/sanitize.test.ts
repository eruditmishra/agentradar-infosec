import { describe, it, expect } from "vitest";
import { assertSafeText, assertSafeStringFields } from "./sanitize";
import { ValidationError } from "./errors";

describe("assertSafeText", () => {
  it("allows plain text", () => {
    expect(() => assertSafeText("sample-org", "name")).not.toThrow();
  });

  it("allows undefined/null/empty when not required", () => {
    expect(() => assertSafeText(undefined, "name")).not.toThrow();
    expect(() => assertSafeText(null, "name")).not.toThrow();
    expect(() => assertSafeText("", "name")).not.toThrow();
  });

  it("rejects missing value when required", () => {
    expect(() => assertSafeText("", "name", { required: true })).toThrow(ValidationError);
    expect(() => assertSafeText(undefined, "name", { required: true })).toThrow(ValidationError);
  });

  it("rejects values containing angle brackets (script/img injection attempts)", () => {
    expect(() => assertSafeText("GitHub Connection<script>alert(1)</script>", "name")).toThrow(
      ValidationError,
    );
    expect(() => assertSafeText("sample-org<img src=x onerror=alert(1)>", "config.orgOrUser")).toThrow(
      ValidationError,
    );
  });

  it("rejects values longer than maxLength", () => {
    expect(() => assertSafeText("a".repeat(10), "name", { maxLength: 5 })).toThrow(ValidationError);
  });

  it("rejects non-string values", () => {
    expect(() => assertSafeText(123 as unknown as string, "name")).toThrow(ValidationError);
  });
});

describe("assertSafeStringFields", () => {
  it("validates every string field of an object", () => {
    expect(() =>
      assertSafeStringFields({ apiBase: "https://api.github.com", orgOrUser: "sample-org" }, "config"),
    ).not.toThrow();
  });

  it("rejects when any string field contains unsafe characters", () => {
    expect(() =>
      assertSafeStringFields(
        { apiBase: "https://api.github.com", orgOrUser: "sample-org<img src=x onerror=alert(1)>" },
        "config",
      ),
    ).toThrow(ValidationError);
  });

  it("ignores non-string fields and null/undefined input", () => {
    expect(() => assertSafeStringFields(undefined, "config")).not.toThrow();
    expect(() => assertSafeStringFields({ count: 5, nested: { a: 1 } }, "config")).not.toThrow();
  });
});
