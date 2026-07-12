import * as SecureStore from '@/services/SafeSecureStore';
import type { CantoneseAiTtsLanguage } from '@/services/CantoneseAISpeechService';

export const VOICE_LANGUAGE_KEY = 'iclawd_voice_language';

export interface VoiceLanguageOption {
  label: string;
  /** BCP-47 locale used for system speech recognition and system TTS. */
  locale: string;
  /** Short code sent to cantonese.ai STT and used as a language hint. */
  languageCode: string;
  /** Language bucket the cantonese.ai TTS endpoint understands. */
  cantoneseAiLanguage: CantoneseAiTtsLanguage;
}

export const VOICE_LANGUAGE_OPTIONS: VoiceLanguageOption[] = [
  { label: 'Cantonese (Hong Kong)', locale: 'zh-HK', languageCode: 'yue', cantoneseAiLanguage: 'cantonese' },
  { label: 'Chinese (Mandarin)', locale: 'zh-CN', languageCode: 'zh', cantoneseAiLanguage: 'mandarin' },
  { label: 'English (US)', locale: 'en-US', languageCode: 'en', cantoneseAiLanguage: 'english' },
];

// Cantonese is the primary experience for this build.
export const DEFAULT_VOICE_LANGUAGE = VOICE_LANGUAGE_OPTIONS[0];

export async function getVoiceLanguage(): Promise<VoiceLanguageOption> {
  const stored = await SecureStore.getItemAsync(VOICE_LANGUAGE_KEY);
  return VOICE_LANGUAGE_OPTIONS.find((option) => option.locale === stored) || DEFAULT_VOICE_LANGUAGE;
}

export async function setVoiceLanguage(locale: string): Promise<VoiceLanguageOption> {
  const next = VOICE_LANGUAGE_OPTIONS.find((option) => option.locale === locale) || DEFAULT_VOICE_LANGUAGE;
  await SecureStore.setItemAsync(VOICE_LANGUAGE_KEY, next.locale);
  return next;
}
