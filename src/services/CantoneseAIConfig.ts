import * as SecureStore from '@/services/SafeSecureStore';

// Storage keys. Prefixed with the historical `iclawd_` namespace for continuity
// with the rest of the app's SecureStore keys.
export const CANTONESEAI_KEY = 'iclawd_cantoneseai_key';
export const CANTONESEAI_TTS_VOICE_ID = 'iclawd_cantoneseai_voice_id';
export const CANTONESEAI_TTS_VOICE_NAME = 'iclawd_cantoneseai_voice_name';
export const CANTONESEAI_TTS_MODEL = 'iclawd_cantoneseai_model';
export const CANTONESEAI_TTS_SPEED = 'iclawd_cantoneseai_tts_speed';
export const CANTONESEAI_TTS_PITCH = 'iclawd_cantoneseai_tts_pitch';
export const CANTONESEAI_STT_ENABLED = 'iclawd_cantoneseai_stt_enabled';

// A widely available default Cantonese voice from the cantonese.ai library. Users
// can pick another voice from the in-app voice browser (or paste a voice_id).
export const DEFAULT_CANTONESEAI_VOICE_ID = '2725cf0f-efe2-4132-9e06-62ad84b2973d';
export const DEFAULT_CANTONESEAI_VOICE_NAME = 'Default';
export const DEFAULT_CANTONESEAI_MODEL = 'v6';
export const DEFAULT_CANTONESEAI_TTS_SPEED = 1;
export const DEFAULT_CANTONESEAI_TTS_PITCH = 0;

// cantonese.ai bounds (from the TTS API docs).
export const CANTONESEAI_SPEED_MIN = 0.5;
export const CANTONESEAI_SPEED_MAX = 3;
export const CANTONESEAI_PITCH_MIN = -12;
export const CANTONESEAI_PITCH_MAX = 12;

export type CantoneseAiModel = 'v5' | 'v6';

export interface CantoneseAiTtsSettings {
  voiceId: string;
  voiceName: string;
  modelId: CantoneseAiModel;
  speed: number;
  pitch: number;
}

function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
}

async function getNumber(key: string, fallback: number, min: number, max: number): Promise<number> {
  const raw = await SecureStore.getItemAsync(key);
  if (!raw) return fallback;
  return clamp(Number(raw), min, max);
}

function normalizeModel(raw: string | null): CantoneseAiModel {
  return raw === 'v5' ? 'v5' : DEFAULT_CANTONESEAI_MODEL;
}

export async function getCantoneseAiKey(): Promise<string | null> {
  return SecureStore.getItemAsync(CANTONESEAI_KEY);
}

export async function saveCantoneseAiKey(key: string): Promise<void> {
  const trimmed = key.trim();
  if (trimmed) {
    await SecureStore.setItemAsync(CANTONESEAI_KEY, trimmed);
  } else {
    await SecureStore.deleteItemAsync(CANTONESEAI_KEY);
  }
}

export async function getCantoneseAiTtsSettings(): Promise<CantoneseAiTtsSettings> {
  const [voiceId, voiceName, model, speed, pitch] = await Promise.all([
    SecureStore.getItemAsync(CANTONESEAI_TTS_VOICE_ID),
    SecureStore.getItemAsync(CANTONESEAI_TTS_VOICE_NAME),
    SecureStore.getItemAsync(CANTONESEAI_TTS_MODEL),
    getNumber(CANTONESEAI_TTS_SPEED, DEFAULT_CANTONESEAI_TTS_SPEED, CANTONESEAI_SPEED_MIN, CANTONESEAI_SPEED_MAX),
    getNumber(CANTONESEAI_TTS_PITCH, DEFAULT_CANTONESEAI_TTS_PITCH, CANTONESEAI_PITCH_MIN, CANTONESEAI_PITCH_MAX),
  ]);

  return {
    voiceId: voiceId?.trim() || DEFAULT_CANTONESEAI_VOICE_ID,
    voiceName: voiceName?.trim() || DEFAULT_CANTONESEAI_VOICE_NAME,
    modelId: normalizeModel(model),
    speed,
    pitch,
  };
}

export async function isCantoneseAiSttEnabled(): Promise<boolean> {
  const [enabled, apiKey] = await Promise.all([
    SecureStore.getItemAsync(CANTONESEAI_STT_ENABLED),
    SecureStore.getItemAsync(CANTONESEAI_KEY),
  ]);
  return enabled === 'true' && Boolean(apiKey?.trim());
}

export async function setCantoneseAiSttEnabled(enabled: boolean): Promise<void> {
  await SecureStore.setItemAsync(CANTONESEAI_STT_ENABLED, String(enabled));
}

export async function saveCantoneseAiTtsSetting(key: string, value: string): Promise<void> {
  const trimmed = value.trim();
  if (trimmed) {
    await SecureStore.setItemAsync(key, trimmed);
  } else {
    await SecureStore.deleteItemAsync(key);
  }
}

/**
 * Persist the selected voice (id + display name) together so settings can show a
 * friendly label without another network round-trip.
 */
export async function saveCantoneseAiVoice(voiceId: string, voiceName: string): Promise<void> {
  await saveCantoneseAiTtsSetting(CANTONESEAI_TTS_VOICE_ID, voiceId);
  await saveCantoneseAiTtsSetting(CANTONESEAI_TTS_VOICE_NAME, voiceName);
}
