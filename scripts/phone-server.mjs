// スマホで遊ぶための配信サーバー（npm run phone / スマホで遊ぶ.bat から起動）
//
// - ビルド済みの dist/ を、同じ Wi-Fi の iPhone から開けるように配信する
// - 開くためのアドレス（このPCの IP と「名前.local」）を大きく表示する
// - サーバーが落ちたら自動で起動し直す
// - PC の IP アドレスが変わったら、新しいアドレスを表示し直す
import { spawn } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PORT = 4173;
const BASE = '/rpg_game/';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const vite = path.join(root, 'node_modules', 'vite', 'bin', 'vite.js');

/** このPCの LAN の IPv4 アドレス（仮想アダプタ・自動割り当てに失敗したアドレスは除く） */
function lanAddresses() {
  const out = [];
  for (const [name, list] of Object.entries(os.networkInterfaces())) {
    if (/vEthernet|VirtualBox|VMware|WSL|Loopback/i.test(name)) continue;
    for (const a of list ?? []) {
      if (a.family === 'IPv4' && !a.internal && !a.address.startsWith('169.254.')) out.push(a.address);
    }
  }
  return out;
}

function banner() {
  const ips = lanAddresses();
  const line = '='.repeat(56);
  console.log(`\n${line}`);
  console.log('  FIT QUEST  スマホ用サーバー（このウィンドウは閉じないでください）');
  console.log(line);
  if (ips.length === 0) {
    console.log('  ※ ネットワークにつながっていません。Wi-Fi / LAN を確認してください');
  }
  for (const ip of ips) console.log(`  iPhone の Safari で開く:  http://${ip}:${PORT}${BASE}`);
  console.log(`  IP が変わっても使える（試してみてください）:  http://${os.hostname()}.local:${PORT}${BASE}`);
  console.log(`  このPCで開く:  http://localhost:${PORT}${BASE}`);
  console.log(`${line}\n`);
  return ips.join(',');
}

let shownIps = banner();
let quickFails = 0;

function start() {
  const startedAt = Date.now();
  // --strictPort：4173 番が使えないときは別の番号に逃げず、はっきり止まる（アドレスが変わってしまうのを防ぐ）
  const child = spawn(process.execPath, [vite, 'preview', '--host', '--port', String(PORT), '--strictPort'], {
    cwd: root,
    stdio: 'inherit',
  });
  child.on('exit', (code) => {
    const quick = Date.now() - startedAt < 5000;
    quickFails = quick ? quickFails + 1 : 0;
    if (quickFails >= 3) {
      console.log(`\n  ${PORT} 番が使えません。すでに別のウィンドウでサーバーが動いていないか確認してください。`);
      process.exit(1);
    }
    console.log(`\n  サーバーが止まりました（${code}）。2 秒後に起動し直します…`);
    setTimeout(start, 2000);
  });
}
start();

// IP アドレスが変わったら表示し直す（ルーターの再起動などで変わることがある）
setInterval(() => {
  const now = lanAddresses().join(',');
  if (now !== shownIps) {
    console.log('\n  ※ このPCの IP アドレスが変わりました。新しいアドレスで開いてください。');
    shownIps = banner();
  }
}, 15000);
