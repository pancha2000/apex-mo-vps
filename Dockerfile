FROM node:20-slim
WORKDIR /app
COPY package*.json .npmrc ./
# package-lock.json is optional: if missing, npm creates it automatically during install
RUN npm install --omit=dev
COPY . .
EXPOSE 8000
CMD ["node", "index.js"]
