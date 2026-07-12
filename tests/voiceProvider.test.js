const assert = require('node:assert/strict');
const { loadModule, describe } = require('./harness');

const {
  getVoiceProvider,
  setVoiceProvider,
  getVoiceProviderLabel,
} = loadModule('@/services/VoiceProviderConfig');
const secureStore = loadModule('expo-secure-store');
const { CANTONESEAI_KEY } = loadModule('@/services/CantoneseAIConfig');
const { ELEVENLABS_KEY } = loadModule('@/services/ElevenLabsConfig');

describe('getVoiceProvider default inference', (test) => {
  test('defaults to system when no key or preference exists', async () => {
    assert.equal(await getVoiceProvider(), 'system');
  });

  test('infers cantonese.ai when only a cantonese.ai key exists', async () => {
    await secureStore.setItemAsync(CANTONESEAI_KEY, 'canto-key');
    assert.equal(await getVoiceProvider(), 'cantoneseai');
  });

  test('infers ElevenLabs when only an ElevenLabs key exists', async () => {
    await secureStore.setItemAsync(ELEVENLABS_KEY, 'eleven-key');
    assert.equal(await getVoiceProvider(), 'elevenlabs');
  });

  test('prefers cantonese.ai when both keys exist', async () => {
    await secureStore.setItemAsync(CANTONESEAI_KEY, 'canto-key');
    await secureStore.setItemAsync(ELEVENLABS_KEY, 'eleven-key');
    assert.equal(await getVoiceProvider(), 'cantoneseai');
  });

  test('an explicit choice overrides key inference', async () => {
    await secureStore.setItemAsync(CANTONESEAI_KEY, 'canto-key');
    await setVoiceProvider('system');
    assert.equal(await getVoiceProvider(), 'system');
  });

  test('round-trips an explicit ElevenLabs choice', async () => {
    await setVoiceProvider('elevenlabs');
    assert.equal(await getVoiceProvider(), 'elevenlabs');
  });
});

describe('getVoiceProviderLabel', (test) => {
  test('maps known providers to labels', () => {
    assert.equal(getVoiceProviderLabel('system'), 'System Voice');
    assert.equal(getVoiceProviderLabel('cantoneseai'), 'cantonese.ai');
    assert.equal(getVoiceProviderLabel('elevenlabs'), 'ElevenLabs');
  });
});
