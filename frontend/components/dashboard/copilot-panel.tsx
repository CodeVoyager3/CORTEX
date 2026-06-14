'use client';

import { useState, useRef, useEffect } from 'react';
import {
  Brain, Send, GitBranch, CornerDownLeft, Trash2, Copy, CheckCheck,
} from 'lucide-react';
import { type ActivityItem } from './activity-feed';

type Message = {
  id: string;
  role: 'user' | 'bot';
  content: string;
  dependencies?: string[];
  target_entity?: string;
  timestamp: Date;
};

const suggestedQueries = [
  'What does the auth module do?',
  'Show dependencies of the payment service',
  'What will break if I change UserModel?',
  'List all API endpoints',
  'Find all imports of DatabaseService',
  'Explain the main entry point',
];

interface CopilotPanelProps {
  onActivity: (item: ActivityItem) => void;
}

export function CopilotPanel({ onActivity }: CopilotPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleSubmit = async (e?: React.FormEvent, prefill?: string) => {
    e?.preventDefault();
    const query = prefill ?? input;
    if (!query.trim() || isTyping) return;

    const userMsg: Message = { id: crypto.randomUUID(), role: 'user', content: query, timestamp: new Date() };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    onActivity({ id: userMsg.id, query, type: 'chat', time: 'just now' });

    try {
      const response = await fetch('http://localhost:8000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: query }),
      });
      const data = await response.json();
      const botMsg: Message = {
        id: crypto.randomUUID(),
        role: 'bot',
        content: response.ok ? data.answer : `Error: ${data.detail ?? 'Unknown error'}`,
        dependencies: data.dependencies,
        target_entity: data.target_entity,
        timestamp: new Date(),
      };
      if (data.target_entity) {
        onActivity({ id: botMsg.id, query, entity: data.target_entity, type: 'dependency', time: 'just now' });
      }
      setMessages((prev) => [...prev, botMsg]);
    } catch {
      setMessages((prev) => [...prev, {
        id: crypto.randomUUID(),
        role: 'bot',
        content: 'Connection error. Is the backend running on port 8000?',
        timestamp: new Date(),
      }]);
    } finally {
      setIsTyping(false);
      inputRef.current?.focus();
    }
  };

  const copyMessage = async (id: string, content: string) => {
    await navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const formatTime = (d: Date) => d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="flex-1 flex flex-col overflow-hidden animate-fade-in">
      {/* Header */}
      <div className="px-7 py-4 border-b border-neutral-100 dark:border-neutral-800/60 flex items-center gap-3 shrink-0 bg-white dark:bg-neutral-950">
        <div className="w-8 h-8 rounded-lg bg-orange-50 dark:bg-orange-500/10 border border-orange-100 dark:border-orange-500/20 flex items-center justify-center">
          <Brain className="w-4 h-4 text-orange-500 dark:text-orange-400" />
        </div>
        <div>
          <h1 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 tracking-tight">Copilot Chat</h1>
          <p className="text-neutral-400 dark:text-neutral-500 text-xs">Powered by GraphRAG · Ask anything about the codebase</p>
        </div>

        <div className="ml-auto flex items-center gap-2">
          {messages.length > 0 && (
            <button
              onClick={() => setMessages([])}
              className="flex items-center gap-1.5 text-neutral-400 dark:text-neutral-500 hover:text-red-500 dark:hover:text-red-400 transition-colors text-xs border border-neutral-200 dark:border-neutral-700 hover:border-red-200 dark:hover:border-red-500/30 px-2.5 py-1.5 rounded-lg bg-white dark:bg-neutral-900"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear
            </button>
          )}
          <div className="flex items-center gap-1.5 text-xs text-neutral-400 dark:text-neutral-500 border border-neutral-200 dark:border-neutral-700 px-2.5 py-1.5 rounded-lg bg-white dark:bg-neutral-900">
            <GitBranch className="w-3 h-3" />
            GraphRAG
          </div>
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 overflow-y-auto scrollbar-hide px-6 py-5 space-y-4 bg-neutral-50/50 dark:bg-neutral-950">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center gap-6 text-center pb-20">
            <div className="w-16 h-16 rounded-2xl bg-orange-50 dark:bg-orange-500/10 border border-orange-100 dark:border-orange-500/20 flex items-center justify-center">
              <Brain className="w-8 h-8 text-orange-400 dark:text-orange-400/60" />
            </div>
            <div>
              <p className="text-neutral-600 dark:text-neutral-400 text-base font-semibold">Start exploring your codebase</p>
              <p className="text-neutral-400 dark:text-neutral-500 text-sm mt-1">
                Index a repository first, then ask anything about it
              </p>
            </div>
            <div className="flex flex-wrap gap-2 max-w-lg justify-center">
              {suggestedQueries.map((q, i) => (
                <button
                  key={i}
                  onClick={() => handleSubmit(undefined, q)}
                  className="px-3 py-1.5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-full text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200 hover:border-orange-200 dark:hover:border-orange-500/30 hover:bg-orange-50 dark:hover:bg-orange-500/5 text-xs transition-all duration-200"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-3 animate-fade-in ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.role === 'bot' && (
                <div className="w-7 h-7 rounded-lg bg-orange-50 dark:bg-orange-500/10 border border-orange-100 dark:border-orange-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Brain className="w-3.5 h-3.5 text-orange-500 dark:text-orange-400" />
                </div>
              )}

              <div className={`max-w-2xl group ${msg.role === 'user' ? '' : 'flex-1'}`}>
                <div className={`flex items-center gap-2 mb-1 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                  <span className="text-[11px] text-neutral-400 dark:text-neutral-500 font-medium">
                    {msg.role === 'user' ? 'You' : 'CORTEX'}
                  </span>
                  <span className="text-[11px] text-neutral-300 dark:text-neutral-600">{formatTime(msg.timestamp)}</span>
                </div>

                <div
                  className={`relative rounded-2xl px-4 py-3 ${
                    msg.role === 'user'
                      ? 'bg-orange-500 text-white border border-orange-400'
                      : 'bg-white dark:bg-neutral-900/80 border border-neutral-100 dark:border-neutral-800/60 text-neutral-800 dark:text-neutral-200'
                  }`}
                >
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>

                  {/* Dependency tree */}
                  {msg.dependencies && msg.dependencies.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-neutral-100 dark:border-neutral-700/50">
                      <div className="flex items-center gap-1.5 mb-2">
                        <GitBranch className="w-3.5 h-3.5 text-orange-500 dark:text-orange-400" />
                        <p className="text-xs text-orange-600 dark:text-orange-400 font-semibold">
                          Dependencies for{' '}
                          <code className="font-mono bg-orange-50 dark:bg-orange-500/10 px-1 py-0.5 rounded">
                            {msg.target_entity}
                          </code>
                        </p>
                      </div>
                      <div className="space-y-1">
                        {msg.dependencies.map((dep, i) => (
                          <div key={i} className="flex items-center gap-2 text-xs">
                            <span className="text-orange-400 font-mono">›</span>
                            <code className="text-neutral-600 dark:text-neutral-400 font-mono bg-neutral-50 dark:bg-neutral-800 px-1.5 py-0.5 rounded text-[11px]">
                              {dep}
                            </code>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {msg.role === 'bot' && (
                    <button
                      onClick={() => copyMessage(msg.id, msg.content)}
                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-400 hover:text-neutral-600 dark:text-neutral-500 dark:hover:text-neutral-300"
                    >
                      {copiedId === msg.id
                        ? <CheckCheck className="w-3 h-3 text-emerald-500" />
                        : <Copy className="w-3 h-3" />
                      }
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}

        {/* Typing indicator */}
        {isTyping && (
          <div className="flex gap-3 items-start animate-fade-in">
            <div className="w-7 h-7 rounded-lg bg-orange-50 dark:bg-orange-500/10 border border-orange-100 dark:border-orange-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Brain className="w-3.5 h-3.5 text-orange-500 dark:text-orange-400 animate-pulse" />
            </div>
            <div className="bg-white dark:bg-neutral-900/80 border border-neutral-100 dark:border-neutral-800/60 rounded-2xl px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="text-neutral-400 dark:text-neutral-500 text-xs">CORTEX is traversing the graph</span>
                <div className="flex gap-1">
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className="w-1.5 h-1.5 bg-orange-400 rounded-full animate-bounce"
                      style={{ animationDelay: `${i * 0.15}s` }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div className="px-6 py-4 border-t border-neutral-100 dark:border-neutral-800/60 shrink-0 bg-white dark:bg-neutral-950">
        <form onSubmit={handleSubmit} className="flex gap-3 items-center">
          <div className="flex-1 relative">
            <input
              ref={inputRef}
              id="chat-input"
              type="text"
              placeholder="Ask anything about the codebase…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={isTyping}
              className="w-full px-4 py-3 pr-10 bg-neutral-50 dark:bg-neutral-900/60 border border-neutral-200 dark:border-neutral-700 focus:border-orange-300 dark:focus:border-orange-500/50 focus:ring-2 focus:ring-orange-100 dark:focus:ring-orange-500/10 rounded-xl text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 dark:placeholder-neutral-500 text-sm outline-none transition-all disabled:opacity-50"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-300 dark:text-neutral-600 pointer-events-none">
              <CornerDownLeft className="w-4 h-4" />
            </div>
          </div>
          <button
            type="submit"
            id="ask-btn"
            disabled={isTyping || !input.trim()}
            className="flex items-center gap-2 px-5 py-3 bg-orange-500 hover:bg-orange-600 disabled:opacity-30 disabled:cursor-not-allowed rounded-xl text-sm font-semibold transition-colors duration-200 text-white shrink-0 shadow-sm"
          >
            {isTyping
              ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              : <Send className="w-4 h-4" />
            }
            Ask
          </button>
        </form>
        <p className="text-neutral-400 dark:text-neutral-500 text-[11px] mt-2 text-center">
          Responses powered by GraphRAG · Multimodal codebase intelligence
        </p>
      </div>
    </div>
  );
}
