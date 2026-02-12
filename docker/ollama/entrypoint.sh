#!/usr/bin/env bash
set -euo pipefail

ollama serve &

until ollama list >/dev/null 2>&1; do
  sleep 1
done

DEFAULT_MODELS="${OLLAMA_MODEL:-llama3.1} qwen2.5:14b qwen2.5:32b"
MODELS="${OLLAMA_PRELOAD_MODELS:-$DEFAULT_MODELS}"

for model in $MODELS; do
  [ -n "${model:-}" ] || continue
  if ollama list | awk '{print $1}' | grep -qx "$model"; then
    echo "Model already present: $model"
    continue
  fi
  echo "Pulling model: $model"
  if ! ollama pull "$model"; then
    echo "Warning: failed to pull model: $model"
  fi
done

wait -n
