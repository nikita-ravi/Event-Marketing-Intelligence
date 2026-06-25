# Event Campaign Advisor

An agentic AI application that helps marketers find the best upcoming events to time their ad campaigns around — powered by the Ticketmaster API, LangChain, and NVIDIA NeMo Guardrails.

**Built with [Claude Code](https://www.anthropic.com/claude-code) (agentic IDE)**

---

## What It Does

You describe your brand and target market. The agent searches Ticketmaster for real upcoming events, scores them deterministically (0–135 points) across six factors, applies LLM reasoning to adjust scores for your specific context, and presents ranked recommendations with transparent rationale. Input and output are filtered by NeMo Guardrails to prevent prompt injection, off-topic queries, and system disclosure.

---

## Architecture

```
┌──────────────────────────────────────────┐
│           React Frontend                 │
│         localhost:5173                   │
└──────────────┬───────────────────────────┘
               │ HTTP + SSE
┌──────────────▼───────────────────────────┐
│       Express + LangChain Backend        │  ◄── NeMo Guardrails (localhost:8001)
│         localhost:3001                   │
└──────────────┬───────────────────────────┘
               │ stdio (MCP protocol)
┌──────────────▼───────────────────────────┐
│           MCP Server                     │
│    (Ticketmaster API wrapper)            │
└──────────────┬───────────────────────────┘
               │ HTTPS
┌──────────────▼───────────────────────────┐
│      Ticketmaster Discovery API v2       │
└──────────────────────────────────────────┘
```

**Four services:**

| Service | Language | Port | Purpose |
|---|---|---|---|
| `frontend/` | React + Vite | 5173 | Chat UI + campaign calendar |
| `agent-backend/` | Node.js + Express + LangChain | 3001 | LLM agent, tool orchestration, SSE streaming |
| `mcp-server/` | Node.js + TypeScript | stdio | Ticketmaster API wrapper (MCP protocol) |
| `guardrails-service/` | Python + FastAPI + NeMo | 8001 | Input/output safety rails |

---

## Project Structure

```
event-marketing/
├── frontend/                   # React frontend
│   ├── src/
│   │   ├── App.tsx             # Main app, SSE pipeline handler
│   │   ├── App.css
│   │   └── components/
│   │       ├── ChatWindow.tsx  # Chat interface
│   │       ├── EventCard.tsx   # Recommendation card UI
│   │       ├── CalendarStrip.tsx  # Campaign calendar
│   │       └── ConfirmModal.tsx
│   ├── Dockerfile
│   ├── nginx.conf
│   └── package.json
│
├── agent-backend/              # LLM agent backend
│   ├── src/
│   │   ├── index.ts            # Express server, SSE endpoint, NeMo integration
│   │   ├── langchainAgent.ts   # LangChain ReAct agent, tool definitions, forced tool call
│   │   ├── systemPrompt.ts     # Prompt engineering (security guardrails, query routing, few-shot)
│   │   ├── mcpClient.ts        # MCP stdio client
│   │   ├── guardrails.ts       # Event ID validation (hallucination prevention)
│   │   └── logger.ts           # Winston structured logging
│   ├── Dockerfile
│   └── package.json
│
├── mcp-server/                 # MCP server — Ticketmaster API wrapper
│   ├── src/
│   │   ├── index.ts            # MCP tool registry + request handler
│   │   ├── ticketmasterClient.ts  # HTTP client for Ticketmaster
│   │   ├── types.ts            # Shared TypeScript types
│   │   └── tools/
│   │       ├── searchEvents.ts
│   │       ├── getEventDetails.ts
│   │       ├── scoreEventsBaseline.ts   # Deterministic 0–135 scoring engine
│   │       ├── searchAttractions.ts
│   │       └── getAttractionTour.ts
│   ├── Dockerfile
│   └── package.json
│
├── guardrails-service/         # Python NeMo Guardrails microservice
│   ├── main.py                 # FastAPI app — /check-input, /check-output, /health
│   ├── config/
│   │   ├── config.yml          # NeMo rails config (self check input/output)
│   │   └── rails.co            # Colang — custom bot refusal message
│   ├── requirements.txt
│   ├── Dockerfile
│   └── .env.example
│
├── docker-compose.yml          # Full stack orchestration
└── README.md
```

---

## Prerequisites

| Requirement | Version | Notes |
|---|---|---|
| Node.js | v20+ | [nodejs.org](https://nodejs.org) |
| Python | 3.10+ | For guardrails-service only |
| Ticketmaster API key | Free | [developer.ticketmaster.com](https://developer.ticketmaster.com/) → Create App |
| Anthropic API key | Paid | [console.anthropic.com](https://console.anthropic.com/) |
| NVIDIA API key | Free tier | [build.nvidia.com](https://build.nvidia.com/) → Get API Key (for NeMo Guardrails) |

> The NVIDIA key is only needed for the guardrails service. The main app works without it (guardrails fail open — requests pass through if the service is down).

---

## Setup & Run

### Step 1 — Clone the repo

```bash
git clone https://github.com/nikita-ravi/Event-Marketing-Intelligence.git
cd Event-Marketing-Intelligence
```

### Step 2 — Install Node dependencies

```bash
cd mcp-server && npm install && cd ..
cd agent-backend && npm install && cd ..
cd frontend && npm install && cd ..
```

### Step 3 — Configure environment variables

**MCP Server** — Ticketmaster key only:
```bash
cd mcp-server
cp .env.example .env
```
Edit `.env`:
```env
TICKETMASTER_API_KEY=your_ticketmaster_key_here
```

**Agent Backend** — Anthropic key:
```bash
cd agent-backend
cp .env.example .env
```
Edit `.env`:
```env
ANTHROPIC_API_KEY=your_anthropic_key_here
PORT=3001
MCP_SERVER_PATH=../mcp-server/src/index.ts
GUARDRAILS_URL=http://localhost:8001
```

**Guardrails Service** — NVIDIA key:
```bash
cd guardrails-service
cp .env.example .env
```
Edit `.env`:
```env
NVIDIA_API_KEY=your_nvidia_key_here
PORT=8001
```

### Step 4 — Start the services

You need **3 terminals** (4 if running guardrails):

```bash
# Terminal 1 — Agent backend (also spawns MCP server automatically over stdio)
cd agent-backend
npm run dev
# Expected output: "Agent backend running on http://localhost:3001"
```

```bash
# Terminal 2 — Frontend
cd frontend
npm run dev
# Expected output: "Local: http://localhost:5173/"
```

```bash
# Terminal 3 — Guardrails service (optional but recommended)
cd guardrails-service
python -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8001
# Expected output: "NeMo Guardrails initialised — meta/llama-3.1-8b-instruct via NVIDIA NIM"
```

### Step 5 — Open the app

Navigate to **http://localhost:5173**

Try: *"Find country music events in Washington DC in July 2026 for my beer brewery"*

---

## Verify Everything Is Running

```bash
# Agent backend health
curl http://localhost:3001/health

# Guardrails health
curl http://localhost:8001/health
```

Expected backend response:
```json
{ "status": "ok", "agent": "initialized", "architecture": "hybrid-reasoning" }
```

---

## Docker (Alternative)

Requires Docker and Docker Compose. Create a `.env` file at the project root:

```env
ANTHROPIC_API_KEY=your_anthropic_key_here
TICKETMASTER_API_KEY=your_ticketmaster_key_here
NVIDIA_API_KEY=your_nvidia_key_here
```

Then:
```bash
docker-compose up --build
```

App available at **http://localhost** (port 80).

---

## The 6 MCP Tools

The MCP Server exposes six tools to the LangChain agent via the Model Context Protocol over stdio:

| Tool | Purpose |
|---|---|
| `search_events` | Search Ticketmaster by location, genre, date range, attraction, or radius |
| `get_event_details` | Full detail for a specific event — pricing, parking, on-sale dates, capacity |
| `score_events_baseline` | Deterministic 0–135 point scoring engine — auditable, no LLM involved |
| `search_attractions` | Find any artist, band, or sports team by keyword → returns Ticketmaster ID |
| `get_attraction_tour` | Pull an attraction's full upcoming tour schedule, optionally filtered by country |
| `present_recommendation` | Schema-enforced final answer tool — agent must call this to respond |

---

## API Endpoints

### POST /chat-stream
Main endpoint — returns Server-Sent Events with real-time pipeline steps.

```bash
curl -X POST http://localhost:3001/chat-stream \
  -H "Content-Type: application/json" \
  -d '{"message": "Find jazz events in New Orleans for my restaurant in August 2026"}'
```

SSE event types: `pipeline` (step updates) → `final` (result with recommendations)

### POST /chat
Non-streaming fallback — returns full response in one JSON payload.

```bash
curl -X POST http://localhost:3001/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Find jazz events in New Orleans for my restaurant in August 2026"}'
```

### POST /reset
Reset conversation history.

```bash
curl -X POST http://localhost:3001/reset
```

### GET /health
```bash
curl http://localhost:3001/health
```

---

## How the Scoring Works

Every event goes through two scoring layers:

1. **Baseline (deterministic)** — `score_events_baseline` in the MCP server scores each event on six fixed factors. No LLM. Always reproducible.

   | Factor | Max Points |
   |---|---|
   | Classification match (Music / Sports / Arts) | 50 |
   | Weekend timing (Fri / Sat / Sun) | 30 |
   | Evening hours (5 PM+) | 20 |
   | Premium pricing ($75+) | 10 |
   | Venue capacity (5,000+ seats) | 15 |
   | Distance proximity (within 10 miles) | 10 |
   | **Total** | **135** |

2. **LLM adjustment** — the agent reads the baseline scores and the user's brand context, adjusts scores up or down, and explains every change. The adjusted score is also capped at 135.

Every `eventId` in the final recommendation is validated against the original search results. If the LLM hallucinates an ID, the system automatically falls back to the deterministic baseline output.

---

## NeMo Guardrails

The `guardrails-service` is a standalone Python/FastAPI microservice using NVIDIA NeMo Guardrails 0.10 and `meta/llama-3.1-8b-instruct` via NVIDIA NIM.

It intercepts every request at two points:

- **Input check** (`POST /check-input`) — called before the LangChain agent runs. Blocks: system prompt disclosure attempts, scoring algorithm questions, prompt injection / jailbreak attempts, and off-topic queries.
- **Output check** (`POST /check-output`) — called after the agent responds. Catches any policy violations in the generated output.

If the guardrails service is unreachable, the main app fails open — requests pass through. The main app never hard-depends on it.

---

## Key Engineering Decisions

**Why MCP over direct HTTP?**
The LangChain agent never touches the Ticketmaster API directly. The MCP server is the only component that holds the API key and makes HTTP calls. This means the agent layer is completely decoupled from the data layer — swap Ticketmaster for any other events API without changing a line of agent code.

**Why forced `tool_choice: "any"`?**
Claude at temperature 0.2 is deterministic enough that it will skip tool calls for questions it "knows" the answer to from training data (e.g. artist tour schedules). We force the model to call at least one tool on the first step of every turn — the model still picks which tool based on the system prompt, but it can't skip them entirely.

**Why a deterministic scoring layer?**
LLM scores alone are a black box. The `score_events_baseline` tool produces an auditable, reproducible score before the LLM sees any results. The LLM's job is to adjust that score based on context the algorithm can't know — brand category, neighbourhood specifics, timing priorities. Both layers are visible to the user.
