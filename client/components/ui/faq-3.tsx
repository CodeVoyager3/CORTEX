"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";

export interface FAQItem {
  question: string;
  answer: string;
}

const defaultFaqs: FAQItem[] = [
  {
    question: "What is CORTEX and how does it work?",
    answer:
      "CORTEX is a Multimodal GraphRAG-powered engineering intelligence platform. It ingests your codebase — GitHub repos or local paths — builds a rich knowledge graph of all code relationships, then lets you query that graph using natural language. It combines graph traversal with semantic embeddings and LLM reasoning to give precise, context-aware answers.",
  },
  {
    question: "What languages and frameworks does CORTEX support?",
    answer:
      "CORTEX supports all major programming languages including Python, JavaScript/TypeScript, Java, Go, Rust, C/C++, and more. It understands framework-specific patterns for React, Django, Spring Boot, and others. The knowledge graph captures imports, function calls, class hierarchies, and module dependencies regardless of language.",
  },
  {
    question: "How do I ingest my repository?",
    answer:
      "Simply paste your GitHub repository URL or a local file path into the dashboard's ingestion panel and click 'Index Repository'. CORTEX will crawl your codebase, parse all source files, build the dependency graph, and generate embeddings — typically completing in 1-5 minutes depending on repository size.",
  },
  {
    question: "Is my code safe and private?",
    answer:
      "Yes. CORTEX processes your code locally by default. When using the self-hosted version, your source code never leaves your infrastructure. The embeddings and graph data are stored in your own database. For cloud deployments, all data is encrypted at rest and in transit, with strict access controls.",
  },
  {
    question: "Can CORTEX analyze very large codebases?",
    answer:
      "Absolutely. CORTEX is built for production scale — it has been tested on monorepos with 10M+ lines of code. The graph database scales horizontally, and query responses remain under 2 seconds even for complex multi-hop traversals across large dependency trees.",
  },
  {
    question: "What kinds of questions can I ask?",
    answer:
      "You can ask anything about your codebase structure and logic: 'What services depend on the payment module?', 'Show me all callers of this function', 'What will break if I rename this class?', 'Where is user authentication handled?', 'Explain how data flows from the API to the database'. CORTEX understands both structural and semantic questions.",
  },
];

export default function FAQSection({
  badge = "Frequently asked questions",
  heading = "Everything you need to know",
  subheading = "Questions about CORTEX? We've got answers. If you don't find what you're looking for, reach out to our team.",
  items = defaultFaqs,
}: {
  badge?: string;
  heading?: string;
  subheading?: string;
  items?: FAQItem[];
}) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section
      id="faq"
      className="bg-background flex min-h-screen w-full flex-col items-center justify-center px-4 py-20 sm:py-28"
    >
      {/* ── Header ── */}
      <div className="mb-12 flex w-full max-w-xl flex-col items-center text-center sm:mb-16">
        {badge && (
          <Badge
            variant="outline"
            className="border-border bg-background text-muted-foreground mb-5 gap-1.5 rounded-full px-3 py-1 text-xs font-medium tracking-wide"
          >
            <span className="bg-primary inline-block h-2 w-2 rounded-full" />
            {badge}
          </Badge>
        )}

        <h2 className="text-foreground mb-4 text-4xl leading-tight font-bold tracking-tight sm:text-5xl">
          {heading}
        </h2>

        <p className="text-muted-foreground max-w-sm text-sm leading-relaxed sm:text-base">
          {subheading}
        </p>
      </div>

      <div className="w-full max-w-2xl">
        <div className="flex w-full flex-col">
          {items.map((item, i) => {
            const num = String(i + 1).padStart(2, "0");
            const isOpen = openIndex === i;
            return (
              <div
                key={i}
                className={`group border-border overflow-hidden border transition-all duration-300 ${
                  isOpen
                    ? "bg-gradient-to-r from-primary/70 to-primary/50 border-border/80 shadow-sm"
                    : "bg-muted/30 hover:border-border/80 hover:bg-muted/50"
                }`}
              >
                <button
                  className="flex w-full items-center gap-4 px-5 py-5 hover:no-underline sm:px-7 sm:py-3 text-left"
                  onClick={() => setOpenIndex(isOpen ? null : i)}
                >
                  <span
                    className={`w-8 shrink-0 text-center text-xs font-semibold tracking-widest tabular-nums transition-colors duration-200 ${
                      isOpen ? "text-muted" : "text-muted-foreground/50 group-hover:text-muted-foreground"
                    }`}
                  >
                    {num}
                  </span>

                  <span
                    className={`flex-1 text-left text-sm leading-snug font-medium transition-colors duration-200 sm:text-base ${
                      isOpen ? "text-muted" : "text-muted-foreground group-hover:text-foreground"
                    }`}
                  >
                    {item.question}
                  </span>

                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center transition-all duration-300 ${
                      isOpen ? "text-muted" : "group-hover:text-foreground"
                    }`}
                  >
                    <svg
                      className={`h-3 w-3 transition-transform duration-300 ${isOpen ? "rotate-45" : ""}`}
                      fill="none"
                      viewBox="0 0 12 12"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        d="M6 1v10M1 6h10"
                      />
                    </svg>
                  </span>
                </button>

                <div
                  className={`overflow-hidden transition-all duration-300 ease-in-out ${
                    isOpen ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
                  }`}
                >
                  <div className="px-5 pt-0 pb-5 pl-[4.25rem] sm:px-7 sm:pb-6">
                    <p className={`text-sm leading-relaxed sm:text-base ${isOpen ? "text-foreground" : "text-foreground"}`}>
                      {item.answer}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
