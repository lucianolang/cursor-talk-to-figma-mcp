FROM oven/bun:latest

WORKDIR /app

COPY package.json bun.lockb ./

RUN bun install

COPY . .

RUN bun run build

EXPOSE 3055

CMD ["node", "dist/figma.cjs", "serve", "--port", "3055", "--host", "0.0.0.0"]
