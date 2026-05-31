FROM node:20-alpine
WORKDIR /usr/src/app
COPY package.json ./
RUN npm install --no-package-lock --omit=dev
COPY tsconfig.json ./
COPY src ./src
CMD ["npm", "start"]
