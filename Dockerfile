# syntax=docker/dockerfile:1
FROM node:20-bullseye-slim AS builder

WORKDIR /app

# Enable corepack (Yarn)
RUN corepack enable

# Copy workspace manifests first for better cache usage
COPY package.json yarn.lock .yarnrc.yml ./
COPY .yarn ./.yarn

# Copy workspace package manifests
COPY apps/gateway/package.json apps/gateway/package.json
COPY libs/db/package.json libs/db/package.json
COPY libs/common/package.json libs/common/package.json
COPY services/alerts/package.json services/alerts/package.json


# Install all workspaces (node-modules linker)
RUN yarn install --immutable

# Copy the full repo
COPY . .

# Build required workspaces in order
RUN yarn workspace @wadatrip/db build
RUN yarn workspace @wadatrip/common build
RUN yarn workspace @wadatrip/service-gateway build
RUN yarn workspace @wadatrip/service-alerts build



FROM node:20-bullseye-slim AS runner

WORKDIR /app
ENV NODE_ENV=production

# Enable corepack (Yarn)
RUN corepack enable

# Copy node_modules and built artifacts
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/gateway/dist ./apps/gateway/dist
COPY --from=builder /app/apps/gateway/package.json ./apps/gateway/package.json

# Optional: keep workspace manifests for clarity/debug
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/yarn.lock ./yarn.lock
COPY --from=builder /app/.yarnrc.yml ./.yarnrc.yml
COPY --from=builder /app/.yarn ./.yarn

EXPOSE 3000
CMD ["node", "apps/gateway/dist/src/main.js"]
