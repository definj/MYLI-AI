'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { FeatureShell } from '@/components/app/feature-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type ChatMessage = { role: 'user' | 'assistant'; content: string };

export default function CoachPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading, scrollToBottom]);

  // Load chat history on mount
  useEffect(() => {
    const loadHistory = async () => {
      try {
        const res = await fetch('/api/coach/chat');
        if (res.ok) {
          const data = await res.json();
          if (data.messages?.length) {
            setMessages(
              data.messages.map((m: { role: string; content: string }) => ({
                role: m.role as 'user' | 'assistant',
                content: m.content,
              }))
            );
          }
        }
      } catch {
        // Silently fail — user starts with empty chat
      } finally {
        setIsLoadingHistory(false);
      }
    };
    loadHistory();
  }, []);

  const send = async () => {
    if (!draft.trim() || isLoading) return;
    const userMsg = draft.trim();
    setMessages((prev) => [...prev, { role: 'user', content: userMsg }]);
    setDraft('');
    setError(null);
    setIsLoading(true);
    try {
      const response = await fetch('/api/coach/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message: userMsg }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({ error: 'Coach is unavailable.' }));
        setError(body.error || 'Coach is unavailable.');
        return;
      }
      const body = (await response.json()) as { content: string };
      setMessages((prev) => [...prev, { role: 'assistant', content: body.content }]);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const clearHistory = async () => {
    try {
      await fetch('/api/coach/chat', { method: 'DELETE' });
      setMessages([]);
      setError(null);
    } catch {
      setError('Could not clear history.');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <FeatureShell
      eyebrow="Coach"
      title="AI Life Coach"
      description="Contextual guidance powered by your full MYLI profile."
    >
      <div className="rounded-xl border border-bg-surface bg-bg-surface/70 p-4 sm:p-6">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-3 py-1 text-xs font-medium text-success">
              <span className="h-1.5 w-1.5 rounded-full bg-success" />
              Profile connected
            </span>
            <span className="text-xs text-accent-muted hidden sm:inline">
              Coach sees your profile, tasks, meals, workouts &amp; streaks
            </span>
          </div>
          {messages.length > 0 && (
            <button
              type="button"
              onClick={clearHistory}
              className="text-xs text-accent-muted hover:text-danger transition-colors"
            >
              Clear history
            </button>
          )}
        </div>

        <div
          ref={scrollRef}
          className="max-h-[55vh] min-h-[200px] space-y-3 overflow-auto rounded-lg border border-bg-surface bg-bg-secondary p-4 scrollbar-none"
        >
          {isLoadingHistory && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="flex gap-1.5">
                <span className="h-2 w-2 rounded-full bg-accent-muted animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="h-2 w-2 rounded-full bg-accent-muted animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="h-2 w-2 rounded-full bg-accent-muted animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
              <p className="text-xs text-accent-muted mt-3">Loading conversation...</p>
            </div>
          )}

          {!isLoadingHistory && messages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-lg font-display text-accent-white mb-2">Welcome to your AI Coach</p>
              <p className="text-sm text-accent-muted max-w-xs">
                Ask me about your fitness goals, daily tasks, nutrition, habits, or anything in your MYLI profile.
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {[
                  'How am I doing this week?',
                  'What should I focus on today?',
                  'Review my nutrition',
                  'Help me plan a workout',
                ].map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => setDraft(suggestion)}
                    className="rounded-full border border-bg-surface px-3 py-1.5 text-xs text-accent-muted hover:text-accent-white hover:border-accent-gold/50 transition-colors"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((message, idx) => (
            <div
              key={`${message.role}-${idx}`}
              className={`rounded-lg px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                message.role === 'user'
                  ? 'bg-accent-gold text-bg-primary ml-8'
                  : 'bg-bg-primary text-accent-white mr-8 border border-bg-surface'
              }`}
            >
              {message.role === 'assistant' && (
                <span className="block text-[10px] font-mono uppercase tracking-widest text-accent-muted mb-1">MYLI Coach</span>
              )}
              {message.content}
            </div>
          ))}

          {isLoading && (
            <div className="rounded-lg bg-bg-primary border border-bg-surface px-4 py-3 mr-8">
              <span className="block text-[10px] font-mono uppercase tracking-widest text-accent-muted mb-1">MYLI Coach</span>
              <div className="flex gap-1.5">
                <span className="h-2 w-2 rounded-full bg-accent-muted animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="h-2 w-2 rounded-full bg-accent-muted animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="h-2 w-2 rounded-full bg-accent-muted animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          )}
        </div>

        <div className="mt-4 flex gap-3">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask your coach anything..."
            className="h-11 bg-bg-secondary border-none text-accent-white placeholder:text-accent-muted"
            disabled={isLoading}
          />
          <Button
            type="button"
            className="bg-accent-gold text-bg-primary hover:bg-accent-gold/90 min-w-[80px]"
            onClick={send}
            disabled={isLoading || !draft.trim()}
          >
            {isLoading ? 'Thinking...' : 'Send'}
          </Button>
        </div>
        {error && <p className="mt-3 text-sm text-danger">{error}</p>}
      </div>
    </FeatureShell>
  );
}
