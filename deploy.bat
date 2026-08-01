@echo off
rem ============================================================
rem  一键发布到 GitHub Pages
rem  用法：双击运行即可（需要先开启本机代理 7897）
rem  前提：本仓库已初始化并关联远程（首次由 AI 设置）
rem ============================================================
cd /d "%~dp0"

echo Publishing to GitHub Pages...

rem 自动更新资源版本号，防止微信/浏览器缓存旧版
node scripts\bump.js

git add -A
git commit -m "update: %date% %time%"
git push origin main

if errorlevel 1 (
  echo.
  echo FAILED. Please check:
  echo  1. Proxy (127.0.0.1:7897) is ON
  echo  2. Token in remote URL is still valid
  echo.
) else (
  echo.
  echo DONE! Wait 1-2 minutes, then refresh your page.
  echo.
)

pause
