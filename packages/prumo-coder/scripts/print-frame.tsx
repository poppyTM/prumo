// packages/prumo-coder/scripts/print-frame.tsx
import { testRender } from "@opentui/solid";
import { App } from "../src/app";

const setup = await testRender(() => <App />, { width: 110, height: 26 });
await setup.renderOnce();
console.log("=== RENDERED TERMINAL FRAME ===");
console.log(setup.captureCharFrame());
console.log("===============================");
setup.renderer.destroy();
process.exit(0);
