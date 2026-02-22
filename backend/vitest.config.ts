import { defineConfig } from "vitest/config";
import { mkdirSync, writeFileSync, existsSync } from "fs";

// CDK's Code.fromAsset("dist") requires the directory to exist at synth time.
// In CI the dist/ folder isn't committed, so create a placeholder.
if (!existsSync("dist")) {
  mkdirSync("dist", { recursive: true });
  writeFileSync("dist/index.js", "// placeholder for CDK asset validation");
}

export default defineConfig({
  test: {
    pool: "forks",
    poolOptions: { forks: { minForks: 1, maxForks: 1 } },
    include: ["test/**/*.test.ts"],
  },
});
