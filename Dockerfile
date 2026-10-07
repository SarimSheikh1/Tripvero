FROM node:24-alpine
WORKDIR /app
COPY package.json package-lock.json ./
COPY client/package.json ./client/package.json
COPY server/package.json ./server/package.json
RUN npm ci --ignore-scripts
COPY client ./client
COPY server ./server
COPY scripts ./scripts
RUN npm run build && mkdir -p /app/server/uploads && chown -R node:node /app/server/uploads
ENV NODE_ENV=production
EXPOSE 5000
USER node
CMD ["node", "server/server.js"]
