FROM ollama/ollama:latest

# curl is needed by the healthcheck and the entrypoint readiness probe.
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Models auto-pulled on first start (comma-separated, override at runtime).
# See entrypoint.sh for sizing guidance per host. Keep the embedding model in
# sync with OPENAI_EMBEDDING_MODEL in agentmemory.env.
ENV OLLAMA_MODELS=qwen2.5:3b-instruct,mxbai-embed-large

EXPOSE 11434

ENTRYPOINT ["/entrypoint.sh"]
