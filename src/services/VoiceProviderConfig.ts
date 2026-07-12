import * as SecureStore from '@/services/SafeSecureStore';
import { ELEVENLABS_KEY } from '@/services/ElevenLabsConfig';
import { CANTONESEAI_KEY } from '@/services/CantoneseAIConfig';

export const VOICE_PROVIDER_KEY = 'iclawd_voice_provider';

export type VoiceProvider = 'system' | 'elevenlabs' | 'cantoneseai';

export interface VoiceProviderOption {
  value: VoiceProvider;
  label: string;
}

export const VOICE_PROVIDER_OPTIONS: VoiceProviderOption[] = [
  { value: 'system', label: 'System Voice' },
  { value: 'cantoneseai', label: 'cantonese.ai' },
  { value: 'elevenlabs', label: 'ElevenLabs' },
];

function normalizeProvider(raw: string | null): VoiceProvider | null {
  if (raw === 'system' || raw === 'elevenlabs' || raw === 'cantoneseai') return raw;
  return null;
}

/**
 * The active voice provider. If the user has never chosen one, infer a sensible
 * default from whichever API key already exists so upgrades keep working, falling
 * back to the system voice.
 */
export async function getVoiceProvider(): Promise<VoiceProvider> {
  const stored = normalizeProvider(await SecureStore.getItemAsync(VOICE_PROVIDER_KEY));
  if (stored) return stored;

  const [cantoneseKey, elevenKey] = await Promise.all([
    SecureStore.getItemAsync(CANTONESEAI_KEY),
    SecureStore.getItemAsync(ELEVENLABS_KEY),
  ]);
  if (cantoneseKey?.trim()) return 'cantoneseai';
  if (elevenKey?.trim()) return 'elevenlabs';
  return 'system';
}

export async function setVoiceProvider(provider: VoiceProvider): Promise<void> {
  await SecureStore.setItemAsync(VOICE_PROVIDER_KEY, provider);
}

export function getVoiceProviderLabel(provider: VoiceProvider): string {
  return VOICE_PROVIDER_OPTIONS.find((option) => option.value === provider)?.label ?? provider;
}
