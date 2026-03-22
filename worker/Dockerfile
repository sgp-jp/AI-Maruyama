FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY index.js ./index.js
CMD ["npm", "run", "start"]
