import { defineConfig } from "vite";
import path from "node:path";
export default defineConfig({
  root: ".",
  build: { outDir: "dist", emptyOutDir: true, sourcemap: false },
  resolve: { alias: { "@": path.resolve(process.cwd(), "web") } },
});
