FROM node:22-alpine

WORKDIR /app

COPY package.json ./
COPY src ./src
COPY public ./public

ENV PORT=3000
ENV HOST=0.0.0.0
EXPOSE 3000

CMD ["node", "src/server.js"]
