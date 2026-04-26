import { Injectable } from '@nestjs/common';
import type { AiCompleteRequest, AiCompleteResult, AiService } from '@spearsystems/aegros-core';

/** Beta stub — wire Ollama/Gemini/OpenAI in a later phase. */
@Injectable()
export class NoopAiService implements AiService {
  complete(request: AiCompleteRequest): Promise<AiCompleteResult> {
    void request;
    return Promise.resolve({
      text: '',
      finishReason: 'noop',
    });
  }
}
