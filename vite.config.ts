import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Vite dev-server proxy: `/api/*` -> dev.api.eveaix.com/*
// Browsers block cross-origin POST + SSE without proper CORS headers from APISIX;
// the proxy lets the React app talk to the gateway from localhost without that.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "https://dev.api.eveaix.com",
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
});
