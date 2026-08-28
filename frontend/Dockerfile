# Build stage
FROM node:24-slim AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy project files
COPY . .

# Build the production bundle
RUN npm run build

# Production stage
FROM nginx:alpine

# Copy the built assets from the builder stage (Vite outputs to /app/dist by default)
COPY --from=builder /app/dist /usr/share/nginx/html

# Use custom nginx config that prevents index.html from being cached
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
