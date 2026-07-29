import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    // inline avatar PNGs and fonts as data URIs so the built app stays self-contained
    assetsInlineLimit: 200000,
  },
});
