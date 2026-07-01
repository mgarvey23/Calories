import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The base path is set for GitHub Pages project sites, where the app is served
// from https://<user>.github.io/<repo>/. Override with the BASE_PATH env var if
// your repository name differs from "calories" or you use a custom domain.
const base = process.env.BASE_PATH ?? '/calories/';

export default defineConfig({
  plugins: [react()],
  base,
});
