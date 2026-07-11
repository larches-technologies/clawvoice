import type { CantoneseAiModel } from '@/services/CantoneseAIConfig';

// TTS: returns audio bytes directly (or, with should_return_timestamp, JSON with a
// base64 `file`). We always request the raw audio stream.
export const CANTONESEAI_TTS_URL = 'https://cantonese.ai/api/tts';

// STT: OpenAI-compatible transcription endpoint. Authenticated with a Bearer token.
export const CANTONESEAI_STT_URL = 'https://stt-api.cantonese.ai/v1/audio/transcriptions';

// Best-effort endpoints for listing the voice library. cantonese.ai does not publish
// a stable REST contract for this, so we try a couple of plausible shapes and fall
// back to the curated list below when none respond.
const CANTONESEAI_VOICE_ENDPOINTS = [
  'https://cantonese.ai/api/voices',
  'https://cantonese.ai/api/tts/voices',
];

export type CantoneseAiTtsLanguage = 'cantonese' | 'english' | 'mandarin';

export interface CantoneseVoice {
  id: string;
  name: string;
  language?: string;
  gender?: string;
  description?: string;
}

/**
 * Curated fallback voices. cantonese.ai exposes a much larger library at
 * https://cantonese.ai/voices; these are safe defaults shown when the live voice
 * list cannot be fetched. Users can always paste any voice_id manually.
 */
export const CURATED_CANTONESE_VOICES: CantoneseVoice[] = [
  {
    id: '2725cf0f-efe2-4132-9e06-62ad84b2973d',
    name: 'Default (Cantonese)',
    language: 'cantonese',
    description: 'Balanced, natural Hong Kong Cantonese voice.',
  },
];

export class CantoneseAiSpeechError extends Error {
  status?: number;
  authFailure: boolean;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'CantoneseAiSpeechError';
    this.status = status;
    this.authFailure = status === 401 || status === 403;
  }
}

function parseJsonMaybe(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function getErrorMessage(body: unknown, fallback: string): string {
  if (!body || typeof body !== 'object') return fallback;
  const record = body as Record<string, unknown>;
  const detail = record.detail;
  if (typeof detail === 'string') return detail;
  if (detail && typeof detail === 'object' && 'message' in detail) {
    return String((detail as { message?: unknown }).message ?? fallback);
  }
  if (typeof record.message === 'string') return record.message;
  if (typeof record.error === 'string') return record.error;
  return fallback;
}

/**
 * Transcribe an audio file with cantonese.ai's OpenAI-compatible STT endpoint.
 */
export async function transcribeWithCantoneseAI(
  audioUri: string,
  apiKey: string,
  languageCode?: string,
): Promise<string> {
  const body = new FormData();
  body.append('file', {
    uri: audioUri,
    name: 'speech.m4a',
    type: 'audio/m4a',
  } as unknown as Blob);
  if (languageCode) {
    body.append('language', languageCode);
  }

  const response = await fetch(CANTONESEAI_STT_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body,
  });

  const responseText = await response.text();
  const parsed = parseJsonMaybe(responseText);

  if (!response.ok) {
    const message = getErrorMessage(parsed, `cantonese.ai STT failed with HTTP ${response.status}`);
    throw new CantoneseAiSpeechError(message, response.status);
  }

  if (!parsed || typeof parsed !== 'object') {
    // Some transcription endpoints return the plain text body.
    const plain = responseText.trim();
    if (plain) return plain;
    throw new CantoneseAiSpeechError('cantonese.ai STT returned an empty response.');
  }

  const payload = parsed as Record<string, unknown>;
  const text = payload.text ?? payload.transcript ?? payload.result;
  if (typeof text !== 'string') {
    throw new CantoneseAiSpeechError('cantonese.ai STT response did not include text.');
  }

  return text.trim();
}

export interface CantoneseTtsRequestOptions {
  text: string;
  apiKey: string;
  voiceId: string;
  modelId: CantoneseAiModel;
  speed: number;
  pitch: number;
  language: CantoneseAiTtsLanguage;
  outputExtension?: 'mp3' | 'wav';
}

/**
 * Build the JSON request body for the cantonese.ai TTS endpoint. The actual binary
 * request is issued by VoiceEngine (XHR with an arraybuffer response), which is the
 * most reliable way to receive raw audio bytes under Hermes.
 */
export function buildCantoneseTtsBody(options: CantoneseTtsRequestOptions): Record<string, unknown> {
  return {
    api_key: options.apiKey,
    text: options.text,
    voice_id: options.voiceId,
    model_id: options.modelId,
    speed: options.speed,
    pitch: options.pitch,
    language: options.language,
    output_extension: options.outputExtension ?? 'mp3',
    should_return_timestamp: false,
  };
}

function normalizeVoice(entry: unknown): CantoneseVoice | null {
  if (!entry || typeof entry !== 'object') return null;
  const record = entry as Record<string, unknown>;
  const id = record.voice_id ?? record.id ?? record.voiceId;
  if (typeof id !== 'string' || !id.trim()) return null;

  const name = record.name ?? record.voice_name ?? record.title ?? id;
  return {
    id: id.trim(),
    name: typeof name === 'string' && name.trim() ? name.trim() : id.trim(),
    language: typeof record.language === 'string' ? record.language : undefined,
    gender: typeof record.gender === 'string' ? record.gender : undefined,
    description: typeof record.description === 'string' ? record.description : undefined,
  };
}

function extractVoiceArray(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>;
    for (const key of ['voices', 'data', 'results', 'items']) {
      if (Array.isArray(record[key])) return record[key] as unknown[];
    }
  }
  return [];
}

/**
 * Fetch the available voice library from cantonese.ai. This is best-effort: the
 * service does not document a stable list endpoint, so on any failure we return the
 * curated fallback list. Callers should treat the result as advisory and still allow
 * manual voice_id entry.
 */
export async function fetchCantoneseVoices(apiKey: string): Promise<CantoneseVoice[]> {
  for (const endpoint of CANTONESEAI_VOICE_ENDPOINTS) {
    try {
      const url = `${endpoint}?api_key=${encodeURIComponent(apiKey)}`;
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'x-api-key': apiKey,
          Accept: 'application/json',
        },
      });

      if (!response.ok) continue;

      const parsed = parseJsonMaybe(await response.text());
      const voices = extractVoiceArray(parsed)
        .map(normalizeVoice)
        .filter((voice): voice is CantoneseVoice => Boolean(voice));

      if (voices.length > 0) {
        return voices;
      }
    } catch {
      // Try the next endpoint, then the curated fallback.
    }
  }

  return CURATED_CANTONESE_VOICES;
}
