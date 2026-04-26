import { Injectable, Logger } from '@nestjs/common';
import type { AiCompleteRequest, AiCompleteResult, AiService } from '@spearsystems/aegros-core';
import { redactForAi } from './redact';

@Injectable()
export class OpenAiAiService implements AiService {
  private readonly log = new Logger(OpenAiAiService.name);

  async complete(request: AiCompleteRequest): Promise<AiCompleteResult> {
    const key = process.env.OPENAI_API_KEY?.trim();
    if (!key) {
      this.log.warn('OPENAI_API_KEY not set');
      return { text: '', finishReason: 'missing_key' };
    }
    const model = request.model ?? process.env.AEGROS_OPENAI_MODEL?.trim() ?? 'gpt-4o-mini';
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: request.temperature ?? 0.2,
        max_tokens: request.maxOutputTokens ?? 800,
        messages: request.messages.map((m) => ({
          role: m.role,
          content: redactForAi(m.content),
        })),
      }),
      signal: AbortSignal.timeout(120_000),
    });
    if (!res.ok) {
      const t = await res.text();
      this.log.warn(`OpenAI HTTP ${res.status}: ${t}`);
      return { text: '', finishReason: `error:${res.status}` };
    }
    const body = (await res.json()) as {
      choices?: { message?: { content?: string }; finish_reason?: string }[];
    };
    const text = body.choices?.[0]?.message?.content ?? '';
    return { text, finishReason: body.choices?.[0]?.finish_reason };
  }
}
