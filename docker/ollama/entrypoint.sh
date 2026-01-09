#!/usr/bin/env bash
set -euo pipefail

ollama serve &

until ollama list >/dev/null 2>&1; do
  sleep 1
done

model="${OLLAMA_MODEL:-llama3.1}"
if ! ollama list | awk '{print $1}' | grep -qx "$model"; then
  ollama pull "$model"
fi

wait -n
