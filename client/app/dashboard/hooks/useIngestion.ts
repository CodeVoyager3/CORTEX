'use client';

import { useState, useEffect } from 'react';

export type IngestionStatus = 'IDLE' | 'POLLING' | 'SUCCESS' | 'ERROR';

export interface IngestionState {
  status: IngestionStatus;
  message: string;
}

export function useIngestion() {
  const [taskId, setTaskId] = useState<string | null>(null);
  const [status, setStatus] = useState<IngestionStatus>('IDLE');
  const [message, setMessage] = useState('');

  /** Submit a new ingestion job and begin polling once a task_id is returned. */
  const startIngestion = async (sourcePath: string) => {
    setStatus('POLLING');
    setMessage('Crawling and embedding repository…');

    try {
      const res = await fetch('http://localhost:8000/api/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source_path: sourcePath }),
      });
      const data = await res.json();

      if (!res.ok) {
        // Backend returned a synchronous error (no task queued).
        setStatus('ERROR');
        setMessage(data.detail ?? 'Ingestion failed.');
        return;
      }

      if (data.task_id) {
        // Async path — backend queued a Celery/background task; start polling.
        setTaskId(data.task_id);
      } else {
        // Synchronous success path — backend completed inline.
        setStatus('SUCCESS');
        setMessage(data.message ?? 'Repository indexed successfully!');
      }
    } catch {
      setStatus('ERROR');
      setMessage('Could not connect to backend (port 8000).');
    }
  };

  /** Reset back to idle so the form can be reused. */
  const reset = () => {
    setStatus('IDLE');
    setMessage('');
    setTaskId(null);
  };

  // Poll the task-status endpoint every 2 seconds while a task_id is active.
  useEffect(() => {
    if (!taskId || status !== 'POLLING') return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(
          `http://localhost:8000/api/ingest/status/${taskId}`
        );
        const data = await res.json();

        if (data.state === 'SUCCESS') {
          setStatus('SUCCESS');
          setMessage(data.result?.message ?? 'Repository indexed successfully!');
          setTaskId(null);
        } else if (data.state === 'FAILURE') {
          setStatus('ERROR');
          setMessage(data.error ?? 'Ingestion failed.');
          setTaskId(null);
        } else if (data.state === 'PROGRESS') {
          // Keep polling; surface the latest progress message.
          setMessage(data.details ?? 'Processing…');
        }
        // PENDING / STARTED — keep polling silently.
      } catch (err) {
        console.error('Polling error', err);
        // Network blip — don't abort, keep trying.
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [taskId, status]);

  return { startIngestion, reset, status, message };
}
