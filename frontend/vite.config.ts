import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc"; // o "@vitejs/plugin-react"
import path from "path";

export default defineConfig({
  server: {
    host: "::",
    port: 5173, // Cambiado a 5173 (puerto estándar Vite)
    proxy: {
      '/api': {
        target: 'http://localhost:3000', // Tu backend
        changeOrigin: true,
      }
    }
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});