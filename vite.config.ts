import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// pdf.js, pdf-lib and qpdf (WASM) are all loaded on demand via dynamic import(),
// so the initial bundle only contains React and the UI.
export default defineConfig({
  base: '/PDF-Toolkit/',
  plugins: [react()],
  build: {
    target: 'es2022',
    // The qpdf chunk embeds its WASM binary and is only fetched when compressing.
    chunkSizeWarningLimit: 1800,
  },
});
