#!/bin/bash
set -e

# Models to install on container start (comma-separated). Override via the
# OLLAMA_MODELS env var in docker-compose.
#
# SIZING — pick by available memory, not by brand. These qwen2.5 GGUF models
# run on NVIDIA, generic CPU, AND Apple Silicon (Metal) alike; the only thing
# that changes per host is the runtime, not the weights.
#   • compress / small tasks : qwen2.5:3b-instruct   (~2 GB, fast, the default)
#   • higher-quality LLM     : qwen2.5:7b-instruct   (~5 GB, needs ≥8 GB free)
#   • embeddings             : mxbai-embed-large     (1024-dim; match agentmemory.env)
# CPU-only hosts: stay at 3b or smaller — 7b on CPU is painfully slow.
# Apple Silicon: do NOT use this script. Run Ollama natively on the host and
#   `ollama pull` the models there (Docker on macOS has no GPU access — see
#   docker-compose.boilerplate.yml and SETUP.md Step 1).
OLLAMA_MODELS="${OLLAMA_MODELS:-qwen2.5:3b-instruct,mxbai-embed-large}"

# Start ollama server in background.
ollama serve &
OLLAMA_PID=$!

echo "Waiting for Ollama to start..."
until curl -s http://localhost:11434/api/version > /dev/null 2>&1; do
    sleep 1
done
echo "Ollama is ready"

install_model() {
    local model="$1"
    if ollama list | grep -q "^${model}"; then
        echo "Model ${model} is already installed"
    else
        echo "Pulling model ${model}..."
        ollama pull "${model}"
        echo "Model ${model} installed successfully"
    fi
}

IFS=',' read -ra MODELS <<< "$OLLAMA_MODELS"
for model in "${MODELS[@]}"; do
    model=$(echo "$model" | xargs)   # trim whitespace
    if [ -n "$model" ]; then
        install_model "$model"
    fi
done

echo "All models ready"

# Keep ollama running in foreground.
wait $OLLAMA_PID
