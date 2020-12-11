FROM node:alpine

WORKDIR /usr/app

COPY ./package*.json yarn.lock ./

RUN yarn install

COPY ./ ./

RUN yarn lint 

RUN yarn build

EXPOSE 3000

CMD ["node", "./src/app.js"]