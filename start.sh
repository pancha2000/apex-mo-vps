#!/usr/bin/env bash
# One command to install + run APEX-MD on an Ubuntu VPS:   bash start.sh
set -e
cd "$(dirname "$0")"

NODE_MAJOR=0
command -v node >/dev/null 2>&1 && NODE_MAJOR=$(node -v | sed 's/v\([0-9]*\).*/\1/')
if [ "$NODE_MAJOR" -lt 20 ]; then
  echo "📦 Node.js $NODE_MAJOR is too old - installing Node.js 20..."
  sudo apt-get remove -y nodejs npm libnode-dev >/dev/null 2>&1 || true
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
  hash -r
  rm -rf node_modules   # was installed with the old Node
fi
echo "✅ Node $(node -v) / npm $(npm -v)"

command -v pm2 >/dev/null 2>&1 || { echo "📦 Installing pm2..."; sudo npm install -g pm2; }

# Downloader tools (.dl): ffmpeg (merge/convert) + yt-dlp (YouTube, Facebook, TikTok ...)
command -v ffmpeg >/dev/null 2>&1 || { echo "📦 Installing ffmpeg..."; sudo apt-get update -y && sudo apt-get install -y ffmpeg; }
if ! command -v yt-dlp >/dev/null 2>&1; then
  echo "📦 Installing yt-dlp..."
  sudo curl -fsSL https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp
  sudo chmod a+rx /usr/local/bin/yt-dlp
fi

echo "📦 Installing dependencies..."
npm install --omit=dev

[ -f config.env ] || echo "⚠️  config.env not found - copy config.env.example to config.env and fill it."
mkdir -p "$(grep -E '^VPS_FILES_DIR=' config.env 2>/dev/null | cut -d= -f2- || echo files)" 2>/dev/null || true

pm2 delete APEX-MD >/dev/null 2>&1 || true
pm2 start index.js --name APEX-MD
pm2 save
echo "✅ APEX-MD running.  Logs: pm2 logs APEX-MD"
