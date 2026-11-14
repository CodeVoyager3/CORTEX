# CORTEX — Production Rebuild Plan

## Answer to Your Two Questions

### 1. Neo4j Free Tier → Drop it entirely for production

AuraDB Free limits: **200k nodes, 400k relationships**. A single medium-sized repo (React, Next.js, etc.) can easily produce 10k–50k nodes. You'll hit the ceiling after 4–20 repos. Paid AuraDB starts at ~$65/month.

**Verdict: Don't scale Neo4j. Replace it.**

The graph relationships you were storing in Neo4j (CALLS, IMPORTS, DEFINES) can be represented far more cheaply as **metadata columns in PostgreSQL**. You lose Cypher query expressiveness but gain zero cost, no external dependency, and SQL that any backend can query.

### 2. Rewrite in TypeScript? → **Yes, strongly recommended**

Reasons:
- ReviewPilot's architecture is the correct pattern for production — you'll be building something close to it
- TypeScript gives you type safety across your entire codebase, which matters when you have 3 services
- The entire Node.js/BullMQ/Prisma ecosystem is better suited to webhook-driven event architectures than Python/Celery
- You'll learn TS in the process (which is a genuinely valuable skill)
- Python's async story (FastAPI + Celery) requires two separate processes and more config — Node.js workers are simpler to deploy

> **Don't port your existing Python code to TS line-by-line.** Design the new architecture correctly from scratch, then implement it.

---

## The New Stack (No Neo4j)

| Layer | Old (Python) | New (TypeScript) |
|---|---|---|
| **API** | FastAPI | Express or Hono |
| **Queue** | Celery + Redis | BullMQ + Redis |
| **Vector DB** | MongoDB Atlas Vector | **Pinecone** (free tier: 1 index, 100k vectors) OR **pgvector** (free via Supabase/Neon) |
| **Graph / Relational** | Neo4j | **PostgreSQL** (relationships as FK tables) |
| **ORM** | None (raw pymongo/neo4j) | Prisma |
| **Embeddings** | BGE-m3 (self-hosted) | Pinecone `llama-text-embed-v2` (hosted) |
| **LLM** | Groq (Llama 3.3) | Groq OR Anthropic Claude |
| **AST Parser** | tree-sitter Python bindings | tree-sitter Node.js bindings (same parser!) |
| **Deploy** | localhost | Fly.io (free tier) or Railway |

---

## How to Replace Neo4j With PostgreSQL

This is the key design decision. Instead of a graph DB, store relationships as a simple join table:

```sql
-- Prisma schema equivalent

model Repository {
  id            String   @id @default(cuid())
  owner         String
  name          String
  lastIndexedSha String?
  chunks        CodeChunk[]
  @@unique([owner, name])
}

model CodeChunk {
  id           String   @id  -- "filePath::nodeType::symbolName::index"
  repositoryId String
  filePath     String
  symbolName   String
  nodeType     String        -- function | class | method | import | export
  startLine    Int
  endLine      Int
  content      String        -- enriched text (sent to embedding)
  embedding    Float[]       -- pgvector column (if using Supabase/Neon)
  imports      String[]      -- raw import strings from AST
  calledBy     String[]      -- symbol names that call this (from AST)
  repository   Repository    @relation(...)
  
  @@index([repositoryId, filePath])
  @@index([repositoryId, symbolName])
}
```

**How you get "blast radius" without Cypher:**
```sql
-- "What calls updateAuth()?"
SELECT * FROM CodeChunk 
WHERE repositoryId = $repoId 
AND $symbolName = ANY(calledBy);

-- "What does updateAuth() import?"  
SELECT imports FROM CodeChunk
WHERE repositoryId = $repoId AND symbolName = 'updateAuth';
```

You lose multi-hop graph traversal (A→B→C→D) but gain zero infra cost. For a production v1 this is the correct tradeoff.

---

## New Architecture Design

```
GitHub PR/Push
    │
    ▼
[Webhook Service] (Express, port 3002)
    │  Validates GitHub signature
    │  Pushes job to Redis queue
    ▼
[Redis Queue — BullMQ]
    ├── rag-queue      → RAG Worker
    └── review-queue   → Review Worker

[RAG Worker]
    ├── On first install: Full index
    │     ├── Download repo ZIP (GitHub API)
    │     ├── Extract + read supported files
    │     ├── AST parse → CodeChunk[]
    │     ├── Batch embed (96/call → Pinecone/pgvector)
    │     └── Save chunks + metadata to PostgreSQL
    │
    └── On push: Incremental update
          ├── Compare lastIndexedSha → headSha (GitHub API)
          ├── Delete stale vectors for changed files
          ├── Re-parse + re-embed only changed files
          └── Update lastIndexedSha in DB

[Review Worker]
    ├── Get PR diff (GitHub API)
    ├── Determine review type (bug-fix / feature / refactor)
    ├── If feature: RAG retrieval
    │     ├── Semantic vector search (top-K)
    │     ├── File-scoped search for changed files
    │     ├── Symbol-scoped search for changed symbols
    │     └── Score boost + dedupe
    ├── Build prompt (diff + RAG context + .reviewrc.json rules)
    ├── Call LLM (Groq/Claude)
    ├── Parse structured response
    ├── Save review + issues to PostgreSQL
    └── Post comment to GitHub PR

[API Service] (Express, port 3001)
    └── REST endpoints for dashboard (repos, reviews, issues)

[Client] (Next.js)
    └── Dashboard: repos, PR review history, issue tracking
```

---

## Free Tier Budget (Production Viable)

| Service | Free Tier | Limit |
|---|---|---|
| **Pinecone** | 1 serverless index | 100k vectors (~50 repos) |
| **Supabase** | 500MB PostgreSQL + pgvector | Sufficient for metadata |
| **Groq** | 14,400 req/day | More than enough |
| **Upstash Redis** | 10k req/day free | Sufficient for queue |
| **Fly.io** | 3 shared VMs free | Exactly what you need (3 services) |
| **Vercel** | Unlimited for Next.js | Free forever |
| **GitHub App** | Free | Free |

**Total cost: $0/month** for a real production deployment handling dozens of repos.

---

## Folder Structure (New CORTEX)

```
cortex/
├── server/
│   ├── app/
│   │   ├── api-service/          # REST API (Express)
│   │   │   ├── controllers/
│   │   │   ├── routes/
│   │   │   └── index.ts
│   │   ├── webhook-service/      # GitHub webhook receiver
│   │   │   ├── routes/
│   │   │   └── index.ts
│   │   └── worker-service/       # BullMQ workers
│   │       ├── workers/
│   │       │   ├── rag.worker.ts
│   │       │   └── review.worker.ts
│   │       ├── services/
│   │       │   ├── rag.service.ts        # Pinecone + incremental indexing
│   │       │   ├── review.service.ts     # PR review pipeline
│   │       │   └── blastRadius.service.ts # YOUR UNIQUE FEATURE (SQL-based)
│   │       └── index.ts
│   ├── package/                  # Shared code
│   │   ├── ast/
│   │   │   └── parser.ts         # tree-sitter (copy from ReviewPilot, it's good)
│   │   ├── ai/
│   │   │   └── review.ts         # LLM prompts
│   │   ├── github/
│   │   │   ├── client.ts         # Octokit
│   │   │   └── pr.ts             # diff fetching
│   │   └── db/
│   │       └── prisma.ts
│   ├── prisma/
│   │   └── schema.prisma
│   └── docker-compose.yaml
├── client/                       # Next.js dashboard
└── .reviewrc.json                # Default review rules
```

---

## Phase-by-Phase Build Order

### Phase 1 — Core Infrastructure (Week 1)
- [ ] Init monorepo with TypeScript
- [ ] Set up Prisma schema (User, Repository, CodeChunk, PRReview, Issue)
- [ ] Set up BullMQ + Redis (Upstash)
- [ ] Port AST parser from ReviewPilot (it's already perfect)
- [ ] Build RAG service (Pinecone full index + incremental)

### Phase 2 — GitHub Integration (Week 2)
- [ ] Create GitHub App
- [ ] Build webhook service (signature verification + queue dispatch)
- [ ] Build RAG worker (triggered on `push` and `pull_request`)
- [ ] Build Review worker (PR diff → LLM → comment)

### Phase 3 — Your Unique Feature: Blast Radius (Week 2-3)
- [ ] Add `calledBy` + `imports` columns to CodeChunk
- [ ] Populate from AST during indexing (no LLM needed)
- [ ] Build `blastRadius.service.ts` — SQL queries to trace dependency chains
- [ ] Add blast radius output to PR review comments

### Phase 4 — Dashboard (Week 3-4)
- [ ] Next.js frontend
- [ ] GitHub OAuth login
- [ ] Repo management page
- [ ] PR review history
- [ ] Issue tracker

---

## Key Files to Borrow From ReviewPilot

These are already well-written — no need to reinvent:

| File | Why it's good |
|---|---|
| [`package/ast/parser.ts`](file:///d:/My%20Projects/CORTEX/AI-Code-Reviewer/Server/package/ast/parser.ts) | Production-quality AST chunker with fallback, dedup, enriched headers |
| [`rag.service.ts`](file:///d:/My%20Projects/CORTEX/AI-Code-Reviewer/Server/app/worker-service/services/rag.service.ts) | Batch embedding, incremental indexing, Redis locking, 3-strategy retrieval |
| [`prisma/schema.prisma`](file:///d:/My%20Projects/CORTEX/AI-Code-Reviewer/Server/prisma/schema.prisma) | Good base schema — extend with `CodeChunk` table |
| [`docker-compose.yaml`](file:///d:/My%20Projects/CORTEX/AI-Code-Reviewer/Server/docker-compose.yaml) | 3-service Docker setup |

> [!IMPORTANT]
> Don't copy ReviewPilot's `review.service.ts` logic blindly — that's their IP and also targets PR reviews only. Your review prompt should add **blast radius analysis** as a unique output section.

---

## Your Differentiator vs ReviewPilot

ReviewPilot's PR comment looks like:
> "Line 42: This function has a memory leak"

CORTEX's PR comment should look like:
> "Line 42: `processPayment()` has a memory leak.
> **Blast Radius:** This function is called by `checkout.ts`, `retry.worker.ts`, and `webhook.handler.ts`. Changes here affect 3 files and 2 worker jobs."

**That's your moat.** Build it.
