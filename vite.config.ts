import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  base: "./",
  plugins: [
    react(),
    tailwindcss(),
    // Electron loads pages via file:// protocol. The `crossorigin` attribute
    // that Vite adds to assets causes Chromium to apply CORS checks which fail
    // on file:// (no CORS headers). Strip it so assets load correctly.
    {
      name: "electron-strip-crossorigin",
      apply: "build",
      transformIndexHtml(html: string) {
        return html.replace(/ crossorigin/g, "");
      },
    },
  ],
  server: {
    port: 5173,
    strictPort: true
  }
});
