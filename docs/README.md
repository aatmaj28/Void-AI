<div align="center">

<img src="../assets/voidai.png" alt="Void AI" width="400"/>

# VOID AI

### We find alpha in the void

*Where Wall Street Isn't Looking*

<br/>

[![Python](https://img.shields.io/badge/Python-3.11+-black?style=flat-square&logo=python&logoColor=white)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-black?style=flat-square&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-18-black?style=flat-square&logo=react&logoColor=white)](https://react.dev)
[![Claude](https://img.shields.io/badge/Claude-AI-black?style=flat-square&logo=anthropic&logoColor=white)](https://anthropic.com)

[Features](#features) • [Quick Start](#quick-start) • [How It Works](#how-it-works) • [Tech Stack](#tech-stack)

<br/>

---

</div>

## The Void

Thousands of stocks trade daily, yet Wall Street analysts only cover a fraction.

**Apple** has 45+ analysts. Meanwhile, equally compelling mid-cap companies trade in silence — **zero coverage**.

> The void is where alpha hides.

**Void AI** finds these overlooked opportunities by detecting stocks with **high market activity** but **low analyst attention**.

<br/>

## Features

◯ **Coverage Gap Detection** — Scans 5,000+ stocks for under-coverage  
◯ **AI-Powered Analysis** — Multi-agent system generates investment hypotheses  
◯ **RAG Research Assistant** — Query SEC filings in natural language  
◯ **Real-time Alerts** — Get notified when new opportunities emerge  
◯ **Smart Screening** — Filter by sector, market cap, gap score  

<br/>

## Quick Start

```bash
# Clone the void
git clone https://github.com/yourusername/void-ai.git
cd void-ai

# Configure
cp .env.example .env
# Add your API keys (FMP, Finnhub, Anthropic)

# Launch
docker-compose up -d

# Open
open http://localhost:3000
```

<br/>

## How It Works

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   INGEST     │ ──▶ │    SCORE     │ ──▶ │   ANALYZE    │ ──▶ │   SURFACE    │
│              │     │              │     │              │     │              │
│ • FMP        │     │ • Coverage   │     │ • AI Agents  │     │ • Dashboard  │
│ • SEC EDGAR  │     │ • Activity   │     │ • RAG        │     │ • Alerts     │
│ • Finnhub    │     │ • Gap Score  │     │ • Hypotheses │     │ • API        │
└──────────────┘     └──────────────┘     └──────────────┘     └──────────────┘
```

<br/>

## Tech Stack

| Layer | Technologies |
|-------|--------------|
| **Backend** | FastAPI • PostgreSQL • pgvector • Redis • Celery |
| **AI/ML** | Claude (Anthropic) • LangGraph • sentence-transformers |
| **Frontend** | React • TypeScript • Tailwind • Recharts |
| **Data** | Financial Modeling Prep • SEC EDGAR • Finnhub • yfinance |

<br/>

---

## Documentation index

| Doc | Description |
|-----|-------------|
| [README.md](README.md) | This file — project overview |
| [QUICK_START.md](QUICK_START.md) | Create companies table in Supabase |
| [Table Relationships & Schema](docs/TABLE_RELATIONSHIPS.md) | Database table relationships and schema |
| [Supabase Pagination Fix](docs/SUPABASE_PAGINATION_FIX.md) | Fix for Supabase pagination issues |
| [Ticker Universes](docs/TICKER_UNIVERSES.md) | Managing different ticker universes |
| [POPULATE_GUIDE.md](POPULATE_GUIDE.md) | S&P 500 data population (Colab / local / CSV) |
| [STEP2_MARKET_DATA.md](STEP2_MARKET_DATA.md) | Market data & stock metrics tables and import |
| [STEP3_ANALYST_COVERAGE.md](STEP3_ANALYST_COVERAGE.md) | Analyst coverage table and import |
| [STEP4_SCORING_ENGINE.md](STEP4_SCORING_ENGINE.md) | Scoring engine and coverage_gap_scores |
| [PIPELINE_AUTOMATION.md](PIPELINE_AUTOMATION.md) | Daily pipeline (GitHub Actions / cron / cloud) |
| [YFINANCE_USAGE.md](YFINANCE_USAGE.md) | yfinance correct usage and common mistake |

<br/>

---

<div align="center">

**◯ VOID.AI**

*Finding opportunities where others aren't looking*

<br/>

[Report Bug](https://github.com/yourusername/void-ai/issues) • [Request Feature](https://github.com/yourusername/void-ai/issues)

<br/>

---

### 👨‍💻 Developers

**Aatmaj Amol Salunke** — [salunke.aa@northeastern.edu](mailto:salunke.aa@northeastern.edu)

**Vijwal Mahendrakar** — [mahendrakar.v@northeastern.edu](mailto:mahendrakar.v@northeastern.edu)

<br/>

<sub>
Built for <b>CS5130 — Applied Programming and Data Processing for AI</b><br/>
Northeastern University, Boston • Spring 2026
</sub>

</div>
