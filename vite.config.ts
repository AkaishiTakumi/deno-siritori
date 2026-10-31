import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  root: "public",
  build: {
    outDir: "../dist",
    emptyOutDir: true,
    rolldownOptions: {
      input: {
        index: resolve(__dirname, "public/index.html"),
        "mode-select": resolve(__dirname, "public/mode-select/index.html"),
        standby: resolve(__dirname, "public/standby/index.html"),
        game: resolve(__dirname, "public/game/index.html"),
      },
    },
  },
});
