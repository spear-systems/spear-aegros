import { Injectable, Logger } from '@nestjs/common';
import type { AiCompleteRequest, AiCompleteResult, AiService } from '@spearsystems/aegros-core';
import { redactForAi } from './redact';

@Injectable()
export class OllamaAiService implements AiService {
  private readonly log = new Logger(OllamaAiService.name);

  async complete(request: AiCompleteRequest): Promise<AiCompleteResult> {
    const base = process.env.AEGROS_OLLAMA_URL?.trim() || 'http://127.0.0.1:11434';
    const model = request.model ?? process.env.AEGROS_OLLAMA_MODEL?.trim() ?? 'qwen2.5:3b';
    const url = `${base.replace(/\/$/, '')}/api/chat`;
    const messages = request.messages.map((m) => ({
      role: m.role,
      content: redactForAi(m.content),
    }));
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        stream: false,
        options: { temperature: request.temperature ?? 0.2 },
        messages,
      }),
      signal: AbortSignal.timeout(120_000),
    });
    if (!res.ok) {
      const t = await res.text();
      this.log.warn(`Ollama HTTP ${res.status}: ${t}`);
      return { text: '', finishReason: `error:${res.status}` };
    }
    const body = (await res.json()) as { message?: { content?: string } };
    const text = body.message?.content ?? '';
    return { text, finishReason: 'stop' };
  }
}
