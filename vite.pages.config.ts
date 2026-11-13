import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
export default defineConfig(({ mode }) => {
  const values = loadEnv(mode, process.cwd(), "VITE_");
  const api =
    process.env.VITE_LITRIC_API_URL || values.VITE_LITRIC_API_URL || "";
  if (api) {
    const url = new URL(api);
    if (
      url.origin !== api ||
      url.username ||
      url.password ||
      /chatgpt\.site$/i.test(url.hostname) ||
      (url.protocol !== "https:" &&
        !(
          process.env.LITRIC_LOCAL_QA === "1" &&
          ["127.0.0.1", "localhost"].includes(url.hostname)
        ))
    )
      throw new Error(
        "VITE_LITRIC_API_URL must be an independent HTTPS API origin.",
      );
  }
  return {
    root: fileURLToPath(new URL("./frontend", import.meta.url)),
    base: mode === "pages" ? "/LITRIC/" : "/",
    publicDir: fileURLToPath(new URL("./public", import.meta.url)),
    plugins: [
      react(),
      {
        name: "litric-csp",
        apply: "build" as const,
        transformIndexHtml(html: string) {
          return html.replace(
            "<head>",
            `<head><meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data: blob:; connect-src 'self' ${api}; base-uri 'self'; form-action 'none'; object-src 'none'">`,
          );
        },
      },
    ],
    define: { __LITRIC_API_URL__: JSON.stringify(api) },
    build: {
      outDir: fileURLToPath(
        new URL(
          mode === "pages" ? "./dist-pages" : "./dist-worker",
          import.meta.url,
        ),
      ),
      emptyOutDir: true,
      sourcemap: false,
      chunkSizeWarningLimit: 1100,
    },
  };
});
