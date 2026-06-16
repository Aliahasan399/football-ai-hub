# Football AI Match Predictor & Live Insights Hub — Architecture Blueprint

## 📁 Project Structure

```
football-ai-hub/
│
├── prisma/                          # PostgreSQL schema (Prisma ORM)
│   └── schema.prisma                #   → Users, Fixtures, Predictions,
│                                    #      Leaderboard, Value Discrepancies (§4.1)
│
├── ai-engine/                       # Python FastAPI microservice (Render)
│   ├── main.py                      #   → Training, inference, SHAP explainability
│   └── requirements.txt
│
├── middleware-server/               # Node.js middleware (Render)
│   ├── server.js                    #   → Express + Socket.io + Mock Redis cache
│   └── package.json
│
└── README.md
```

## 🏗️ Microservice Architecture

```
┌──────────────┐     ┌──────────────────┐     ┌──────────────────┐
│   Frontend   │────▶│   Middleware     │────▶│   AI Engine      │
│  (Next.js)   │     │  Node + Socket   │     │  FastAPI + XGBoost│
│  Vercel Free │◀────│  Render Free     │◀────│  Render Free     │
│              │  WS │                  │  WS │                  │
└──────────────┘     └───────┬──────────┘     └──────────────────┘
                             │
                     ┌───────▼──────────┐     ┌──────────────────┐
                     │  Upstash Redis   │     │  PostgreSQL      │
                     │  Cache (Free)    │     │  Neon/Supabase   │
                     │  §5.1: 15min TTL │     │  Free Tier       │
                     └──────────────────┘     └──────────────────┘
```

## 📄 File Summary

### 1. `prisma/schema.prisma`
- **User** model with gamification stats (XP, level, streaks, accuracy)
- **Fixture** model with live match state fields (ball coordinates for 2D pitch, §3.1)
- **Prediction** model — one prediction per user per fixture
- **LeaderboardEntry** — computed ranking with rank-change tracking
- **ValueDiscrepancy** model (§4.1) — stores `ΔP = P_AI − P_Bookmaker`, threshold-flagged
- **Badge / Achievement** gamification models
- **FixtureLog** — time-series audit trail for WebSocket commentary
- **FixtureNote** — user annotation support

### 2. `ai-engine/main.py`
- **Auto-trains** on startup with 5K synthetic samples (XGBoost → Scikit-Learn fallback)
- `POST /api/train` — trigger retraining with custom sample count
- `GET /api/predictions/{fixture_id}` — returns:
  - `probabilities`: {homeWin, draw, awayWin}
  - `predictedOutcome` + `confidence`
  - `featureImportance`: SHAP (or fallback native importances) per feature
  - `valueDiscrepancies`: §4.1 delta calculations with neon-flag labels
- `GET /health` — model status endpoint
- Model persistence via pickle to disk

### 3. `middleware-server/server.js`
- **Mock Upstash Redis cache** — full get/set/ttl/eviction interface
- **Cache-first routing** (§5.1): every request hits cache first, only calls live API if miss
- **API cooldown gate** — prevents exceeding 100 req/day limit
- **Socket.io** real-time commentary engine:
  - `fixture:subscribe` — client joins room, auto-starts 8-15s commentary broadcast
  - `fixture:unsubscribe` — cleans up when room empties
  - `match:update` — live commentary text + event type
  - `match:fulltime` — end-of-match signal
- **Simulated sports API** — generates realistic fixture data
- Cache stat / flush admin endpoints

## 📐 Key Design Decisions

| Requirement | Implementation |
|-------------|---------------|
| **§4.1 ΔP > Threshold → +X% Value** | Stored in `ValueDiscrepancy` model + computed on-the-fly in `/api/predictions/{id}` |
| **§5.1 15-min cache TTL** | `CACHE_TTL_MS = 15 * 60 * 1000` in MockRedisCache |
| **§5.1 100 req/day limit** | `API_COOLDOWN_MS` gate + cooldown 503 response |
| **§3.1 Real-time commentary** | `LiveCommentaryEngine` — 8-15s interval broadcasts |
| **§3.1 2D pitch tracker** | Coordinates `ballPositionX/Y` in Fixture model (0-100) |
| **§4 Interpretability** | SHAP → `featureImportance` per prediction response |
| **Free-tier Render sleep** | Cache-first + `source: "cooldown"` signal for frontend loading placeholders |
