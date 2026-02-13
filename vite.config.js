import { defineConfig } from 'vite';

export default defineConfig({
  base: process.env.VITE_BASE_PATH || '/',
  define: {
    'import.meta.env.MAPBOX_TOKEN': JSON.stringify(process.env.MAPBOX_TOKEN || ''),
  },
});
