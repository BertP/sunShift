FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
COPY node_modules ./node_modules
COPY . .
RUN npm run build


EXPOSE 3000

CMD ["npm", "start"]
