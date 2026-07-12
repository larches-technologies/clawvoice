const assert = require('node:assert/strict');
const { loadModule, describe } = require('./harness');

const {
  getCantoneseAiTtsSettings,
  saveCantoneseAiVoice,
  setCantoneseAiSttEnabled,
  isCantoneseAiSttEnabled,
  saveCantoneseAiKey,
  DEFAULT_CANTONESEAI_VOICE_ID,
  DEFAULT_CANTONESEAI_MODEL,
  CANTONESEAI_TTS_SPEED,
  CANTONESEAI_TTS_PITCH,
  saveCantoneseAiTtsSetting,
} = loadModule('@/services/CantoneseAIConfig');

describe('CantoneseAIConfig TTS settings', (test) => {
  test('returns defaults when nothing is stored', async () => {
    const settings = await getCantoneseAiTtsSettings();
    assert.equal(settings.voiceId, DEFAULT_CANTONESEAI_VOICE_ID);
    assert.equal(settings.modelId, DEFAULT_CANTONESEAI_MODEL);
    assert.equal(settings.speed, 1);
    assert.equal(settings.pitch, 0);
  });

  test('clamps speed and pitch to the documented API bounds', async () => {
    await saveCantoneseAiTtsSetting(CANTONESEAI_TTS_SPEED, '99');
    await saveCantoneseAiTtsSetting(CANTONESEAI_TTS_PITCH, '-99');
    const settings = await getCantoneseAiTtsSettings();
    assert.equal(settings.speed, 3); // max
    assert.equal(settings.pitch, -12); // min
  });

  test('round-trips a selected voice id and name', async () => {
    await saveCantoneseAiVoice('voice-xyz', 'Aria');
    const settings = await getCantoneseAiTtsSettings();
    assert.equal(settings.voiceId, 'voice-xyz');
    assert.equal(settings.voiceName, 'Aria');
  });
});

describe('CantoneseAIConfig STT gating', (test) => {
  test('STT stays disabled without an API key even when toggled on', async () => {
    await setCantoneseAiSttEnabled(true);
    assert.equal(await isCantoneseAiSttEnabled(), false);
  });

  test('STT is enabled only with both the toggle on and a key present', async () => {
    await saveCantoneseAiKey('canto-key');
    await setCantoneseAiSttEnabled(true);
    assert.equal(await isCantoneseAiSttEnabled(), true);

    await setCantoneseAiSttEnabled(false);
    assert.equal(await isCantoneseAiSttEnabled(), false);
  });
});
