import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
    plugins: [react()],
    server: {
        port: 5173,
        proxy: {
            // In dev, proxy /api calls to local backend (port 3001)
            // In production (Vercel), VITE_API_URL env var is used instead
            "/api": {
                target: "http://localhost:3001",
                changeOrigin: true,
            },
        },
    },
});