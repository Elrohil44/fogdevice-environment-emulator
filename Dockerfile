FROM node:12-alpine

WORKDIR /app

ENV DATA_DIR = "/app/emulation-data"

COPY ./package.json ./yarn.lock ./
RUN yarn install --frozen-lockfile && mkdir $DATA_DIR

COPY ./src /app/src

CMD yarn start
EXPOSE $PORT
