import { Groq } from 'groq-sdk';
import { env, assertPresent } from '../config/env';

/**
 * LLM layer for codebase chat (Copilot). Owns the grounding prompt and the
 * model call so the chat controller stays free of AI/SDK details - mirrors the
 * structure of package/ai/review.ts.
 *
 * The client is created lazily so importing this module never crashes a service
 * that boots without GROQ_API_KEY configured (the health endpoint reports it).
 */

let groq: Groq | null = null;

function getGroq(): Groq {
  if (!groq) {
    groq = new Groq({ apiKey: assertPresent(env.groqApiKey, 'GROQ_API_KEY') });
  }
  return groq;
}

export function buildChatPrompt(question: string, context: string): string {
  return `You are CORTEX, an expert engineering-intelligence assistant.
Answer the developer's question about their codebase using ONLY the repository context below.
- Cite the relevant file paths when you reference code.
- If the context is insufficient to answer fully, say so and name what is missing.
- Be concise, technical and precise. Use short paragraphs or bullet points.

Repository context:
${context}

Developer question:
${question}`;
}

/** Calls the chat model and returns the plain-text answer. */
export async function runChat(prompt: string): Promise<string> {
  const completion = await getGroq().chat.completions.create({
    messages: [{ role: 'user', content: prompt }],
    model: env.groqModel,
    temperature: 0.2,
  });

  const answer = completion.choices[0]?.message?.content?.trim();
  return answer || 'The model returned an empty answer. Try rephrasing the question.';
}
