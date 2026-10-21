import {defineConfig} from "vite";
import react from "@vitejs/plugin-react";
import {fileURLToPath} from "node:url";
// A second build entry reuses the SAME application. It never imports the server.
export default defineConfig({
  root: fileURLToPath(new URL("./frontend", import.meta.url)),
  base: "/LITRIC/",
  publicDir: fileURLToPath(new URL("./public", import.meta.url)),
  plugins: [react()],
  define: {
    __LITRIC_PAGES__: "true",
    __LITRIC_BACKEND__: JSON.stringify("https://litrix-taiping.tender-eft-9384.chatgpt.site"),
  },
  build: {
    outDir: fileURLToPath(new URL("./dist-pages", import.meta.url)),
    emptyOutDir: true,
    sourcemap: false,
    chunkSizeWarningLimit: 1100,
  },
});
