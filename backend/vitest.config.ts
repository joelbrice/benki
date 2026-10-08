import { fileURLToPath } from "url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "node:sqlite": fileURLToPath(new URL("./test/sqlite-shim.ts", import.meta.url)) },
  },
  test: {
    include: ["test/**/*.test.ts"],
    environment: "node",
    pool: "forks",
    testTimeout: 20_000,
  },
});
