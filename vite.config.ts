import { defineConfig, type Plugin } from 'vite';

/**
 * 開発サーバーの応答をブラウザにキャッシュさせない。
 * iPhone の Safari は古いモジュールを使い回すことがあり、
 * 新しいモジュールと食い違うと読み込みの途中で止まってしまうため。
 */
function noStoreInDev(): Plugin {
  return {
    name: 'no-store-in-dev',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        // 「変わっていない」応答（304）を返さないよう、条件付きリクエストの印を消す
        delete req.headers['if-none-match'];
        delete req.headers['if-modified-since'];
        const setHeader = res.setHeader.bind(res);
        res.setHeader = (name, value) => {
          const key = name.toLowerCase();
          if (key === 'cache-control') return setHeader(name, 'no-store');
          if (key === 'etag') return res;
          return setHeader(name, value);
        };
        setHeader('Cache-Control', 'no-store');
        next();
      });
    },
  };
}

// GitHub Pages では https://<user>.github.io/rpg_game/ で配信されるため base を合わせる
export default defineConfig({
  base: '/rpg_game/',
  plugins: [noStoreInDev()],
  server: {
    host: true,
    port: 5173,
    // 番号が使えないときに別の番号へ逃げない（スマホで開くアドレスが変わってしまうため）
    strictPort: true,
    allowedHosts: ['.local'],
    // Windows ではファイル変更の検知を取りこぼし、古いコードが配信されることがあるためポーリングで監視する
    watch: { usePolling: true, interval: 300 },
  },
  preview: {
    host: true,
    port: 4173,
    strictPort: true,
    // 「PCの名前.local」でも開けるように（IP アドレスが変わっても同じアドレスで開ける）
    allowedHosts: ['.local'],
    // ビルド結果の確認用（iPhone で遊ぶとき）。こちらもキャッシュさせない
    headers: { 'Cache-Control': 'no-store' },
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
