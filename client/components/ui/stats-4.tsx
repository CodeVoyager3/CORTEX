"use client";

import React, { useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  ArrowUpRight,
  GitBranch,
  Zap,
  Shield,
  ChevronRight,
  Brain,
} from "lucide-react";

function GlowingBorderCard({
  children,
  className,
  glowColor,
  repeatingGradient,
}: {
  children: React.ReactNode;
  className?: string;
  glowColor: string;
  repeatingGradient: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [opacity, setOpacity] = useState(0);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    setPosition({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  return (
    <div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setOpacity(1)}
      onMouseLeave={() => setOpacity(0)}
      className={`bg-border/40 relative rounded-2xl p-[2px] ${className || ""}`}
    >
      <div
        className="pointer-events-none absolute inset-0 rounded-2xl transition-opacity duration-300"
        style={{
          opacity,
          background: `radial-gradient(600px circle at ${position.x}px ${position.y}px, ${glowColor}, transparent 40%)`,
        }}
      />

      <div className="bg-background relative z-10 h-full overflow-hidden rounded-2xl">
        <div
          className="pointer-events-none absolute inset-0 opacity-30 dark:opacity-50"
          style={{ background: repeatingGradient }}
        />

        <div className="to-background/80 pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent" />

        <div className="relative z-20 flex h-full flex-col justify-between p-8">
          {children}
        </div>
      </div>
    </div>
  );
}

export default function StatsSection() {
  return (
    <section id="stats" className="bg-background relative w-full px-4 py-24 md:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="grid grid-cols-1 items-center gap-16 lg:grid-cols-12">
          <div className="flex flex-col gap-8 lg:col-span-5">
            <div className="inline-flex">
              <Badge
                variant="secondary"
                className="flex w-fit items-center gap-2 rounded-full px-4 py-1.5 text-sm"
              >
                <Brain className="text-foreground h-4 w-4" />
                <span className="text-foreground font-medium">
                  Engineering Intelligence
                </span>
              </Badge>
            </div>

            <h2 className="text-foreground text-5xl leading-[1.05] font-bold tracking-tight md:text-6xl lg:text-7xl">
              Built for{" "}
              <br className="hidden md:block" />
              engineering scale
            </h2>

            <p className="text-muted-foreground max-w-md text-lg leading-relaxed">
              CORTEX handles production-scale repositories with millions of lines of code,
              delivering sub-second responses through optimized graph traversal and
              semantic search.
            </p>

            <div className="flex flex-wrap items-center gap-4 pt-2">
              <a
                href="/login"
                className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center justify-center gap-2 rounded-lg px-6 py-3 text-sm font-semibold transition-colors"
              >
                Start exploring
              </a>
              <a
                href="#faq"
                className="border-border bg-background text-foreground hover:bg-muted inline-flex items-center justify-center gap-2 rounded-lg border px-6 py-3 text-sm font-semibold transition-colors"
              >
                Learn more
                <ArrowUpRight className="h-4 w-4" />
              </a>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:col-span-7">
            <GlowingBorderCard
              glowColor="rgba(139, 92, 246, 0.8)"
              repeatingGradient="repeating-linear-gradient(45deg, rgba(139, 92, 246, 0.15), rgba(139, 92, 246, 0.15) 15px, transparent 15px, transparent 30px)"
            >
              <div>
                <div className="bg-background text-foreground border-border/50 mb-6 flex h-10 w-10 items-center justify-center rounded-lg border shadow-sm">
                  <GitBranch className="h-5 w-5 text-purple-500" />
                </div>
                <div className="text-foreground mb-2 text-5xl font-bold tracking-tight">
                  99.9
                  <span className="text-muted-foreground ml-1 text-2xl">%</span>
                </div>
                <h3 className="text-foreground mb-2 text-base font-semibold">
                  Graph Accuracy
                </h3>
              </div>
              <p className="text-muted-foreground mt-4 text-sm leading-relaxed">
                CORTEX builds highly accurate dependency graphs, mapping every function
                call, import, and module relationship in your codebase.
              </p>
            </GlowingBorderCard>

            <GlowingBorderCard
              glowColor="rgba(34, 211, 238, 0.8)"
              repeatingGradient="repeating-linear-gradient(-45deg, rgba(34, 211, 238, 0.15), rgba(34, 211, 238, 0.15) 15px, transparent 15px, transparent 30px)"
            >
              <div>
                <div className="bg-background text-foreground border-border/50 mb-6 flex h-10 w-10 items-center justify-center rounded-lg border shadow-sm">
                  <Zap className="h-5 w-5 text-cyan-500" />
                </div>
                <div className="text-foreground mb-2 text-5xl font-bold tracking-tight">
                  10
                  <span className="text-muted-foreground ml-1 text-2xl">x</span>
                </div>
                <h3 className="text-foreground mb-2 text-base font-semibold">
                  Faster Code Reviews
                </h3>
              </div>
              <p className="text-muted-foreground mt-4 text-sm leading-relaxed">
                Understand PRs in minutes instead of hours. CORTEX shows you exactly what
                changes and what stays safe, with full dependency context.
              </p>
            </GlowingBorderCard>

            <GlowingBorderCard
              className="sm:col-span-2"
              glowColor="rgba(16, 185, 129, 0.8)"
              repeatingGradient="repeating-linear-gradient(90deg, rgba(16, 185, 129, 0.15), rgba(16, 185, 129, 0.15) 15px, transparent 15px, transparent 30px)"
            >
              <div className="flex w-full flex-col items-start gap-8 sm:flex-row sm:items-center">
                <div className="flex-1">
                  <div className="bg-background text-foreground border-border/50 mb-6 flex h-10 w-10 items-center justify-center rounded-lg border shadow-sm">
                    <Shield className="h-5 w-5 text-emerald-500" />
                  </div>
                  <div className="text-foreground mb-2 text-5xl font-bold tracking-tight md:text-6xl">
                    60
                    <span className="text-muted-foreground ml-1 text-3xl">
                      hrs+
                    </span>
                  </div>
                  <h3 className="text-foreground text-base font-semibold">
                    Saved Per Engineer / Month
                  </h3>
                </div>
                <div className="flex-1">
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    Engineering teams report saving over 60 hours per engineer each month by
                    eliminating manual code archaeology, reducing onboarding time from weeks
                    to days, and catching breaking changes before they hit production.
                  </p>

                  <a
                    href="#faq"
                    className="text-foreground mt-6 inline-flex cursor-pointer items-center gap-1.5 text-sm font-medium hover:underline"
                  >
                    See how it works <ChevronRight className="h-4 w-4" />
                  </a>
                </div>
              </div>
            </GlowingBorderCard>
          </div>
        </div>
      </div>
    </section>
  );
}
