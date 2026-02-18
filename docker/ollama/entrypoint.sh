#!/usr/bin/env bash
set -euo pipefail

ollama serve &

until ollama list >/dev/null 2>&1; do
  sleep 1
done

DEFAULT_MODELS="${OLLAMA_MODEL:-llama3.2:3b} llama3.2:1b"
MODELS="${OLLAMA_PRELOAD_MODELS:-$DEFAULT_MODELS}"

for model in $MODELS; do
  [ -n "${model:-}" ] || continue
  if [[ "$model" =~ :([0-9]+(\.[0-9]+)?)b ]]; then
    size="${BASH_REMATCH[1]}"
    if awk "BEGIN {exit !($size > 7)}"; then
      echo "Skipping model >7B: $model"
      continue
    fi
  fi
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
