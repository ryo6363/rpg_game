import { defineConfig } from 'vite';

// GitHub Pages では https://<user>.github.io/rpg_game/ で配信されるため base を合わせる
export default defineConfig({
  base: '/rpg_game/',
  server: {
    host: true,
    port: 5173,
    // Windows ではファイル変更の検知を取りこぼし、古いコードが配信されることがあるためポーリングで監視する
    watch: { usePolling: true, interval: 300 },
  },
  define: {
    // タイトル画面に表示して、どの版が動いているか確認できるようにする
    __BUILD_TIME__: JSON.stringify(
      new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }),
    ),
  },
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 2000,
  },
});
