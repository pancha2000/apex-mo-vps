FROM node:20-slim

# git: some npm deps are git-based | ffmpeg/zip/python3/curl: used by the .dl downloader
RUN apt-get update && apt-get install -y --no-install-recommends \
      git ca-certificates curl ffmpeg zip python3 \
    && curl -fsSL https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp \
    && chmod a+rx /usr/local/bin/yt-dlp \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json .npmrc ./
RUN npm install --omit=dev
COPY . .
RUN mkdir -p auth_info_baileys files data

ENV PORT=8000
EXPOSE 8000
CMD ["node", "index.js"]
