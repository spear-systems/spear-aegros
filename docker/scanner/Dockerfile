# Minimal Linux sidecar implementing `aegros.scanner.v1` stdin/stdout protocol.
# Build: docker build -t spearsystems/aegros-scanner:local -f docker/scanner/Dockerfile docker/scanner
FROM node:22-alpine
WORKDIR /app
COPY scanner.mjs ./scanner.mjs
RUN chmod +x scanner.mjs
ENTRYPOINT ["node", "/app/scanner.mjs"]
