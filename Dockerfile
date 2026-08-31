FROM node:26.8.1-alpine3.23 AS build

# Set working directory
WORKDIR /app

# Copy the source code
COPY . .

# Install dependencies
RUN npm ci --ignore-scripts

# Build the application
RUN npm run build

# RUNTIME STAGE
FROM node:26.8.1-alpine3.23

# Set working directory
WORKDIR /app

# Copy package files and install production dependencies
COPY --from=build --chown=node:node /app/package.json /app/package-lock.json /app/.npmrc /app/
RUN npm ci --only=production --ignore-scripts \
  && npm cache clean --force \
  && rm -rf /usr/local/lib/node_modules/npm \
  && rm -f /usr/local/bin/npm /usr/local/bin/npx

# Copy the built application
COPY --from=build --chown=node:node /app/dist /app/dist

# Run image as non-root user
USER node

# Start the application
CMD ["node", "dist/index.js"]
