FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY dist/ ./dist/
COPY .env ./
EXPOSE 3005
CMD ["node", "dist/index.js"]
