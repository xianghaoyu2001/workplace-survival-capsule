import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 5173,
    allowedHosts: ["10.128.188.102", ".loca.lt", ".trycloudflare.com"],
    proxy: {
      "/api": {
        target: process.env.VITE_DEV_API_TARGET || "http://localhost:3000",
        changeOrigin: true
      },
      "/health": {
        target: process.env.VITE_DEV_API_TARGET || "http://localhost:3000",
        changeOrigin: true
      }
    }
  }
});
