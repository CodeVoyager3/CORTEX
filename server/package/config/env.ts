import 'dotenv/config';

/**
 * Centralized, validated environment config — the single source of truth for
 * every service. Each process reads config from here instead of scattering
 * `process.env` access across modules, so missing/invalid vars fail fast with
 * a clear message instead of causing obscure runtime errors deep in a worker.
 */

function str(name: string): string | undefined {
  let v = process.env[name];
  if (v === undefined || v.trim() === '') return undefined;
  v = v.trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1).trim();
  }
  return v !== '' ? v : undefined;
}

function num(name: string, fallback: number): number {
  const v = str(name);
  if (v === undefined) return fallback;
  const parsed = Number(v);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/** PEM private keys are commonly stored in .env with literal `\n` sequences. */
function pem(name: string): string | undefined {
  let v = process.env[name];
  if (v === undefined || v.trim() === '') return undefined;
  v = v.trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1).trim();
  }
  return v ? v.replace(/\\n/g, '\n').trim() : undefined;
}

export const env = {
  nodeEnv: str('NODE_ENV') ?? 'development',

  apiPort: num('API_PORT', 3001),
  webhookPort: num('WEBHOOK_PORT', 3002),

  databaseUrl: str('DATABASE_URL'),
  redisUrl: str('REDIS_URL') ?? 'redis://localhost:6379',

  pineconeApiKey: str('PINECONE_API_KEY'),
  pineconeIndex: str('PINECONE_INDEX') ?? 'cortex-index',

  groqApiKey: str('GROQ_API_KEY'),
  groqModel: str('GROQ_MODEL') ?? 'openai/gpt-oss-120b',

  githubWebhookSecret: str('GITHUB_WEBHOOK_SECRET'),
  // Static PAT — used as a fallback when GitHub App credentials are not configured.
  githubToken: str('GITHUB_TOKEN'),
  // GitHub App credentials (preferred in production).
  githubAppId: str('GITHUB_APP_ID'),
  githubAppPrivateKey: pem('GITHUB_APP_PRIVATE_KEY'),
  githubAppSlug: str('GITHUB_APP_SLUG'),
} as const;

/** Throws a clear error if a required value is absent. */
export function assertPresent(value: string | undefined, name: string): string {
  if (value === undefined) {
    throw new Error(`[config] Missing required environment variable: ${name}`);
  }
  return value;
}

/** True when GitHub App auth is fully configured (else workers fall back to the PAT). */
export const githubAppConfigured = Boolean(env.githubAppId && env.githubAppPrivateKey);

// DATABASE_URL is required by every service that touches Prisma.
assertPresent(env.databaseUrl, 'DATABASE_URL');
