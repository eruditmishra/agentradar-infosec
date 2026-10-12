import { ValidationError } from "./errors";

/**
 * Rejects free-text input containing HTML/script-significant characters.
 *
 * Closes KPMGRQ-863317 #4 ("Improper Input Validation"): fields such as an
 * integration connector's name/org fields and agent approval remarks were
 * accepted and stored/reflected verbatim with no server-side validation.
 * React escapes these on render so the dashboard itself isn't directly
 * exploitable, but the same unescaped values flow into audit log entries,
 * exports, and any future non-React consumer — so we reject the dangerous
 * characters at the API boundary instead of relying on a single renderer's
 * escaping behavior.
 */
const DANGEROUS_CHARS = /[<>]/;

export function assertSafeText(
  value: unknown,
  fieldName: string,
  { maxLength = 255, required = false }: { maxLength?: number; required?: boolean } = {},
): void {
  if (value === undefined || value === null || value === "") {
    if (required) {
      throw new ValidationError(`${fieldName} is required`);
    }
    return;
  }
  if (typeof value !== "string") {
    throw new ValidationError(`${fieldName} must be a string`);
  }
  if (value.length > maxLength) {
    throw new ValidationError(`${fieldName} must be ${maxLength} characters or fewer`);
  }
  if (DANGEROUS_CHARS.test(value)) {
    throw new ValidationError(`${fieldName} contains unsupported characters ('<' or '>')`);
  }
}

/** Applies assertSafeText to every string-valued field of a flat object. */
export function assertSafeStringFields(
  obj: Record<string, unknown> | undefined | null,
  label: string,
  opts?: { maxLength?: number },
): void {
  if (!obj) return;
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === "string") {
      assertSafeText(value, `${label}.${key}`, opts);
    }
  }
}
