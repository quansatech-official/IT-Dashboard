import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "/mobil/",
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:9873",
        changeOrigin: true
      }
    }
  }
});
