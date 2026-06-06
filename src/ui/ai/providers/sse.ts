export type SseChunkHandler = (text: string) => void;

export interface ParsedSseEvent {
  data: string;
}

export function parseSseEvents(buffer: string): { events: ParsedSseEvent[]; rest: string } {
  const normalized = buffer.replace(/\r\n/g, '\n');
  const parts = normalized.split('\n\n');
  const rest = parts.pop() ?? '';
  const events = parts
    .map((part) => {
      const data = part
        .split('\n')
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice(5).trimStart())
        .join('\n');
      return data ? { data } : null;
    })
    .filter((event): event is ParsedSseEvent => event !== null);

  return { events, rest };
}

export function extractOpenAiDelta(data: string): string {
  if (data === '[DONE]') return '';
  const parsed = JSON.parse(data);
  return parsed.choices?.[0]?.delta?.content ?? '';
}

export async function readOpenAiSseStream(
  body: ReadableStream<Uint8Array>,
  onChunk: SseChunkHandler,
): Promise<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let fullText = '';
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const parsed = parseSseEvents(buffer);
      buffer = parsed.rest;

      for (const event of parsed.events) {
        try {
          const chunk = extractOpenAiDelta(event.data);
          if (chunk) {
            fullText += chunk;
            onChunk(chunk);
          }
        } catch {
          // Providers sometimes emit keep-alive or non-JSON diagnostic lines.
        }
      }
    }

    if (buffer.trim()) {
      const parsed = parseSseEvents(`${buffer}\n\n`);
      for (const event of parsed.events) {
        try {
          const chunk = extractOpenAiDelta(event.data);
          if (chunk) {
            fullText += chunk;
            onChunk(chunk);
          }
        } catch {
          // Ignore trailing malformed lines.
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  return fullText;
}
