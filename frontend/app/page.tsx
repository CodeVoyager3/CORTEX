'use client';

import { useState } from 'react';

type Message = {
  role: 'user' | 'bot';
  content: string;
  dependencies?: string[];
  target_entity?: string;
};

export default function Home() {
  // State for Ingestion
  const [repoPath, setRepoPath] = useState('');
  const [isIngesting, setIsIngesting] = useState(false);
  const [ingestMessage, setIngestMessage] = useState('');

  // State for Chat
  const [question, setQuestion] = useState('');
  const [chatHistory, setChatHistory] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);

  // Handle Repo Ingestion
  const handleIngest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!repoPath.trim()) return;
    
    setIsIngesting(true);
    setIngestMessage('Crawling and embedding repository...');

    try {
      const response = await fetch('http://localhost:8000/api/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source_path: repoPath }),
      });

      const data = await response.json();
      if (response.ok) {
        setIngestMessage(`✅ Success: ${data.message}`);
        setRepoPath('');
      } else {
        setIngestMessage(`❌ Error: ${data.detail}`);
      }
    } catch (error) {
      setIngestMessage('❌ Failed to connect to the backend.');
    } finally {
      setIsIngesting(false);
    }
  };

  // Handle Copilot Chat
  const handleAsk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim()) return;

    // Add user message to UI
    const userMsg: Message = { role: 'user', content: question };
    setChatHistory((prev) => [...prev, userMsg]);
    setQuestion('');
    setIsTyping(true);

    try {
      const response = await fetch('http://localhost:8000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: userMsg.content }),
      });

      const data = await response.json();
      
      if (response.ok) {
        setChatHistory((prev) => [
          ...prev,
          {
            role: 'bot',
            content: data.answer,
            target_entity: data.target_entity,
            dependencies: data.dependencies,
          },
        ]);
      } else {
        setChatHistory((prev) => [...prev, { role: 'bot', content: `Error: ${data.detail}` }]);
      }
    } catch (error) {
      setChatHistory((prev) => [...prev, { role: 'bot', content: 'Connection error. Is the backend running?' }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 flex flex-col md:flex-row font-sans">
      
      {/* Sidebar: Ingestion Panel */}
      <div className="w-full md:w-1/3 bg-gray-800 p-6 border-r border-gray-700 flex flex-col">
        <h1 className="text-2xl font-bold mb-2 text-blue-400">Engineering Hub</h1>
        <p className="text-sm text-gray-400 mb-8">Multimodal GraphRAG Copilot</p>

        <div className="bg-gray-900 p-4 rounded-lg border border-gray-700">
          <h2 className="text-lg font-semibold mb-4">1. Ingest Codebase</h2>
          <form onSubmit={handleIngest} className="flex flex-col gap-3">
            <input
              type="text"
              placeholder="e.g., https://github.com/user/repo or ./local_path"
              value={repoPath}
              onChange={(e) => setRepoPath(e.target.value)}
              className="p-2 rounded bg-gray-800 border border-gray-600 focus:outline-none focus:border-blue-500 text-sm"
              disabled={isIngesting}
            />
            <button
              type="submit"
              disabled={isIngesting}
              className="bg-blue-600 hover:bg-blue-500 transition py-2 rounded text-sm font-bold disabled:opacity-50"
            >
              {isIngesting ? 'Processing...' : 'Index Repository'}
            </button>
          </form>
          {ingestMessage && (
            <p className="mt-4 text-xs text-gray-400 break-words">{ingestMessage}</p>
          )}
        </div>
      </div>

      {/* Main Area: Chat Interface */}
      <div className="flex-1 flex flex-col p-6">
        <h2 className="text-xl font-semibold mb-4 border-b border-gray-700 pb-2">2. Query Copilot</h2>
        
        {/* Chat History Window */}
        <div className="flex-1 overflow-y-auto mb-4 space-y-4 pr-2">
          {chatHistory.length === 0 ? (
            <div className="text-gray-500 h-full flex items-center justify-center italic">
              Index a repository, then ask a question about the code...
            </div>
          ) : (
            chatHistory.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-2xl rounded-lg p-4 ${msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-800 border border-gray-700'}`}>
                  
                  {/* User Question */}
                  {msg.role === 'user' && <p>{msg.content}</p>}

                  {/* AI Response */}
                  {msg.role === 'bot' && (
                    <>
                      <p className="text-sm leading-relaxed">{msg.content}</p>
                      
                      {/* Graph Dependencies Rendered */}
                      {msg.dependencies && msg.dependencies.length > 0 && (
                        <div className="mt-4 pt-3 border-t border-gray-700">
                          <p className="text-xs text-gray-400 font-semibold mb-2">
                            🔗 Graph Dependencies for `{msg.target_entity}`:
                          </p>
                          <ul className="text-xs text-gray-400 space-y-1">
                            {msg.dependencies.map((dep, dIdx) => (
                              <li key={dIdx}>{dep}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))
          )}
          {isTyping && (
            <div className="flex justify-start">
              <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 animate-pulse text-gray-400 text-sm">
                Copilot is traversing the graph...
              </div>
            </div>
          )}
        </div>

        {/* Input Form */}
        <form onSubmit={handleAsk} className="flex gap-2">
          <input
            type="text"
            placeholder="e.g., What variables are affected if I change the expected goals calculation?"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            className="flex-1 p-3 rounded-lg bg-gray-800 border border-gray-700 focus:outline-none focus:border-blue-500"
            disabled={isTyping}
          />
          <button
            type="submit"
            disabled={isTyping || !question.trim()}
            className="bg-green-600 hover:bg-green-500 transition px-6 py-3 rounded-lg font-bold disabled:opacity-50"
          >
            Ask
          </button>
        </form>
      </div>

    </div>
  );
}