import {defineConfig} from "vitest/config";

export default defineConfig({
  resolve: {
    preserveSymlinks: true
  },
  test: {
    globals: true,
    environment: "node",
    include: [
      "src/lib/__tests__/**/*.test.ts",
      "src/lib/vector/__tests__/**/*.test.ts",
      "src/compositions/__tests__/**/*.test.ts",
      "src/compositions/__tests__/**/*.test.tsx",
      "src/creative-orchestration/__tests__/**/*.test.ts",
      "src/creative-orchestration/governance/__tests__/**/*.test.ts",
      "src/creative-orchestration/judgment/__tests__/**/*.test.ts",
      "src/web-preview/__tests__/**/*.test.ts",
      "src/web-preview/__tests__/**/*.test.tsx"
    ],
    fileParallelism: false,
    maxWorkers: 1,
    passWithNoTests: false
  }
});
