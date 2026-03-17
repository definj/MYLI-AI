const API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-20250514';

type AnthropicMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export async function callAnthropicText(messages: AnthropicMessage[], system?: string) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { ok: false as const, error: 'Missing ANTHROPIC_API_KEY' };
  }

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 900,
      system,
      messages: messages.map((m) => ({ role: m.role, content: [{ type: 'text', text: m.content }] })),
    }),
  });

  if (!response.ok) {
    return { ok: false as const, error: `Anthropic request failed: ${response.status}` };
  }

  const body = (await response.json()) as {
    content?: Array<{ type: string; text?: string }>;
  };
  const text = body.content?.find((item) => item.type === 'text')?.text;
  if (!text) {
    return { ok: false as const, error: 'Anthropic returned empty content' };
  }

  return { ok: true as const, text };
}

function extractJsonCandidate(raw: string) {
  const fenced = raw.match(/```json\s*([\s\S]*?)\s*```/i);
  if (fenced?.[1]) return fenced[1].trim();

  const firstBrace = raw.indexOf('{');
  const lastBrace = raw.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return raw.slice(firstBrace, lastBrace + 1).trim();
  }

  return raw.trim();
}

export function safeJsonParse<T>(raw: string): T | null {
  const candidate = extractJsonCandidate(raw);
  try {
    return JSON.parse(candidate) as T;
  } catch {
    return null;
  }
}

export async function callAnthropicVisionJson(
  fileBase64: string,
  mediaType: string,
  prompt: string,
  system?: string
) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { ok: false as const, error: 'Missing ANTHROPIC_API_KEY' };
  }

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1200,
      system,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: fileBase64 } },
            { type: 'text', text: prompt },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    return { ok: false as const, error: `Anthropic vision request failed: ${response.status}` };
  }

  const body = (await response.json()) as {
    content?: Array<{ type: string; text?: string }>;
  };

  const text = body.content?.find((item) => item.type === 'text')?.text;
  if (!text) {
    return { ok: false as const, error: 'Anthropic vision returned empty content' };
  }

  return { ok: true as const, text };
}
