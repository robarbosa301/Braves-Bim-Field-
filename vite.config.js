import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // On GitHub Actions we build for GitHub Pages, served from a repo subpath.
  // Locally (dev/build) it stays "/" so npm run dev keeps working normally.
  base: process.env.GITHUB_ACTIONS ? "/Braves-Bim-Field-/" : "/",
  plugins: [react()],
});
