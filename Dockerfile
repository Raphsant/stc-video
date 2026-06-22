# Build Stage 1
FROM node:22-alpine AS build
WORKDIR /app

# Enable Corepack to use the version of Yarn specified in your package.json
RUN corepack enable

# Copy package.json and your yarn lockfile
COPY package.json yarn.lock .npmrc* ./

# Install dependencies
RUN yarn install --frozen-lockfile

# Copy the entire project
COPY . ./

# Build the project
RUN yarn run build

# Build Stage 2
FROM node:22-alpine
WORKDIR /app

# Only `.output` folder is needed from the build stage
COPY --from=build /app/.output/ ./

# Change the port and host
ENV NODE_ENV=production
ENV PORT=29051
ENV HOST=0.0.0.0

EXPOSE 29051

CMD ["node", "/app/server/index.mjs"]
