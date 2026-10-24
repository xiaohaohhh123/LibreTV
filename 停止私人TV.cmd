@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo 未找到 Node.js。请安装 Node.js 22 或更新的长期支持版后重试。
  pause
  exit /b 1
)
node "%~dp0scripts\local-preview.cjs" stop %*
if errorlevel 1 (
  pause
  exit /b 1
)
