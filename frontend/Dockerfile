FROM node:20

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Accept build mode (e.g., local, docker, aws)
ARG MODE=local
ENV MODE=$MODE

# Build with Vite
RUN npm run build -- --mode $MODE

# Install a known working version of `serve`
RUN npm install -g serve@14.1.2

EXPOSE 4173

# Correct CMD for production build
CMD ["serve", "-s", "dist", "--listen", "tcp://0.0.0.0:4173"]

