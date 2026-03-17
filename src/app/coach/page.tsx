'use client';

import { useState } from 'react';
import { FeatureShell } from '@/components/app/feature-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type ChatMessage = { role: 'user' | 'assistant'; content: string };

export default function CoachPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    if (!draft.trim()) return;
    const nextMessages = [...messages, { role: 'user' as const, content: draft.trim() }];
    setMessages(nextMessages);
    setDraft('');
    setError(null);
    setIsLoading(true);
    const response = await fetch('/api/coach/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ messages: nextMessages }),
    });
    setIsLoading(false);
    if (!response.ok) {
      const body = await response.json().catch(() => ({ error: 'Coach is unavailable.' }));
      setError(body.error || 'Coach is unavailable.');
      return;
    }
    const body = (await response.json()) as { content: string };
    setMessages((prev) => [...prev, { role: 'assistant', content: body.content }]);
  };

  return (
    <FeatureShell
      eyebrow="Coach"
      title="AI Life Coach"
      description="Get contextual guidance for prioritization, planning, reflection, and recovery."
    >
      <div className="rounded-xl border border-bg-surface bg-bg-surface/70 p-6">
        <div className="max-h-[50vh] space-y-3 overflow-auto rounded-lg border border-bg-surface bg-bg-secondary p-4">
          {messages.length === 0 && <p className="text-sm text-accent-muted">Start a conversation with your coach.</p>}
          {messages.map((message, idx) => (
            <div
              key={`${message.role}-${idx}`}
              className={`rounded-md px-3 py-2 text-sm ${
                message.role === 'user' ? 'bg-accent-gold text-bg-primary' : 'bg-bg-primary text-accent-white'
              }`}
            >
              {message.content}
            </div>
          ))}
        </div>
        <div className="mt-4 flex gap-3">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Ask your coach..."
            className="h-11 bg-bg-secondary border-none text-accent-white placeholder:text-accent-muted"
          />
          <Button
            type="button"
            className="bg-accent-gold text-bg-primary hover:bg-accent-gold/90"
            onClick={send}
            disabled={isLoading}
          >
            {isLoading ? 'Sending...' : 'Send'}
          </Button>
        </div>
        {error && <p className="mt-3 text-sm text-danger">{error}</p>}
      </div>
    </FeatureShell>
  );
}
