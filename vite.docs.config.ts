import { defineConfig } from "vite";

export default defineConfig({
  build: {
    target: "es2022",
    emptyOutDir: false,
    lib: {
      entry: "scripts/docs-overlay.ts",
      formats: ["es"],
      fileName: "schema-lens-overlay",
    },
    outDir: "docs/assets",
  },
});
