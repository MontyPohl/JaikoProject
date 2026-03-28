FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

RUN npm run build

EXPOSE 3000

CMD sh -c "npx serve -s dist --listen tcp://0.0.0.0:${PORT:-3000}"