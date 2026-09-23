import { defineConfig } from 'vite';

// GitHub Pages では https://<user>.github.io/rpg_game/ で配信されるため base を合わせる
export default defineConfig({
  base: '/rpg_game/',
  server: { host: true, port: 5173 },
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 2000,
  },
});
