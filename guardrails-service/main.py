"""
NeMo Guardrails microservice for the Event Campaign Advisor.

Uses NeMo's built-in self_check_input / self_check_output actions which make
a single direct LLM policy-evaluation call per request via NVIDIA NIM.

Endpoints:
  POST /check-input  — block bad queries before the LangChain agent sees them
  POST /check-output — sanitise agent responses before they reach the user
  GET  /health       — liveness probe

Fail-open: guardrails outage never takes down the main app.
"""

import os
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from nemoguardrails import RailsConfig, LLMRails
from langchain_openai import ChatOpenAI

load_dotenv()

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("guardrails-service")

# ── Initialise NeMo rails with NVIDIA NIM via ChatOpenAI ──────────────────────

NVIDIA_API_KEY = os.environ.get("NVIDIA_API_KEY")
if not NVIDIA_API_KEY:
    raise RuntimeError("NVIDIA_API_KEY is not set in environment")

# Inject ChatOpenAI directly into LLMRails so NeMo's engine resolver is bypassed.
# NVIDIA NIM is OpenAI-compatible — we point ChatOpenAI at NVIDIA's endpoint.
llm = ChatOpenAI(
    model="meta/llama-3.1-8b-instruct",
    openai_api_key=NVIDIA_API_KEY,
    openai_api_base="https://integrate.api.nvidia.com/v1",
    temperature=0.0,
    max_tokens=64,  # guardrail responses are always short
)

config = RailsConfig.from_path("./config")
rails = LLMRails(config, llm=llm)

log.info("NeMo Guardrails initialised — meta/llama-3.1-8b-instruct via NVIDIA NIM")

REFUSAL_MESSAGE = (
    "I'm only able to help with event campaign planning. "
    "Please ask me about finding events or campaign timing."
)

# ── FastAPI app ────────────────────────────────────────────────────────────────

app = FastAPI(title="NeMo Guardrails Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)


def _extract_text(result) -> str:
    """NeMo 0.10.x generate_async may return a str or a dict."""
    if isinstance(result, str):
        return result
    if isinstance(result, dict):
        return result.get("content", result.get("text", str(result)))
    return str(result)


# ── Request / response schemas ─────────────────────────────────────────────────

class InputCheckRequest(BaseModel):
    message: str

class InputCheckResponse(BaseModel):
    allowed: bool
    blocked_response: str | None = None

class OutputCheckRequest(BaseModel):
    user_message: str
    bot_response: str

class OutputCheckResponse(BaseModel):
    allowed: bool
    sanitized_response: str | None = None


# ── Endpoints ──────────────────────────────────────────────────────────────────

@app.post("/check-input", response_model=InputCheckResponse)
async def check_input(req: InputCheckRequest):
    """
    Run self_check_input rail.  NeMo asks llama-3.1-8b-instruct to evaluate
    whether the user message violates the policy prompt.  If yes, returns
    the Colang refusal; if no, returns allowed=True.
    Fails open on error.
    """
    try:
        log.info(f"Input check: {req.message[:80]!r}")

        result = await rails.generate_async(
            messages=[{"role": "user", "content": req.message}]
        )
        text = _extract_text(result)
        log.info(f"NeMo input result: {text[:120]!r}")

        is_blocked = REFUSAL_MESSAGE.lower() in text.lower()

        if is_blocked:
            log.warning(f"Input BLOCKED: {req.message[:80]!r}")
            return InputCheckResponse(allowed=False, blocked_response=REFUSAL_MESSAGE)

        log.info("Input ALLOWED")
        return InputCheckResponse(allowed=True)

    except Exception as exc:
        log.error(f"Input guardrail error (failing open): {exc}")
        return InputCheckResponse(allowed=True)


@app.post("/check-output", response_model=OutputCheckResponse)
async def check_output(req: OutputCheckRequest):
    """
    Run self_check_output rail on the agent's response.
    Fails open on error.
    """
    try:
        log.info("Output check running")

        result = await rails.generate_async(
            messages=[
                {"role": "user",      "content": req.user_message},
                {"role": "assistant", "content": req.bot_response},
            ]
        )
        text = _extract_text(result)
        log.info(f"NeMo output result: {text[:120]!r}")

        is_blocked = REFUSAL_MESSAGE.lower() in text.lower()

        if is_blocked:
            log.warning("Output BLOCKED by guardrail")
            return OutputCheckResponse(allowed=False, sanitized_response=REFUSAL_MESSAGE)

        log.info("Output ALLOWED")
        return OutputCheckResponse(allowed=True)

    except Exception as exc:
        log.error(f"Output guardrail error (failing open): {exc}")
        return OutputCheckResponse(allowed=True)


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "service": "nemo-guardrails",
        "model": "meta/llama-3.1-8b-instruct",
        "rails": {
            "input": ["self check input"],
            "output": ["self check output"],
        },
    }
