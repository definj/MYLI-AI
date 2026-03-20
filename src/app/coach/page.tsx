'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Mic, Send, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

type ChatMessage = { role: 'user' | 'assistant'; content: string };
type CoachWorkoutPlanPayload = {
  tiers: Array<{ intensity: string; week_plan?: { week_start: string } }>;
};

export default function CoachPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [isGeneratingWorkoutPlan, setIsGeneratingWorkoutPlan] = useState(false);
  const [coachActionMessage, setCoachActionMessage] = useState<string | null>(null);
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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const generateWorkoutPlan = async () => {
    setIsGeneratingWorkoutPlan(true);
    setError(null);
    setCoachActionMessage(null);
    try {
      const response = await fetch('/api/workouts/generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          scope: 'week',
          active_tier_index: 2,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({ error: 'Failed to generate workout plan.' }));
        setError(payload.error || 'Failed to generate workout plan.');
        return;
      }

      const payload = (await response.json()) as CoachWorkoutPlanPayload;
      const intenseTier = payload.tiers?.[2];
      if (intenseTier?.intensity && intenseTier.week_plan?.week_start) {
        await fetch('/api/workouts/activate', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            intensity: intenseTier.intensity,
            week_start: intenseTier.week_plan.week_start,
          }),
        });
      }

      setCoachActionMessage('New workout plans generated. Your highest-intensity tier is now active.');
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setIsGeneratingWorkoutPlan(false);
    }
  };

  const prompts = [
    'Review my week',
    'Build meal plan',
    "I'm stressed",
    'Optimize workouts',
  ];

  return (
    <div className="flex h-full flex-col">
      <div className="z-10 flex items-center gap-3 border-b border-white/5 bg-[#0D0D0F]/90 p-6 pb-4 backdrop-blur-md">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-tr from-[#A78BFA] to-[#FF6B35] shadow-[0_0_15px_rgba(167,139,250,0.4)]">
          <Sparkles size={18} className="text-white" />
        </div>
        <div className="flex-1">
          <p className="text-lg font-bold leading-none text-white">MYLI Coach</p>
          <p className="mt-1 flex items-center gap-1 text-xs font-medium text-[#A78BFA]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#A78BFA] animate-pulse" />
            Always on
          </p>
        </div>
        {messages.length > 0 && (
          <button type="button" onClick={clearHistory} className="text-xs text-white/40 hover:text-white/70">
            Clear
          </button>
        )}
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 scrollbar-none">
        {isLoadingHistory ? (
          <div className="py-10 text-center text-sm text-white/50">Loading conversation...</div>
        ) : (
          <div className="flex flex-col gap-5">
            {messages.length === 0 && (
              <div className="rounded-[18px] border border-white/10 bg-white/[0.05] p-5 text-sm text-white/70">
                Ask me about workouts, macros, tasks, stress, or your daily brief.
              </div>
            )}
            {messages.map((message, idx) => (
              <div key={`${message.role}-${idx}`} className={`flex ${message.role === 'assistant' ? 'justify-start' : 'justify-end'}`}>
                <div
                  className={`max-w-[85%] whitespace-pre-wrap rounded-[24px] px-5 py-3.5 text-[15px] leading-relaxed ${
                    message.role === 'assistant'
                      ? 'rounded-tl-[8px] border border-white/10 bg-white/[0.06] text-white/90 backdrop-blur-[10px]'
                      : 'rounded-tr-[8px] bg-white font-medium text-black'
                  }`}
                >
                  {message.content}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="max-w-[85%] rounded-[24px] rounded-tl-[8px] border border-white/10 bg-white/[0.06] px-5 py-3 text-sm text-white/70">
                Thinking...
              </div>
            )}
            {coachActionMessage && (
              <div className="rounded-[12px] border border-[#A78BFA]/30 bg-[#A78BFA]/10 p-3 text-xs text-[#D5C7FF]">
                {coachActionMessage}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex-shrink-0 border-t border-white/5 bg-[#0D0D0F]/95 p-4 pb-6 backdrop-blur-[20px]">
        <div className="mb-3 flex gap-2 overflow-x-auto px-1 scrollbar-none">
          {prompts.map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => setDraft(prompt)}
              className="whitespace-nowrap rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[12px] text-white/70 hover:bg-white/10"
            >
              {prompt}
            </button>
          ))}
        </div>
        <div className="mb-3 flex gap-2">
          <Button
            type="button"
            onClick={generateWorkoutPlan}
            disabled={isGeneratingWorkoutPlan}
            className="h-10 rounded-[10px] bg-gradient-to-r from-[#A78BFA] to-[#FF6B35] text-xs text-white"
          >
            {isGeneratingWorkoutPlan ? 'Generating...' : 'Generate workout plan'}
          </Button>
          <Link href="/workouts" className="inline-flex h-10 items-center rounded-[10px] border border-white/15 bg-white/5 px-3 text-xs text-white/80">
            Open workouts
          </Link>
        </div>
        <div className="flex items-end gap-3">
          <button className="flex h-12 w-12 items-center justify-center rounded-full bg-white/5 text-white/60 hover:bg-white/10">
            <Mic size={18} />
          </button>
          <div className="relative flex-1">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              placeholder="Message MYLI..."
              className="max-h-[120px] min-h-[48px] w-full resize-none rounded-[24px] border border-white/10 bg-white/5 py-3 pl-4 pr-12 text-[15px] text-white placeholder-white/40 outline-none backdrop-blur-[10px] focus:border-[#A78BFA]/50 focus:bg-white/10"
              disabled={isLoading}
            />
            <button
              type="button"
              onClick={send}
              disabled={isLoading || !draft.trim()}
              className="absolute bottom-2 right-2 flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-r from-[#A78BFA] to-[#FF6B35] text-white disabled:opacity-50"
            >
              <Send size={14} className="ml-0.5" />
            </button>
          </div>
        </div>
        {error && <p className="mt-2 text-xs text-danger">{error}</p>}
      </div>
    </div>
  );
}
