import { Injectable, Logger } from '@nestjs/common';
import type { AiCompleteRequest, AiCompleteResult, AiService } from '@spearsystems/aegros-core';
import { redactForAi } from './redact';

@Injectable()
export class GeminiAiService implements AiService {
  private readonly log = new Logger(GeminiAiService.name);

  async complete(request: AiCompleteRequest): Promise<AiCompleteResult> {
    const key = process.env.GEMINI_API_KEY?.trim();
    if (!key) {
      this.log.warn('GEMINI_API_KEY not set');
      return { text: '', finishReason: 'missing_key' };
    }
    const model = request.model ?? process.env.AEGROS_GEMINI_MODEL?.trim() ?? 'gemini-2.0-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;
    const parts = request.messages.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: `${m.role}: ${redactForAi(m.content)}` }],
    }));
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: parts }),
      signal: AbortSignal.timeout(120_000),
    });
    if (!res.ok) {
      const t = await res.text();
      this.log.warn(`Gemini HTTP ${res.status}: ${t}`);
      return { text: '', finishReason: `error:${res.status}` };
    }
    const body = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text = body.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
    return { text, finishReason: 'stop' };
  }
}
