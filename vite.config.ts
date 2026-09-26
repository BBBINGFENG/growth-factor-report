import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Relative base: the built site works at any GitHub Pages repository subpath.
export default defineConfig({
  base: "./",
  plugins: [react()],
});
