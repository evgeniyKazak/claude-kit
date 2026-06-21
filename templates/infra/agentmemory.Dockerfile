# agentmemory image — combines node:20 (for the app) with the iii engine binary
# extracted from upstream iiidev/iii. Upstream's image is distroless and ships
# only the Rust iii binary; the agentmemory Node app expects to be spawned by
# iii-exec in the same container, so we need both `iii` and `node` together.
#
# Source code (agentmemory-src/) and config.yaml are mounted at RUNTIME — they
# are not baked into the image, so `git pull && npm run build` inside
# agentmemory-src/ takes effect on the next container restart without an image
# rebuild. Clone the source first:
#   git clone https://github.com/rohitg00/agentmemory agentmemory-src
#   (then apply the local-Ollama compress patch from ADR-0002 and `npm run build`)

FROM iiidev/iii:latest AS engine
# (no commands; used only as a copy source below)

FROM node:20-slim

COPY --from=engine /app/iii /usr/local/bin/iii

# iii reads --config from /app/config.yaml; the iii-exec worker invokes the app
# via the absolute path /agentmemory-src/dist/index.mjs (set in config.yaml).
WORKDIR /app

# Run as the same nonroot uid upstream uses so volume permissions stay consistent.
RUN groupadd -g 65532 nonroot && useradd -u 65532 -g 65532 -m -s /usr/sbin/nologin nonroot
USER 65532

ENTRYPOINT ["iii"]
CMD ["--config", "/app/config.yaml"]
