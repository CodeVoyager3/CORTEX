# 🧠 CORTEX

> **AST-Aware Code Intelligence, Hybrid RAG & Automated PR Review Engine with Blast Radius Analysis**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-16-black.svg)](https://nextjs.org/)
[![Express](https://img.shields.io/badge/Express-5.2-lightgrey.svg)](https://expressjs.com/)
[![Prisma](https://img.shields.io/badge/Prisma-7.9-teal.svg)](https://www.prisma.io/)
[![Pinecone](https://img.shields.io/badge/Pinecone-Vector_DB-green.svg)](https://www.pinecone.io/)
[![BullMQ](https://img.shields.io/badge/BullMQ-Redis_Queue-red.svg)](https://bullmq.io/)
[![Tree-sitter](https://img.shields.io/badge/Tree--sitter-AST_Parser-orange.svg)](https://tree-sitter.github.io/tree-sitter/)
[![Groq](https://img.shields.io/badge/Groq-Llama_/_GPT--OSS-purple.svg)](https://groq.com/)

---

## 📌 Overview

**CORTEX** is an engineering intelligence platform designed to eliminate "blast radius anxiety" in complex codebases. Traditional code search and naive RAG implementations treat code as flat text, discarding structural hierarchy, call relationships, and scope. When a developer asks *"What happens if I update this authentication function?"*, standard tools hallucinate or fail to identify downstream breakage.

CORTEX combines **deterministic Multi-Language Abstract Syntax Tree (AST) parsing** with **Pinecone Vector Search**, **PostgreSQL relational graph modeling**, and **Groq LLM reasoning** to understand code like a principal engineer.

Whenever a pull request or push occurs, CORTEX maps the codebase into structured semantic chunks, traces direct and transitive dependency chains, evaluates code changes for security/logic defects, and automatically publishes actionable PR reviews featuring **downstream blast radius analysis**.

---

## ⚡ Key Features

- **🌲 Deterministic Multi-Language AST Parsing**  
  Uses native Tree-sitter parsers (JavaScript, TypeScript, Python, C++) to extract functions, classes, methods, imports, and symbol invocations without relying on slow or non-deterministic LLM-based graph extraction.
- **💥 Downstream Blast Radius Engine**  
  Calculates exact 1st-order and 2nd-order downstream impact for modified files and symbols:
  - **Direct Imports:** Discovers files importing modified paths (with directory and relative path resolution).
  - **Direct Calls:** Discovers caller functions/methods referencing modified symbols.
  - **Transitive Dependents:** Traces second-order dependent consumers across the repository.
- **🔍 Hybrid Vector RAG (Pinecone + PostgreSQL)**  
  Embeds enriched code chunks using Pinecone Inference (`llama-text-embed-v2`, 1024-dimension cosine similarity) with per-repository namespace isolation (`repo-<repoId>`). Stores structural graph metadata, call edges, and line spans in PostgreSQL via Prisma.
- **🤖 Automated AI Code Review with Severity Scoring**  
  Powered by Groq LLMs (`openai/gpt-oss-120b` / Llama models). Automatically analyzes incoming PR diffs against grounded repository context and assigns severity scores (`critical`, `high`, `medium`, `low`).
- **💬 Interactive Engineering Dashboard & Copilot**  
  A modern Next.js 16 dashboard featuring:
  - **System Overview & Health:** Real-time metrics for indexed repos, chunks, relationships, detected issues, and BullMQ worker queues.
  - **Copilot Chat:** Grounded technical Q&A with exact file citations and automatic symbol dependency detection.
  - **Dependency Explorer:** Interactive symbol lookup to trace definitions, incoming calls, and import dependencies across repositories.
  - **Repository Management:** Trigger full repository indexing, inspect chunk metadata, monitor real-time job progress, or delete indexed datasets.
- **🔄 Event-Driven Background Workers**  
  Asynchronous task architecture built on **BullMQ + Redis** (`rag-queue` and `review-queue`) for non-blocking repository indexing and webhook-triggered pull request reviews.
- **🐙 GitHub App & Webhook Integration**  
  Supports GitHub App authentication (installation tokens) and fallback to Personal Access Tokens (PAT). Verifies HMAC SHA-256 webhook signatures (`x-hub-signature-256`) for `push` (incremental re-indexing) and `pull_request` (automated review generation).

---

## 🏗️ System Architecture

![CORTEX Architecture](image.png)

```mermaid
flowchart TD
    subgraph GitHub ["GitHub Platform"]
        PR["Pull Request / Push Event"]
        G_APP["GitHub App / Octokit"]
    end

    subgraph Server ["CORTEX Backend (TypeScript / Node.js)"]
        subgraph WebhookSvc ["Webhook Service (:3002)"]
            SIG["HMAC SHA-256 Signature Verification"]
            NORM["Payload Normalizer"]
        end

        subgraph Queues ["BullMQ + Redis"]
            RAG_Q[("rag-queue")]
            REV_Q[("review-queue")]
        end

        subgraph WorkerSvc ["Worker Service"]
            RAG_W["RAG Worker"]
            REV_W["Review Worker"]
            
            subgraph CoreEngines ["Core Engines"]
                AST["Tree-sitter AST Parser\n(JS/TS/Python/C++)"]
                BLAST["Blast Radius Service\n(Direct Imports, Calls, Transitive)"]
                RAG_CORE["RAG Service\n(Incremental & Full)"]
                AI_REV["Groq AI Review Engine"]
            end
        end

        subgraph ApiSvc ["REST API Service (:3001)"]
            ENDPOINTS["/api/health\n/api/stats\n/api/repos\n/api/reviews\n/api/chat\n/api/dependencies\n/api/jobs"]
        end
    end

    subgraph Storage ["Datastores"]
        PG[("PostgreSQL (Prisma ORM)\nRepositories, Chunks, Reviews, Issues")]
        PC[("Pinecone Serverless\n1024-dim llama-text-embed-v2")]
        REDIS[("Redis\nBullMQ Queues & Job States")]
    end

    subgraph Client ["Frontend Dashboard (:3000)"]
        DASH["Next.js 16 + React 19 + Tailwind v4"]
        VIEWS["Overview • Copilot Chat • Dependency Explorer • Repositories"]
    end

    PR -->|Webhook Payload| SIG
    SIG --> NORM
    NORM -->|push| RAG_Q
    NORM -->|pull_request| REV_Q

    RAG_Q --> RAG_W
    REV_Q --> REV_W

    RAG_W --> G_APP
    RAG_W --> AST
    AST --> PG
    AST -->|Embeddings| PC

    REV_W --> G_APP
    REV_W --> BLAST
    REV_W --> RAG_CORE
    RAG_CORE --> PC
    BLAST --> PG
    REV_W --> AI_REV
    AI_REV -->|Post PR Review Comment| G_APP

    Client -->|REST API Calls| ENDPOINTS
    ENDPOINTS --> PG
    ENDPOINTS --> PC
    ENDPOINTS --> Queues
```

---

## 🔄 Ingestion & Review Workflow

### 1. Ingestion Pipeline (`rag-queue`)
1. **Repository Fetch:** Pulls repository archive or commit diff via GitHub App API.
2. **AST Parsing:** Tree-sitter scans source files (`.ts`, `.tsx`, `.js`, `.jsx`, `.py`, `.cpp`), identifying logical symbols (functions, classes, methods), exact line spans, declared imports, and outgoing call invocations.
3. **Pinecone Vector Embedding:** Chunks are formatted with enriched semantic metadata (`File`, `Symbol`, `Type`, `Lines`, `Imports`, `Content`) and embedded using Pinecone's hosted `llama-text-embed-v2` model in batches of 96.
4. **Relational Indexing:** Structured code chunks, imports array, and `calledBy` invocation lists are persisted to PostgreSQL via Prisma.
5. **Incremental Updates:** On subsequent `push` events, CORTEX queries the diff between the previous indexed SHA and head SHA, deletes stale vectors in Pinecone, and re-embeds only the modified files.

### 2. PR Review & Blast Radius Pipeline (`review-queue`)
1. **Diff Parsing:** Extracts modified files and changed symbol names from the pull request diff.
2. **Blast Radius Computation:**
   - Evaluates direct import specifiers matching changed files.
   - Evaluates call edges where chunks invoke modified symbols.
   - Expands to 2nd-order transitive dependents calling the directly affected symbols.
3. **Targeted RAG Retrieval:** Fetches top semantic chunks from Pinecone matching the PR intent and modified context.
4. **LLM Review Synthesis:** Supplies the PR diff, downstream blast radius summary, and repository context to Groq LLM. Returns structured JSON containing identified defects and severities.
5. **GitHub Commenting:** Posts a formatted markdown comment directly onto the PR with detected issues and the complete blast radius breakdown:

```markdown
## CORTEX Review

### Issues
- **[high]** `src/auth/jwt.ts:42` — Token expiration is not validated before signature verification.
- **[medium]** `src/services/userService.ts:89` — Unhandled rejection when cache lookup fails.

### Blast Radius
Changes may affect **5** symbol(s) across **3** file(s):
- `src/controllers/authController.ts` :: `login` (direct_call)
- `src/middleware/authMiddleware.ts` :: `requireAuth` (direct_import)
- `src/routes/api.ts` :: `setupApiRoutes` (transitive)

---
_Generated by CORTEX_
```

---

## 💻 Tech Stack

| Layer | Technology | Details |
|---|---|---|
| **Frontend** | [Next.js 16](https://nextjs.org/) (App Router), React 19, Tailwind CSS v4 | Motion animations, Lucide icons, Radix UI, Clerk Auth |
| **Backend Services** | [Node.js](https://nodejs.org/) & [Express 5](https://expressjs.com/) (TypeScript) | Modular services: `api-service`, `webhook-service`, `worker-service` |
| **Worker Queue** | [BullMQ](https://bullmq.io/) + [Redis 7](https://redis.io/) | Resilient background processing (`rag-queue`, `review-queue`) |
| **Relational Database** | [PostgreSQL 16](https://www.postgresql.org/) + [Prisma 7](https://www.prisma.io/) | Schema migrations, metadata, relations, `@prisma/adapter-pg` |
| **Vector Database** | [Pinecone Serverless](https://www.pinecone.io/) | Model `llama-text-embed-v2` (1024-dim cosine), namespace isolation |
| **AST Parser** | [Tree-sitter](https://tree-sitter.github.io/tree-sitter/) | Native bindings: TypeScript, JavaScript, Python, C++ |
| **AI / LLM** | [Groq SDK](https://groq.com/) | `openai/gpt-oss-120b` / Llama models (JSON response mode) |
| **Git Integration** | [@octokit/rest](https://github.com/octokit/rest.js), [@octokit/auth-app](https://github.com/octokit/auth-app.js) | GitHub App installation authentication + Webhooks |
| **Containerization** | Docker & Docker Compose | Local PostgreSQL and Redis containers |

---

## 📁 Repository Structure

```
CORTEX/
├── client/                               # Next.js Frontend Dashboard
│   ├── app/                              # Next.js App Router
│   │   ├── dashboard/                    # Main dashboard & view routing
│   │   │   └── hooks/useIngestion.ts    # Polling hook for background jobs
│   │   ├── login/                        # Authentication views
│   │   ├── layout.tsx                    # Root layout with Clerk provider
│   │   └── page.tsx                      # Landing / redirect page
│   ├── components/dashboard/             # Dashboard UI components
│   │   ├── activity-feed.tsx             # Real-time event log
│   │   ├── copilot-panel.tsx             # Codebase Q&A chat with citations
│   │   ├── dependency-panel.tsx          # Dependency tree & symbol lookup
│   │   ├── overview-panel.tsx            # Stats cards & worker queue health
│   │   ├── repo-panel.tsx                # Repository indexer & management
│   │   └── sidebar.tsx                   # Navigation sidebar
│   ├── lib/
│   │   └── api.ts                        # Strongly typed client for API service
│   ├── package.json
│   └── tsconfig.json
│
├── server/                               # Node.js / TypeScript Backend
│   ├── app/
│   │   ├── api-service/                  # REST API Service (Port 3001)
│   │   │   ├── controllers/              # chat, dependencies, health, jobs, repos, reviews, stats
│   │   │   ├── routes/index.ts           # Central API router
│   │   │   └── index.ts                  # API service entrypoint
│   │   ├── webhook-service/              # GitHub Webhook Receiver (Port 3002)
│   │   │   ├── middleware/               # HMAC SHA-256 signature verification
│   │   │   ├── routes/webhook.ts         # Handles push, pull_request, installation
│   │   │   └── index.ts                  # Webhook service entrypoint
│   │   └── worker-service/               # BullMQ Background Worker Service
│   │       ├── services/
│   │       │   ├── blastRadius.service.ts# 1st/2nd order dependency analysis
│   │       │   ├── rag.service.ts        # Pinecone vector indexing & retrieval
│   │       │   └── review.service.ts     # PR diff analysis & review generation
│   │       ├── workers/
│   │       │   ├── rag.worker.ts         # Ingests & indexes repositories
│   │       │   └── review.worker.ts      # Executes PR reviews & posts comments
│   │       └── index.ts                  # Worker service entrypoint
│   ├── package/                          # Shared Internal Packages
│   │   ├── ai/                           # Groq LLM prompts & execution (chat, review)
│   │   ├── ast/                          # Tree-sitter parser & import resolver
│   │   ├── config/env.ts                 # Validated environment configuration
│   │   ├── db/prisma.ts                  # Prisma Client singleton
│   │   ├── github/                       # Octokit client & GitHub App auth
│   │   └── queue/index.ts                # BullMQ queue definitions
│   ├── prisma/
│   │   ├── schema.prisma                 # Database models (Installation, Repository, CodeChunk, etc.)
│   │   └── migrations/                   # SQL migration history
│   ├── docker-compose.yaml               # PostgreSQL & Redis infrastructure
│   ├── .env.example                      # Server environment template
│   └── package.json
│
└── README.md
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** v20+ and **npm**
- **Docker Desktop** (or running local instances of PostgreSQL 16 and Redis 7)
- **Pinecone Account:** An API key and a serverless index configured (Dimension: 1024, Metric: Cosine)
- **Groq API Key:** For code review and Copilot chat completion
- **GitHub App or Personal Access Token (PAT):** For repository access and pull request commenting

---

### 1. Clone & Setup Infrastructure

```bash
git clone https://github.com/your-username/CORTEX.git
cd CORTEX
```

Start PostgreSQL and Redis via Docker Compose:

```bash
cd server
docker compose up -d
```

---

### 2. Configure Environment Variables

#### Backend (`server/.env`)
Copy `server/.env.example` to `server/.env` and update the values:

```bash
cp .env.example .env
```

| Variable | Description | Example / Default |
|---|---|---|
| `NODE_ENV` | Environment mode | `development` |
| `API_PORT` | Port for the REST API | `3001` |
| `WEBHOOK_PORT` | Port for the GitHub Webhook Receiver | `3002` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://postgres:password123@localhost:5432/cortex_db` |
| `REDIS_URL` | Redis connection string for BullMQ | `redis://localhost:6379` |
| `PINECONE_API_KEY` | Your Pinecone API key | `pcsk_...` |
| `PINECONE_INDEX` | Pinecone index name (1024-dim, cosine) | `cortex-index` |
| `GROQ_API_KEY` | Your Groq API key | `gsk_...` |
| `GROQ_MODEL` | Model for reviews and chat | `openai/gpt-oss-120b` |
| `GITHUB_WEBHOOK_SECRET` | Secret configured on GitHub App/Webhook | `your-webhook-secret` |
| `GITHUB_APP_ID` | Numeric GitHub App ID (optional for PAT) | `123456` |
| `GITHUB_APP_PRIVATE_KEY` | Contents of `.pem` private key | `-----BEGIN RSA PRIVATE KEY-----\n...` |
| `GITHUB_APP_SLUG` | GitHub App slug for install link | `cortex-reviewer` |
| `GITHUB_TOKEN` | Fallback GitHub PAT (if not using App) | `ghp_...` |

#### Frontend (`client/.env.local`)
Create `client/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

NEXT_PUBLIC_CLERK_SIGN_IN_URL=/login
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/login
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard
```

---

### 3. Install Dependencies & Initialize Database

#### Setup Server:
```bash
cd server
npm install
npx prisma migrate dev
```

#### Setup Client:
```bash
cd ../client
npm install
```

---

### 4. Running the Application

You can run the backend services concurrently in separate terminals:

```bash
# Terminal 1: API Service (Port 3001)
cd server
npm run dev:api

# Terminal 2: Webhook Service (Port 3002)
cd server
npm run dev:webhook

# Terminal 3: Background Worker Service
cd server
npm run dev:worker

# Terminal 4: Next.js Frontend (Port 3000)
cd client
npm run dev
```

Visit **[http://localhost:3000](http://localhost:3000)** to access the CORTEX dashboard.

---

## 📡 API Reference

The API Service runs on port `3001` and exposes the following endpoints:

### System & Health
- `GET /api/health` — Returns status of PostgreSQL, Redis, Pinecone, Groq, GitHub, and BullMQ queue counts.
- `GET /api/stats` — Overall statistics (indexed repos, reviews, detected issues, file and chunk counts).
- `GET /api/install-url` — GitHub App installation URL.

### Repositories
- `GET /api/repos` — List all indexed repositories with chunk and review counts.
- `GET /api/repos/:id` — Get detailed repository information and chunk samples.
- `POST /api/repos/index` — Trigger full indexing for a GitHub repository (`{ "repo": "owner/name" }`).
- `DELETE /api/repos/:id` — Delete a repository, remove chunks from PostgreSQL, and purge vectors from Pinecone.

### Pull Request Reviews
- `GET /api/reviews` — List all PR review records.
- `GET /api/reviews/:id` — Retrieve review details and detected issues.
- `POST /api/reviews` — Manually trigger a review (`{ "owner": "...", "repo": "...", "prNumber": 1 }`).

### Intelligence & Exploration
- `POST /api/chat` — Codebase Copilot chat with repository context retrieval (`{ "question": "..." }`).
- `GET /api/dependencies?symbol=<name>` — Search symbol definitions and outgoing/incoming call dependencies.
- `GET /api/jobs/:queue/:id` — Track the state and progress of BullMQ background jobs.

---

## 🛡️ License

This project is licensed under the ISC License.
