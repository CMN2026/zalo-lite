FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --no-package-lock --omit=dev
COPY dist/ ./dist/
EXPOSE 3005
CMD ["node", "dist/index.js"]
