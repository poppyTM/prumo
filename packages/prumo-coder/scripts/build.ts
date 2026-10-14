// packages/prumo-coder/scripts/build.ts
// Build script for prumo-coder using OpenTUI Solid plugin
import solidPlugin from "@opentui/solid/bun-plugin";

const result = await Bun.build({
  entrypoints: ["src/cli.tsx", "src/index.tsx"],
  outdir: "dist",
  target: "bun",
  plugins: [solidPlugin],
  external: ["@opentui/core", "shiki"],
  sourcemap: "external",
});

if (!result.success) {
  console.error("prumo-coder build failed:", result.logs);
  process.exit(1);
}

console.log("prumo-coder build succeeded into dist/");
