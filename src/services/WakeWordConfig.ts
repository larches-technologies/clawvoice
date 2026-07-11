import * as SecureStore from '@/services/SafeSecureStore';

export const WAKE_WORD_ENABLED_KEY = 'iclawd_wake_enabled';
export const WAKE_WORDS_KEY = 'iclawd_wake_words';
export const BACKGROUND_LISTENING_KEY = 'iclawd_background_listening';
export const SPEAKERPHONE_KEY = 'iclawd_speakerphone';

export const DEFAULT_WAKE_WORDS = ['hey claw', 'hey clawd', 'ok claw'];

export interface HandsFreeSettings {
  wakeEnabled: boolean;
  wakeWords: string[];
  backgroundListening: boolean;
  speakerphone: boolean;
}

export const DEFAULT_HANDS_FREE_SETTINGS: HandsFreeSettings = {
  wakeEnabled: false,
  wakeWords: DEFAULT_WAKE_WORDS,
  backgroundListening: false,
  speakerphone: true,
};

function parseWakeWords(raw: string | null): string[] {
  if (!raw) return DEFAULT_WAKE_WORDS;
  const words = raw
    .split(/[,\n]/)
    .map((word) => word.trim().toLocaleLowerCase())
    .filter(Boolean);
  return words.length > 0 ? words : DEFAULT_WAKE_WORDS;
}

export async function getHandsFreeSettings(): Promise<HandsFreeSettings> {
  const [wakeEnabled, wakeWords, backgroundListening, speakerphone] = await Promise.all([
    SecureStore.getItemAsync(WAKE_WORD_ENABLED_KEY),
    SecureStore.getItemAsync(WAKE_WORDS_KEY),
    SecureStore.getItemAsync(BACKGROUND_LISTENING_KEY),
    SecureStore.getItemAsync(SPEAKERPHONE_KEY),
  ]);

  return {
    wakeEnabled: wakeEnabled === 'true',
    wakeWords: parseWakeWords(wakeWords),
    backgroundListening: backgroundListening === 'true',
    // Speakerphone defaults on (hands-free is the whole point).
    speakerphone: speakerphone !== 'false',
  };
}

export async function isSpeakerphoneEnabled(): Promise<boolean> {
  const stored = await SecureStore.getItemAsync(SPEAKERPHONE_KEY);
  return stored !== 'false';
}

export async function setWakeEnabled(enabled: boolean): Promise<void> {
  await SecureStore.setItemAsync(WAKE_WORD_ENABLED_KEY, String(enabled));
}

export async function setBackgroundListening(enabled: boolean): Promise<void> {
  await SecureStore.setItemAsync(BACKGROUND_LISTENING_KEY, String(enabled));
}

export async function setSpeakerphone(enabled: boolean): Promise<void> {
  await SecureStore.setItemAsync(SPEAKERPHONE_KEY, String(enabled));
}

export async function saveWakeWords(words: string[]): Promise<void> {
  const normalized = words
    .map((word) => word.trim().toLocaleLowerCase())
    .filter(Boolean);
  if (normalized.length > 0) {
    await SecureStore.setItemAsync(WAKE_WORDS_KEY, normalized.join(', '));
  } else {
    await SecureStore.deleteItemAsync(WAKE_WORDS_KEY);
  }
}

export function formatWakeWords(words: string[]): string {
  return words.join(', ');
}

export interface WakeMatch {
  matched: boolean;
  /** The utterance with the wake phrase stripped from the front (if any). */
  remainder: string;
}

function stripPunctuation(text: string): string {
  return text
    .toLocaleLowerCase()
    .replace(/[.,!?;:'"“”‘’。，！？、]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Software wake-word detection. Returns whether the transcript begins with (or, for
 * short utterances, simply contains) one of the configured wake phrases, along with
 * whatever the user said after the wake phrase.
 */
export function matchWakeWord(transcript: string, wakeWords: string[]): WakeMatch {
  const normalized = stripPunctuation(transcript);
  if (!normalized) return { matched: false, remainder: '' };

  for (const rawPhrase of wakeWords) {
    const phrase = stripPunctuation(rawPhrase);
    if (!phrase) continue;

    if (normalized === phrase) {
      return { matched: true, remainder: '' };
    }
    if (normalized.startsWith(`${phrase} `)) {
      return { matched: true, remainder: normalized.slice(phrase.length).trim() };
    }
    // Recognizers sometimes prepend a stray token before the wake word; accept a
    // near-start match too.
    const index = normalized.indexOf(phrase);
    if (index >= 0 && index <= 3) {
      return { matched: true, remainder: normalized.slice(index + phrase.length).trim() };
    }
  }

  return { matched: false, remainder: '' };
}
