/** Best-effort redaction before sending content to external LLM APIs. */
export function redactForAi(text: string): string {
  return text
    .replace(/\bsk-[a-zA-Z0-9]{20,}\b/g, '[REDACTED_OPENAI_KEY]')
    .replace(/\bxox[baprs]-[a-zA-Z0-9-]+\b/g, '[REDACTED_SLACK_TOKEN]')
    .replace(/\bAIza[0-9A-Za-z_-]{20,}\b/g, '[REDACTED_GEMINI_KEY]')
    .replace(/\bBearer\s+[a-zA-Z0-9._-]+\b/gi, 'Bearer [REDACTED]');
}
