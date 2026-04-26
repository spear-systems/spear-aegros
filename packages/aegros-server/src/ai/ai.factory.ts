import type { Provider } from '@nestjs/common';
import { GeminiAiService } from './gemini-ai.service';
import { NoopAiService } from './noop-ai.service';
import { OllamaAiService } from './ollama-ai.service';
import { OpenAiAiService } from './openai-ai.service';

export const AI_SERVICE: Provider = {
  provide: 'AI_SERVICE',
  useFactory: (): GeminiAiService | NoopAiService | OllamaAiService | OpenAiAiService => {
    const p = process.env.AEGROS_AI_PROVIDER?.trim().toLowerCase();
    if (p === 'ollama') return new OllamaAiService();
    if (p === 'openai') return new OpenAiAiService();
    if (p === 'gemini') return new GeminiAiService();
    return new NoopAiService();
  },
};
