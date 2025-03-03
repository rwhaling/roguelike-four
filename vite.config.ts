import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [tailwindcss(), react()],
  base: './',
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          p5: ["p5"],
        },
      },
    },
  },
});