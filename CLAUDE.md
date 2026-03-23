# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

NexusRecover is an IRROPS (Irregular Operations) decision support system for airline disruption recovery. It uses constraint programming (OR-Tools CP-SAT) to optimize passenger connections and recovery costs during airport disruptions (e.g., snowstorms). Built for the CubePath 2026 Hackathon.

## Commands

### Docker (primary workflow)
```bash
cp .env.example .env              # First-time setup, then edit with GOOGLE_API_KEY
docker compose up --build          # Build and run both services
```
- Frontend: http://localhost (Nginx reverse proxy)
- Backend API: http://localhost:8000
- Health check: http://localhost:8000/health

### Frontend (local dev)
```bash
cd frontend
npm install
npm run dev        # Vite dev server with HMR, proxies /api → localhost:8000
npm run build      # Production build → dist/
npm run lint       # ESLint
npm run preview    # Preview production build
```

### Backend (local dev)
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

## Architecture

### Data Flow
```
React SPA → FastAPI (/api/* via Nginx or Vite proxy) → OR-Tools CP-SAT solver
                                                     → Google Gemini API (copilot chat)
                                                     → N8N webhooks (notifications)
```

### Backend (`backend/`)
- **`main.py`** — FastAPI app with all endpoints: `/scenario`, `/optimize`, `/baseline`, `/chat`, `/notify-authorities`, `/notify-hospitality`, `/health`
- **`schemas.py`** — Pydantic v2 models for the entire domain (airports, flights, PAX groups, optimizer results, chat)
- **`solver/optimizer.py`** — OR-Tools CP-SAT constraint solver. Two functions: `compute_baseline()` (no intervention) and `optimize()` (cost-minimized plan). Key constants: `SCALE=100`, `MAX_DELAY=180min`, `SOLVER_TIMEOUT_S=5`, `WINDOW_MIN=30`
- **`data/mock_scenario.json`** — Demo YYZ snowstorm scenario (11 inbound, 5+ outbound, 300+ PAX)

### Frontend (`frontend/`)
- **React 19 + Vite 8 + Tailwind CSS 4**
- **`src/App.jsx`** — Main component, orchestrates the 4-step timeline (Normal → Storm → Chaos → Recovery Plan)
- **`src/store/useStore.js`** — Zustand store: scenario data, optimizer results, UI state, chat, notification status
- **`src/lib/notify.js`** — Builds structured JSON payloads for authorities and hospitality webhook notifications
- Key visualizations: `GeoMap.jsx` (deck.gl 3D flight arcs), `SankeyDiagram.jsx` (D3 passenger flows), `WaterfallChart.jsx` (cost breakdown), `ReportPage.jsx` (PDF-ready report)

### Vite Proxy
In dev mode, Vite proxies `/api/*` to `http://localhost:8000` with path rewrite (strips `/api` prefix). In production, Nginx handles this via `nginx.conf`.

### N8N Workflows (`n8n/`)
- **Authorities**: Webhook → Format text → Write file to `/tmp/`
- **Hospitality**: Webhook → Format text → Write file + Send email (Gmail SMTP)

## Environment Variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `GOOGLE_API_KEY` | Yes | Gemini API for copilot chat |
| `GEMINI_MODEL` | No | Default: `gemini-2.0-flash` |
| `WEBHOOK_AUTHORITIES` | No | N8N webhook URL for authorities |
| `WEBHOOK_HOSPITALITY` | No | N8N webhook URL for hospitality |
| `VITE_WEBHOOK_*` | No | Frontend-side webhook URLs (baked at build time) |

## Tech Stack

- **Frontend**: React 19, Vite 8, Tailwind CSS 4, Zustand, deck.gl, D3/d3-sankey, MapLibre GL, react-markdown
- **Backend**: FastAPI, Python 3.12, OR-Tools CP-SAT, Pydantic v2, httpx
- **Infra**: Docker Compose, Nginx 1.27, Dokploy (production)
