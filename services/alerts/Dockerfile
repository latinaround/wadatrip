# syntax=docker/dockerfile:1

FROM node:20-slim

WORKDIR /app

RUN corepack prepare pnpm@9.12.0 --activate

COPY package.json tsconfig.base.json yarn.lock .yarnrc.yml ./
COPY libs ./libs
COPY services ./services

RUN pnpm install --prefer-offline

RUN pnpm build

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["pnpm","start"]
