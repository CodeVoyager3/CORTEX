import { Groq } from 'groq-sdk';
import { env, assertPresent } from '../config/env';

/**
 * LLM layer for PR review. Owns the prompt template, the model call, and parsing
 * the structured response — so the review orchestration (DB, RAG, blast radius)
 * stays free of AI/SDK details and the prompt can be tuned in one place.
 */

export interface ReviewIssue {
  filePath: string;
  lineNumber: number;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical' | string;
}

const groq = new Groq({ apiKey: assertPresent(env.groqApiKey, 'GROQ_API_KEY') });

export interface ReviewPromptInput {
  diffText: string;
  blastRadiusSummary: string;
  repositoryContext: string;
}

export function buildReviewPrompt({
  diffText,
  blastRadiusSummary,
  repositoryContext,
}: ReviewPromptInput): string {
  return `
        You are an expert code reviewer. Analyze the following PR diff using the provided repository context.
        Pay particular attention to the downstream blast radius below and flag any issues that could break dependent consumers.
        Return ONLY a valid JSON object matching this schema: 
        { "issues": [{ "filePath": "string", "lineNumber": number, "description": "string", "severity": "low" | "medium" | "high" | "critical" }] }

        Downstream Blast Radius:
        ${blastRadiusSummary}

        Repository Context:
        ${repositoryContext}

        PR Diff:
        ${diffText}
      `;
}

/** Calls the review model and returns the parsed issue list (empty on no issues). */
export async function runReview(prompt: string): Promise<ReviewIssue[]> {
  const completion = await groq.chat.completions.create({
    messages: [{ role: 'user', content: prompt }],
    model: env.groqModel,
    temperature: 0,
    response_format: { type: 'json_object' },
  });

  const text = completion.choices[0]?.message?.content || '{"issues":[]}';
  const parsed = JSON.parse(text) as { issues?: ReviewIssue[] };
  return Array.isArray(parsed.issues) ? parsed.issues : [];
}
