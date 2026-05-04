import asyncio
import json
import os
import tempfile
import time
import uuid
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, Header, HTTPException
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel


MODEL_ID = os.environ.get("CODEX_BRIDGE_MODEL", "codex-cli").strip() or "codex-cli"
CODEX_MODEL = os.environ.get("CODEX_BRIDGE_CODEX_MODEL", "").strip()
WORKDIR = os.environ.get("CODEX_BRIDGE_WORKDIR", "/workspace").strip() or "/workspace"
TIMEOUT_SECONDS = max(10, int(os.environ.get("CODEX_BRIDGE_TIMEOUT_SECONDS", "300") or "300"))
API_KEY = os.environ.get("CODEX_BRIDGE_API_KEY", "").strip()
SANDBOX = os.environ.get("CODEX_BRIDGE_SANDBOX", "read-only").strip() or "read-only"
EXTRA_ARGS = [part for part in os.environ.get("CODEX_BRIDGE_EXTRA_ARGS", "").split(" ") if part.strip()]


app = FastAPI(title="Codex API Bridge", version="0.1.0")


class ChatMessage(BaseModel):
    role: str
    content: Any = ""


class ChatCompletionRequest(BaseModel):
    model: Optional[str] = None
    messages: List[ChatMessage]
    temperature: Optional[float] = None
    max_tokens: Optional[int] = None
    stream: Optional[bool] = False


def _authorize(authorization: Optional[str]) -> None:
    if not API_KEY:
        return
    expected = f"Bearer {API_KEY}"
    if authorization != expected:
        raise HTTPException(401, "Unauthorized")


def _content_to_text(content: Any) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts: List[str] = []
        for item in content:
            if isinstance(item, dict):
                if item.get("type") == "text":
                    parts.append(str(item.get("text") or ""))
                elif "text" in item:
                    parts.append(str(item.get("text") or ""))
            elif item is not None:
                parts.append(str(item))
        return "\n".join(part for part in parts if part.strip())
    if content is None:
        return ""
    return str(content)


def _messages_to_prompt(messages: List[ChatMessage]) -> str:
    lines: List[str] = []
    for message in messages:
        role = str(message.role or "user").strip().lower()
        text = _content_to_text(message.content).strip()
        if not text:
            continue
        if role == "system":
            lines.append(f"System:\n{text}")
        elif role == "assistant":
            lines.append(f"Assistant bisher:\n{text}")
        else:
            lines.append(f"User:\n{text}")
    return "\n\n".join(lines).strip()


def _codex_command(output_file: str, model: str) -> List[str]:
    command = [
        "codex",
        "exec",
        "--skip-git-repo-check",
        "--sandbox",
        SANDBOX,
        "--cd",
        WORKDIR,
        "--output-last-message",
        output_file,
        "--color",
        "never",
    ]
    resolved_model = (model or CODEX_MODEL).strip()
    if resolved_model and resolved_model != MODEL_ID:
        command.extend(["--model", resolved_model])
    command.extend(EXTRA_ARGS)
    command.append("-")
    return command


async def _run_codex(prompt: str, requested_model: str) -> str:
    if not prompt:
        raise HTTPException(400, "messages are required")
    os.makedirs(WORKDIR, exist_ok=True)
    with tempfile.NamedTemporaryFile("w+", delete=False, suffix=".txt") as handle:
        output_path = handle.name
    try:
        process = await asyncio.create_subprocess_exec(
            *_codex_command(output_path, requested_model),
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await asyncio.wait_for(
            process.communicate(prompt.encode("utf-8")),
            timeout=TIMEOUT_SECONDS,
        )
        if process.returncode != 0:
            detail = (stderr or stdout).decode("utf-8", errors="replace").strip()
            if "not logged in" in detail.lower() or "login" in detail.lower():
                raise HTTPException(401, "Codex CLI ist nicht eingeloggt. Im Container einmal `codex login` ausfuehren.")
            raise HTTPException(502, detail[-2000:] or "Codex CLI failed")
        try:
            with open(output_path, "r", encoding="utf-8") as handle:
                result = handle.read().strip()
        except FileNotFoundError:
            result = ""
        if not result:
            result = stdout.decode("utf-8", errors="replace").strip()
        return result.strip()
    except asyncio.TimeoutError as exc:
        raise HTTPException(504, f"Codex CLI timeout after {TIMEOUT_SECONDS}s") from exc
    finally:
        try:
            os.unlink(output_path)
        except OSError:
            pass


def _completion_payload(request: ChatCompletionRequest, content: str) -> Dict[str, Any]:
    created = int(time.time())
    model = request.model or MODEL_ID
    return {
        "id": f"chatcmpl-{uuid.uuid4().hex}",
        "object": "chat.completion",
        "created": created,
        "model": model,
        "choices": [
            {
                "index": 0,
                "message": {"role": "assistant", "content": content},
                "finish_reason": "stop",
            }
        ],
        "usage": {
            "prompt_tokens": 0,
            "completion_tokens": 0,
            "total_tokens": 0,
        },
    }


def _stream_payload(request: ChatCompletionRequest, content: str):
    model = request.model or MODEL_ID
    completion_id = f"chatcmpl-{uuid.uuid4().hex}"
    created = int(time.time())
    first = {
        "id": completion_id,
        "object": "chat.completion.chunk",
        "created": created,
        "model": model,
        "choices": [{"index": 0, "delta": {"role": "assistant"}, "finish_reason": None}],
    }
    yield f"data: {json.dumps(first, ensure_ascii=False)}\n\n"
    chunk = {
        "id": completion_id,
        "object": "chat.completion.chunk",
        "created": created,
        "model": model,
        "choices": [{"index": 0, "delta": {"content": content}, "finish_reason": None}],
    }
    yield f"data: {json.dumps(chunk, ensure_ascii=False)}\n\n"
    done = {
        "id": completion_id,
        "object": "chat.completion.chunk",
        "created": created,
        "model": model,
        "choices": [{"index": 0, "delta": {}, "finish_reason": "stop"}],
    }
    yield f"data: {json.dumps(done, ensure_ascii=False)}\n\n"
    yield "data: [DONE]\n\n"


@app.get("/health")
def health():
    return {"ok": True, "model": MODEL_ID, "workdir": WORKDIR}


@app.get("/v1/models")
def list_models(authorization: Optional[str] = Header(default=None)):
    _authorize(authorization)
    return {
        "object": "list",
        "data": [
            {
                "id": MODEL_ID,
                "object": "model",
                "created": 0,
                "owned_by": "codex-cli",
            }
        ],
    }


@app.post("/v1/chat/completions")
async def chat_completions(request: ChatCompletionRequest, authorization: Optional[str] = Header(default=None)):
    _authorize(authorization)
    prompt = _messages_to_prompt(request.messages)
    content = await _run_codex(prompt, request.model or MODEL_ID)
    if request.stream:
        return StreamingResponse(_stream_payload(request, content), media_type="text/event-stream")
    return JSONResponse(_completion_payload(request, content))

