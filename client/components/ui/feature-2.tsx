"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export default function FeaturesSection() {
  return (
    <section id="features" className="bg-background w-full py-20">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-6 lg:grid-cols-2">
        <div className="space-y-6">
          <div className="text-muted-foreground bg-muted/50 inline-flex w-fit items-center gap-2 rounded-lg px-3 py-1 text-sm">
            <span className="bg-primary h-2 w-2 rounded-full" />
            GraphRAG Intelligence
          </div>

          <h2 className="text-5xl leading-tight font-semibold tracking-tight">
            Query your codebase with natural language
          </h2>

          <p className="text-muted-foreground max-w-lg">
            CORTEX builds a rich knowledge graph from your repository — understanding dependencies,
            call chains, and architecture — so you can ask complex questions and get precise,
            context-aware answers instantly.
          </p>

          <div className="flex gap-2 flex-col sm:flex-row">
            <Accordion type="single" collapsible className="flex flex-col gap-2 w-full">
              <AccordionItem
                value="item-1"
                className="bg-muted/50 rounded-lg border-none! px-4"
              >
                <AccordionTrigger className="text-sm hover:no-underline">
                  What can I ask CORTEX?
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground pb-3 text-sm">
                  Ask anything about your codebase — "What modules depend on the auth service?",
                  "Show me all places where this function is called", "What will break if I change
                  this class?" CORTEX understands structure and semantics.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem
                value="item-2"
                className="bg-muted/50 border-b-none flex-1 rounded-lg px-4"
              >
                <AccordionTrigger className="text-sm hover:no-underline">
                  How does multimodal ingestion work?
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground pb-3 text-sm">
                  CORTEX processes code files, README docs, diagrams, and comments together.
                  It builds a unified graph embedding that captures both the code structure
                  and the developer intent documented alongside it.
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>

          <Button
            className="rounded-sm px-6 shadow-[inset_0_0px_2px_0px_rgba(0,0,0,0.1),inset_0_0px_4px_0px_rgba(0,0,0,0.1)]"
            asChild
          >
            <a href="/login">Start exploring</a>
          </Button>
        </div>

        <div className="bg-muted dark:bg-card/50 relative flex justify-center rounded-xl p-8 shadow-[inset_0_0px_4px_0px_rgba(0,0,0,0.1)] dark:shadow-[inset_0_0px_4px_0px_rgba(0,0,0,1)]">
          <div className="relative h-[380px] w-full max-w-md">
            <Card className="bg-background/80 dark:bg-card/80 ring-border/50 absolute top-0 left-0 w-[260px] rounded-lg p-0 shadow-md backdrop-blur-md">
              <CardContent className="space-y-2 p-4">
                <div className="text-muted-foreground text-xs">
                  Graph Analysis
                </div>

                <div className="text-2xl font-semibold">
                  847<span className="text-muted-foreground text-sm"> nodes</span>
                </div>

                <div className="flex gap-2 text-[10px]">
                  <span className="rounded-md bg-purple-200 px-2 py-0.5 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300">
                    Functions
                  </span>
                  <span className="rounded-md bg-cyan-200 px-2 py-0.5 text-cyan-700 dark:bg-cyan-900/50 dark:text-cyan-300">
                    Classes
                  </span>
                </div>

                <div className="text-muted-foreground space-y-1 text-xs">
                  <div>Dependencies mapped: 1,204</div>
                  <div>Call chains traced: 388</div>
                  <div>Coverage: 98.7%</div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-background/90 dark:bg-card/80 ring-border/50 absolute top-28 right-0 z-50 w-[240px] rounded-lg p-0 shadow-lg backdrop-blur-md">
              <CardContent className="space-y-3 p-4">
                <div className="text-muted-foreground text-xs">
                  Query Response
                </div>

                <div className="text-muted-foreground text-sm">
                  <span className="text-foreground font-medium">
                    &lt; 1.2s response
                  </span>{" "}
                  time
                </div>

                <div className="flex h-2 w-full gap-1">
                  <div className="w-[50%] rounded-full bg-purple-400" />
                  <div className="w-[30%] rounded-full bg-cyan-400" />
                  <div className="w-[20%] rounded-full bg-emerald-400" />
                </div>

                <div className="text-muted-foreground flex gap-3 text-[10px]">
                  <span className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-purple-400" />
                    Graph Traversal
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-cyan-400" />
                    Embeddings
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-emerald-400" />
                    LLM
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-background/90 dark:bg-card/80 ring-border/50 absolute bottom-8 left-10 w-[260px] rounded-lg p-0 shadow-lg backdrop-blur-md">
              <CardContent className="space-y-3 p-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">Copilot Answer</span>
                  <span className="text-muted-foreground text-xs">Live</span>
                </div>

                <div className="text-muted-foreground text-sm">
                  <span className="text-foreground font-medium">
                    3 modules affected
                  </span>{" "}
                  by this change
                </div>

                <div className="flex gap-2 text-[10px]">
                  <span className="rounded-md bg-amber-200 px-2 py-0.5 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300">
                    Impact Analysis
                  </span>
                  <span className="rounded-md bg-green-200 px-2 py-0.5 text-green-700 dark:bg-green-900/50 dark:text-green-300">
                    Safe to Refactor
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </section>
  );
}
