import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Vite dev-server proxy: `/api/*` -> dev.api.eveaix.com/*
// Browsers block cross-origin POST + SSE without proper CORS headers from APISIX;
// the proxy lets the React app talk to the gateway from localhost without that.
//
// Special case: `/api/dms-mcp` in production goes to an Edge Function (see
// api/dms-mcp.ts) that pins the upstream URL with the required trailing slash.
// In dev we point the same path at the upstream `/dms/mcp/` directly so the
// dev experience matches prod.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api/dms-mcp": {
        target: "https://dev.api.eveaix.com",
        changeOrigin: true,
        secure: true,
        rewrite: () => "/dms/mcp/",
      },
      "/api": {
        target: "https://dev.api.eveaix.com",
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
});
