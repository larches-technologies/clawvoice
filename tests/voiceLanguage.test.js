const assert = require('node:assert/strict');
const { loadModule, describe } = require('./harness');

const {
  getVoiceLanguage,
  setVoiceLanguage,
  DEFAULT_VOICE_LANGUAGE,
  VOICE_LANGUAGE_OPTIONS,
} = loadModule('@/services/VoiceLanguageConfig');

describe('VoiceLanguageConfig', (test) => {
  test('defaults to Cantonese', async () => {
    assert.equal(DEFAULT_VOICE_LANGUAGE.locale, 'zh-HK');
    assert.equal((await getVoiceLanguage()).locale, 'zh-HK');
  });

  test('every option carries a cantonese.ai language bucket', () => {
    for (const option of VOICE_LANGUAGE_OPTIONS) {
      assert.ok(['cantonese', 'mandarin', 'english'].includes(option.cantoneseAiLanguage));
    }
  });

  test('round-trips a selected locale', async () => {
    const saved = await setVoiceLanguage('en-US');
    assert.equal(saved.cantoneseAiLanguage, 'english');
    assert.equal((await getVoiceLanguage()).locale, 'en-US');
  });

  test('falls back to the default for an unknown locale', async () => {
    const saved = await setVoiceLanguage('xx-XX');
    assert.equal(saved.locale, DEFAULT_VOICE_LANGUAGE.locale);
  });
});
