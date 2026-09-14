import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Resolve the @/* import alias from tsconfig.json.
    tsconfigPaths: true,
    alias: {
      // Outside a React Server Components bundle, "server-only" throws on
      // import. Tests run server code directly, so stub it out.
      "server-only": fileURLToPath(
        new URL("./node_modules/server-only/empty.js", import.meta.url),
      ),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
