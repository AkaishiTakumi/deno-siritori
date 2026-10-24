import { defineConfig } from "vite";

export default defineConfig({
  root: "public", // ソースコードのある場所
  build: {
    outDir: "../dist", // 出力先（./dist）
    emptyOutDir: true,
  },
});
