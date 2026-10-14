// packages/prumo-coder/src/index.tsx
// Module entrypoint re-exporting App, run, and components
export { App } from "./app";
export { run } from "./cli";
export * from "./theme/palette";
export * from "./theme/glyphs";
export * from "./state/tabs";

import { run } from "./cli";

if (import.meta.main) {
  try {
    await run();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
