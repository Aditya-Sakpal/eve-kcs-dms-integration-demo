import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Vite dev-server proxy: `/api/*` -> dev.api.eveaix.com/*.
// Login + KCS chat go through this proxy in both dev and prod (via Vercel
// rewrites). DMS MCP is called directly from the browser (APISIX returns
// Access-Control-Allow-Origin: * for that route) so no proxy entry is needed.
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
