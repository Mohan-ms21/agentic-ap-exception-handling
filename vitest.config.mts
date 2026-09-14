import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Resolve the @/* import alias from tsconfig.json.
    tsconfigPaths: true,
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
