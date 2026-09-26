@echo off
chcp 65001 > nul
rem FIT QUEST をスマホ（同じ Wi-Fi の iPhone）で遊ぶためのサーバーを起動する。ダブルクリックで使う
cd /d "%~dp0"
title FIT QUEST スマホ用サーバー
if not exist node_modules (
  echo 初回の準備をしています...
  call npm install || goto :error
)
echo 最新のゲームをビルドしています...
call npm run build || goto :error
node scripts\phone-server.mjs
pause
exit /b 0
:error
echo.
echo エラーで止まりました。上のメッセージを確認してください。
pause
exit /b 1
