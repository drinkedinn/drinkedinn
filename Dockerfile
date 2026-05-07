FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package.json ./
COPY server/package.json server/
COPY client/package.json client/

# Install dependencies
RUN npm run install:all

# Copy source code
COPY . .

# Build frontend
RUN npm run build

# Expose port
EXPOSE 4000

# Start production server
CMD ["npm", "start"]
