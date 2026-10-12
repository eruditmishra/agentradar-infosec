import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Without this, vitest's default include glob also picks up the
    // compiled CJS output under dist/ (from `npm run build`), which fails
    // to import vitest at all ("cannot be imported in a CommonJS module") —
    // pre-existing noise unrelated to any real test failure.
    exclude: ["**/node_modules/**", "**/dist/**"],
  },
});
