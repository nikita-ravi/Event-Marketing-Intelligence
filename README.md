# Event-Triggered Campaign Advisor

An intelligent, agentic web application for marketers to discover and evaluate upcoming events for ad campaign timing. Given a brand category and region, the system finds real events (concerts, sports, festivals) via the Ticketmaster Discovery API and recommends which ones are worth scheduling campaigns around, with explainable, deterministic rationale.

Built for the **InMarket AI Builder Challenge** to demonstrate MCP server design, Claude tool-calling, and interpretable AI decision-making.

## Architecture

This project follows a clean 3-tier architecture:

```
┌──────────────┐
│   Frontend   │  React + TypeScript + Vite
│  (Chat UI)   │  User interface for querying events
└──────┬───────┘
       │ HTTP
       ▼
┌──────────────┐
│Agent Backend │  Express + Anthropic SDK
│ (Orchestrator)│  Claude agent with tool-calling
└──────┬───────┘
       │ stdio (MCP Protocol)
       ▼
┌──────────────┐
│  MCP Server  │  Node.js + TypeScript
│(Tool Provider)│  3 tools: search_events, get_event_details, recommend_campaign_window
└──────┬───────┘
       │ HTTPS
       ▼
┌──────────────┐
│ Ticketmaster │  Discovery API v2
│     API      │  Real event data source
└──────────────┘
```

### Why This Architecture?

1. **Separation of Concerns**: Each tier has a single responsibility
   - Frontend: User interaction
   - Agent Backend: Conversation orchestration and LLM integration
   - MCP Server: Data transformation and business logic
   - Ticketmaster: External data source

2. **Swappable Providers**: The MCP server abstracts the event provider — Ticketmaster could be replaced with SeatGeek, Eventbrite, or a mock service without touching the agent or frontend

3. **Testability**: Each service can be tested independently (see test scripts)

4. **Security**: API keys stay server-side; the frontend never sees the Ticketmaster key

## Project Structure

```
/mcp-server               # MCP tool server
  /src
    index.ts             # MCP server entry point, registers tools
    ticketmasterClient.ts # API wrapper for Ticketmaster
    types.ts             # Shared type definitions
    /tools
      searchEvents.ts    # Search + response shaping + caching
      getEventDetails.ts # Event details fetching
      recommendCampaignWindow.ts # Deterministic scoring logic
    test-search.ts       # Standalone test script
  .env.example
  package.json
  tsconfig.json

/agent-backend            # Claude agent orchestrator
  /src
    index.ts             # Express server
    agent.ts             # Main agent logic with tool calling
    systemPrompt.ts      # Agent instructions
    mcpClient.ts         # MCP protocol client
    test-cli.ts          # CLI test interface
  .env.example
  package.json
  tsconfig.json

/frontend                 # React chat interface
  /src
    App.tsx              # Main app component
    App.css              # Global styles
    /components
      ChatWindow.tsx     # Message list + input
      EventCard.tsx      # Event display card
      ConfirmModal.tsx   # Confirmation dialog
  .env.example
  package.json
  tsconfig.json

README.md
PLANNING.md              # Original build plan
.gitignore
```

## Prerequisites

- **Node.js** 18+ and npm
- **Ticketmaster API key** — [Get one here](https://developer.ticketmaster.com/products-and-docs/apis/getting-started/)
- **Anthropic API key** (Claude) — [Get one here](https://console.anthropic.com/)

## Setup

### 1. Clone and Install

```bash
git clone <repository-url>
cd event-marketing

# Install dependencies for all services
cd mcp-server && npm install && cd ..
cd agent-backend && npm install && cd ..
cd frontend && npm install && cd ..
```

### 2. Configure Environment Variables

#### MCP Server

```bash
cd mcp-server
cp .env.example .env
```

Edit `mcp-server/.env` and add your **Ticketmaster API key**:

```env
TICKETMASTER_API_KEY=YOUR_KEY_HERE
```

**IMPORTANT**: Before committing, rotate your key in the [Ticketmaster developer dashboard](https://developer-acct.ticketmaster.com/user/login) if it was exposed in chat or logs.

#### Agent Backend

```bash
cd agent-backend
cp .env.example .env
```

Edit `agent-backend/.env` and add your **Anthropic API key**:

```env
ANTHROPIC_API_KEY=YOUR_KEY_HERE
PORT=3001
MCP_SERVER_PATH=../mcp-server/src/index.ts
```

#### Frontend

```bash
cd frontend
cp .env.example .env.local
```

Edit `frontend/.env.local` (this file is gitignored):

```env
VITE_API_URL=http://localhost:3001
```

### 3. Test Each Layer (Recommended)

#### Test MCP Server (Standalone)

```bash
cd mcp-server
npm run build
npm test
```

This runs `test-search.ts`, which:
- Fetches real events from Ticketmaster
- Verifies response shaping works correctly
- Confirms caching is functional

Expected output:
```
✅ Received 5 events
✅ Response shaping confirmed - has all required fields
✅ Cache working correctly
```

#### Test Agent Backend (CLI, No Frontend)

```bash
cd agent-backend
npm run test-cli
```

This launches an interactive CLI where you can chat with the agent. Try:
```
You: Find music events in San Francisco for my restaurant brand in the next 30 days
```

The agent should:
1. Call `search_events`
2. Call `recommend_campaign_window`
3. Return scored recommendations with rationale

Type `exit` to quit.

## Running the Full Stack

You'll need **3 terminal windows**:

### Terminal 1: Agent Backend (includes MCP server)

```bash
cd agent-backend
npm run dev
```

You should see:
```
Agent initialized successfully
🚀 Agent backend running on http://localhost:3001
```

The agent backend automatically spawns the MCP server as a child process.

### Terminal 2: Frontend

```bash
cd frontend
npm run dev
```

You should see:
```
VITE ready in XXXms
➜  Local:   http://localhost:5173/
```

### Terminal 3: Open Browser

Navigate to `http://localhost:5173/`

## Using the Application

1. **Ask about events** — e.g., "Find sports events in Chicago for my automotive brand this July"
2. **Agent searches** — Calls `search_events` with your parameters
3. **Agent scores** — Calls `recommend_campaign_window` to rank events by relevance
4. **Get recommendations** — See top 3 events with scores and explainable rationale

Example rationale:
> "Sports aligns with automotive; weekend timing captures leisure audience; premium ticket pricing indicates engaged audience"

## How the Scoring Works (Deterministic, Not LLM)

The `recommend_campaign_window` tool uses **rule-based scoring**, not an LLM. This makes it:
- **Explainable**: Each score component is visible
- **Inspectable**: You can audit the logic in `recommendCampaignWindow.ts`
- **Fast**: No API call overhead

### Scoring Factors:

1. **Classification match** (0-50 points)
   Lookup table maps brand categories to event types
   - Example: `restaurant` → `Music`, `Sports`, `Arts & Theatre`, `Family`

2. **Day of week** (0-30 points)
   Weekend events (Fri/Sat/Sun) get boosted

3. **Time of day** (0-20 points)
   Evening events (6pm-11pm) get boosted, especially for dining/entertainment brands

4. **Price range** (0-10 points)
   Higher ticket prices suggest higher-value audience

**Total possible score**: 110 points

## Known Limitations

- **Ticketmaster coverage**: Not all venues use Ticketmaster (AXS, StubHub, free community events are excluded)
- **Venue capacity**: Sparsely populated in the API — treated as optional
- **Date range**: API limits vary by tier — keep searches under 90 days for best results
- **Rate limiting**: 5000 requests/day on free tier — caching (15 min default) helps

## Security Checklist

✅ Ticketmaster API key only in `mcp-server/.env` (never committed)
✅ Anthropic API key only in `agent-backend/.env` (never committed)
✅ Frontend has no direct access to either key
✅ `.env` files are in `.gitignore`
✅ `.env.example` files are committed (with empty values)

### Verify API Key is Not in Frontend Build

```bash
cd frontend
npm run build
grep -r "TICKETMASTER" dist/
```

Should return nothing. If it finds the key, there's a security issue.

## Extension Points

The architecture is designed for extensibility:

### 1. Add a New MCP Tool

Example: `get_event_weather_risk`

1. Create `mcp-server/src/tools/getEventWeatherRisk.ts`
2. Register it in `mcp-server/src/index.ts`
3. The agent automatically picks it up via `listTools()`

### 2. Add a New Data Source

Example: SeatGeek

1. Create `seatgeekClient.ts` in `mcp-server/src/`
2. Implement the same `searchEvents()` interface
3. Update the tool to merge results from both sources

### 3. Enhance Scoring Logic

Modify `recommendCampaignWindow.ts`:
- Add weather risk modifier (outdoor events + rain forecast)
- Add demand signals (resale price intensity)
- Add venue size (when available)

## Troubleshooting

### "Agent not initialized" error

Agent backend couldn't spawn the MCP server. Check:
- `MCP_SERVER_PATH` in `agent-backend/.env` is correct
- `tsx` is installed (`npm install` in agent-backend)
- MCP server has no syntax errors (run `npm run build` in mcp-server)

### "Ticketmaster API error (401)"

API key is missing or invalid:
- Check `mcp-server/.env` has `TICKETMASTER_API_KEY` set
- Verify key is active in [Ticketmaster developer console](https://developer-acct.ticketmaster.com/)

### Frontend can't connect to backend

- Ensure agent-backend is running on port 3001
- Check `VITE_API_URL` in `frontend/.env.local`
- Check CORS is enabled (it's on by default in the Express server)

### No events found

- Try a broader search (increase date range, remove classification filter)
- Check city name spelling — use the Ticketmaster-standard name (e.g., "Los Angeles" not "LA")
- Consider using DMA IDs instead of city names ([DMA list](https://developer.ticketmaster.com/products-and-docs/apis/discovery-api/v2/#srch-events-v2))

## Development Commands

### MCP Server

```bash
npm run dev      # Watch mode
npm run build    # Compile TypeScript
npm test         # Run test-search.ts
```

### Agent Backend

```bash
npm run dev      # Watch mode
npm run build    # Compile TypeScript
npm run test-cli # Interactive CLI test
npm start        # Production mode (requires build first)
```

### Frontend

```bash
npm run dev      # Development server
npm run build    # Production build
npm run preview  # Preview production build
```

## Tech Stack Summary

- **MCP Server**: Node.js, TypeScript, `@modelcontextprotocol/sdk`, `node-fetch`
- **Agent Backend**: Express, Anthropic SDK, `@modelcontextprotocol/sdk` (client)
- **Frontend**: React 19, TypeScript, Vite
- **Data Source**: Ticketmaster Discovery API v2

## License

MIT

## Acknowledgments

- Built for the **InMarket AI Builder Challenge**
- Uses [Anthropic's Claude](https://www.anthropic.com/) for conversational AI
- Event data from [Ticketmaster Discovery API](https://developer.ticketmaster.com/)
- MCP protocol from [Model Context Protocol](https://modelcontextprotocol.io/)
