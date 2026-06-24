# Event Marketing Intelligence Platform

> An agentic AI system for intelligent event discovery and campaign planning using Ticketmaster data

![Architecture](https://img.shields.io/badge/Architecture-3--Tier-blue)
![Framework](https://img.shields.io/badge/Framework-LangChain%20%7C%20Anthropic-green)
![MCP](https://img.shields.io/badge/Protocol-MCP-orange)
![Status](https://img.shields.io/badge/Status-Production%20Ready-success)

## 📋 Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Features](#features)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Framework Comparison](#framework-comparison)
- [Testing](#testing)
- [Monitoring](#monitoring)
- [Deployment](#deployment)
- [Project Structure](#project-structure)
- [API Documentation](#api-documentation)

## 🎯 Overview

This project demonstrates a production-ready agentic AI application that combines:

- **Public REST API**: Ticketmaster Discovery API v2
- **MCP Server Wrapper**: TypeScript-based microservice for API abstraction
- **LLM Agent Backend**: Dual implementation (LangChain + Anthropic SDK)
- **React Frontend**: Modern web interface for user interactions

**Built using Claude Code** (agentic IDE) - demonstrating AI-assisted development at its finest.

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                       Frontend (React)                      │
│                    http://localhost:5173                    │
└──────────────────────┬──────────────────────────────────────┘
                       │ REST API
┌──────────────────────▼──────────────────────────────────────┐
│               Agent Backend (Express)                       │
│              http://localhost:3001                          │
│  ┌────────────────────────────────────────────────────┐    │
│  │  Anthropic SDK         │        LangChain          │    │
│  │  POST /chat            │    POST /chat/langchain   │    │
│  └────────────────┬──────────────────┬─────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                       │ stdio
┌──────────────────────▼──────────────────────────────────────┐
│                  MCP Server (stdio)                         │
│  ┌────────────────────────────────────────────────────┐    │
│  │  Tools: search_events | get_event_details          │    │
│  │         recommend_campaign_window                   │    │
│  │         search_attractions | get_attraction_tour   │    │
│  └────────────────┬────────────────────────────────────┘    │
└───────────────────┼──────────────────────────────────────────┘
                    │ HTTP
┌───────────────────▼──────────────────────────────────────────┐
│              Ticketmaster Discovery API v2                  │
│          https://app.ticketmaster.com/discovery/v2          │
└─────────────────────────────────────────────────────────────┘
```

### Key Design Decisions

1. **MCP Protocol**: Uses Model Context Protocol for clean separation between API layer and agent layer
2. **Dual Framework Support**: Both LangChain and Anthropic SDK implementations to demonstrate framework versatility
3. **Type Safety**: Full TypeScript implementation with strict type checking
4. **Security First**: API keys in .env files, never exposed to frontend
5. **Observable**: Structured logging with Winston + optional LangSmith monitoring

## ✨ Features

### Core Capabilities

- ✅ **Smart Event Discovery**: Natural language search for events with advanced filtering
- ✅ **Campaign Recommendations**: Deterministic scoring algorithm (0-135 points) with explainable rationale
- ✅ **Geographic Targeting**: Radius-based search (hyper-local campaigns)
- ✅ **Artist Tour Tracking**: Follow performers across all tour dates
- ✅ **Genre Precision**: Ultra-precise audience targeting with genre/sub-genre filters
- ✅ **Venue Intelligence**: Capacity-based planning with 20,000+ venue database
- ✅ **Ticket Sales Timing**: On-sale date tracking for launch campaigns

### Advanced Scoring Factors

- Classification Match (50 points): Music, Sports, Arts & Theatre alignment
- Weekend Timing (30 points): Friday/Saturday/Sunday boost
- Evening Hours (20 points): Prime-time event timing
- Premium Pricing (10 points): High-value audience indicator
- Venue Capacity (15 points): Arena-scale reach potential
- Distance Proximity (10 points): Hyper-local relevance

**Maximum Score**: 135 points

## 📋 Prerequisites

- **Node.js**: v20+ (LTS recommended)
- **npm**: v9+ or yarn v1.22+
- **API Keys**:
  - [Ticketmaster API Key](https://developer.ticketmaster.com/) (Free tier available)
  - [Anthropic API Key](https://console.anthropic.com/) (Claude access)
  - [LangSmith API Key](https://smith.langchain.com/) (Optional, for monitoring)

## 🚀 Quick Start

### 1. Clone and Install

\`\`\`bash
git clone https://github.com/nikita-ravi/Event-Marketing-Intelligence.git
cd Event-Marketing-Intelligence

# Install all dependencies
cd mcp-server && npm install
cd ../agent-backend && npm install
cd ../frontend && npm install
\`\`\`

### 2. Configure Environment Variables

#### MCP Server (.env)
\`\`\`bash
cd mcp-server
cp .env.example .env
# Edit .env and add your Ticketmaster API key
\`\`\`

\`\`\`env
TICKETMASTER_API_KEY=your-ticketmaster-api-key-here
CACHE_DURATION_MS=900000
\`\`\`

#### Agent Backend (.env)
\`\`\`bash
cd agent-backend
cp .env.example .env
# Edit .env and add your Anthropic API key
\`\`\`

\`\`\`env
ANTHROPIC_API_KEY=your-anthropic-api-key-here
PORT=3001
MCP_SERVER_PATH=../mcp-server/src/index.ts

# Optional: Enable monitoring
LANGCHAIN_TRACING_V2=false
LANGCHAIN_API_KEY=your-langsmith-api-key-here
\`\`\`

### 3. Run the Application

**Option A: Run all services in separate terminals**

\`\`\`bash
# Terminal 1: Agent Backend (starts MCP server automatically)
cd agent-backend
npm run dev

# Terminal 2: Frontend
cd frontend
npm run dev
\`\`\`

**Option B: Using Docker Compose**

\`\`\`bash
# From project root
docker-compose up --build
\`\`\`

### 4. Access the Application

- **Frontend**: http://localhost:5173
- **Backend**: http://localhost:3001
- **Health Check**: http://localhost:3001/health

## 🔄 Framework Comparison

This project includes **two implementations** of the agent backend:

| Feature | Anthropic SDK | LangChain |
|---------|--------------|-----------|
| **Endpoint** | POST /chat | POST /chat/langchain |
| **Pros** | Direct API access, latest features, minimal overhead | Framework-agnostic, built-in memory, extensive ecosystem |
| **Use Case** | Production performance | Multi-model flexibility |
| **Tracing** | Custom logging | Automatic via LangSmith |
| **Code** | `src/agent.ts` | `src/langchainAgent.ts` |

Both provide **identical functionality** - choose based on your preference.

## 🧪 Testing

\`\`\`bash
# Run all tests
cd mcp-server
npm test

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage

# UI mode (interactive)
npm run test:ui
\`\`\`

**Test Coverage**:
- ✅ Event search response shaping
- ✅ Scoring algorithm (all 135 points)
- ✅ Caching behavior
- ✅ Data validation
- ✅ Edge cases

## 📊 Monitoring

### Local Monitoring with LangSmith

1. Sign up at [smith.langchain.com](https://smith.langchain.com) (free tier)
2. Get your API key from settings
3. Enable in \`.env\`:

\`\`\`env
LANGCHAIN_TRACING_V2=true
LANGCHAIN_API_KEY=your-key-here
LANGCHAIN_PROJECT=event-marketing-agent
\`\`\`

4. Run the app - traces appear automatically at https://smith.langchain.com

**Features**:
- 📈 Real-time trace visualization
- 🔍 Tool call debugging
- ⏱️ Performance metrics
- 🎯 Agent reasoning inspection

### Alternative Monitoring Options

- **LangFuse**: Open-source, self-hosted option
- **Phoenix Arize**: Completely local, no cloud service
- **Winston Logs**: Check \`agent-backend/logs/combined.log\`

## 🚢 Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for comprehensive deployment guide including:

- Docker containerization
- Kubernetes orchestration
- Serverless deployment (AWS Lambda)
- Environment configuration
- Scaling strategies
- Security hardening

### Quick Docker Deployment

\`\`\`bash
# Build all images
docker-compose build

# Run in production mode
docker-compose up -d

# View logs
docker-compose logs -f agent-backend

# Stop all services
docker-compose down
\`\`\`

## 📁 Project Structure

\`\`\`
Event-Marketing-Intelligence/
├── mcp-server/                 # MCP Server (Ticketmaster API wrapper)
│   ├── src/
│   │   ├── index.ts           # MCP server entry point
│   │   ├── ticketmasterClient.ts # API client
│   │   ├── types.ts           # TypeScript interfaces
│   │   ├── tools/             # MCP tool implementations
│   │   │   ├── searchEvents.ts
│   │   │   ├── getEventDetails.ts
│   │   │   ├── recommendCampaignWindow.ts
│   │   │   ├── searchAttractions.ts
│   │   │   └── getAttractionTour.ts
│   │   └── __tests__/         # Test suite
│   ├── Dockerfile
│   ├── package.json
│   └── vitest.config.ts
│
├── agent-backend/             # LLM Agent Backend
│   ├── src/
│   │   ├── index.ts          # Express server
│   │   ├── agent.ts          # Anthropic SDK agent
│   │   ├── langchainAgent.ts # LangChain agent
│   │   ├── mcpClient.ts      # MCP client
│   │   ├── logger.ts         # Winston logging config
│   │   ├── monitoring.ts     # LangSmith integration
│   │   └── systemPrompt.ts   # Agent instructions
│   ├── logs/                 # Winston log files
│   ├── Dockerfile
│   └── package.json
│
├── frontend/                  # React Frontend
│   ├── src/
│   │   ├── App.tsx
│   │   ├── components/
│   │   │   ├── ChatWindow.tsx
│   │   │   ├── EventCard.tsx
│   │   │   └── ConfirmModal.tsx
│   │   └── main.tsx
│   ├── Dockerfile
│   ├── nginx.conf
│   └── package.json
│
├── docker-compose.yml         # Orchestration
├── DEPLOYMENT.md             # Deployment guide
└── README.md                 # This file
\`\`\`

## 📡 API Documentation

### Agent Backend Endpoints

#### POST /chat
**Description**: Send message to Anthropic SDK agent

\`\`\`bash
curl -X POST http://localhost:3001/chat \\
  -H "Content-Type: application/json" \\
  -d '{"message": "Find music events in Chicago for my restaurant"}'
\`\`\`

**Response**:
\`\`\`json
{
  "response": "Here are the top 3 events...",
  "history": [...]
}
\`\`\`

#### POST /chat/langchain
**Description**: Send message to LangChain agent

\`\`\`bash
curl -X POST http://localhost:3001/chat/langchain \\
  -H "Content-Type: application/json" \\
  -d '{"message": "Find music events in Chicago for my restaurant"}'
\`\`\`

#### POST /reset
**Description**: Reset conversation history

\`\`\`bash
curl -X POST http://localhost:3001/reset
\`\`\`

#### GET /health
**Description**: Health check

\`\`\`bash
curl http://localhost:3001/health
\`\`\`

**Response**:
\`\`\`json
{
  "status": "ok",
  "agents": {
    "anthropic": "initialized",
    "langchain": "initialized"
  }
}
\`\`\`

### MCP Tools

The MCP server exposes 5 tools via stdio:

1. **search_events**: Search for events with filtering
2. **get_event_details**: Get detailed event information
3. **recommend_campaign_window**: Score events for campaigns
4. **search_attractions**: Find artists/teams by keyword
5. **get_attraction_tour**: Get all tour dates for an attraction

## 🤝 Contributing

This project was built as a technical assessment. For production use:

1. Add rate limiting
2. Implement input validation
3. Add authentication/authorization
4. Configure CORS properly
5. Add comprehensive error handling
6. Implement request ID tracking
7. Add metrics collection

## 📄 License

MIT

## 🙏 Acknowledgments

- Built with [Claude Code](https://www.anthropic.com/claude-code) - AI-powered development
- Powered by [Anthropic Claude Sonnet 4.5](https://www.anthropic.com/claude)
- Data from [Ticketmaster Discovery API](https://developer.ticketmaster.com/)
- Monitoring by [LangSmith](https://smith.langchain.com/)
- Framework by [LangChain](https://www.langchain.com/)

---

**Built by**: [Nikita Ravi](https://github.com/nikita-ravi)
**Repository**: [Event-Marketing-Intelligence](https://github.com/nikita-ravi/Event-Marketing-Intelligence)
**Status**: Production Ready ✨
