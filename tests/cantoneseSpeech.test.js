const assert = require('node:assert/strict');
const { loadModule, describe } = require('./harness');

const {
  buildCantoneseTtsBody,
  fetchCantoneseVoices,
  CURATED_CANTONESE_VOICES,
} = loadModule('@/services/CantoneseAISpeechService');

describe('buildCantoneseTtsBody', (test) => {
  const base = {
    text: '你好',
    apiKey: 'secret',
    voiceId: 'voice-1',
    modelId: 'v6',
    speed: 1.1,
    pitch: -2,
    language: 'cantonese',
  };

  test('maps options to the cantonese.ai request shape', () => {
    const body = buildCantoneseTtsBody(base);
    assert.equal(body.api_key, 'secret');
    assert.equal(body.text, '你好');
    assert.equal(body.voice_id, 'voice-1');
    assert.equal(body.model_id, 'v6');
    assert.equal(body.speed, 1.1);
    assert.equal(body.pitch, -2);
    assert.equal(body.language, 'cantonese');
    assert.equal(body.should_return_timestamp, false);
  });

  test('defaults the output extension to mp3', () => {
    assert.equal(buildCantoneseTtsBody(base).output_extension, 'mp3');
  });

  test('honours an explicit output extension', () => {
    assert.equal(buildCantoneseTtsBody({ ...base, outputExtension: 'wav' }).output_extension, 'wav');
  });
});

describe('fetchCantoneseVoices', (test) => {
  const originalFetch = global.fetch;

  function restore() {
    global.fetch = originalFetch;
  }

  test('parses a voices array from the API', async () => {
    global.fetch = async () => ({
      ok: true,
      text: async () => JSON.stringify({
        voices: [
          { voice_id: 'abc', name: 'Aria', language: 'cantonese', gender: 'female' },
          { id: 'def', voice_name: 'Bill' },
        ],
      }),
    });
    try {
      const voices = await fetchCantoneseVoices('key');
      assert.equal(voices.length, 2);
      assert.deepEqual(voices[0], {
        id: 'abc',
        name: 'Aria',
        language: 'cantonese',
        gender: 'female',
        description: undefined,
      });
      assert.equal(voices[1].id, 'def');
      assert.equal(voices[1].name, 'Bill');
    } finally {
      restore();
    }
  });

  test('falls back to the curated list when the request fails', async () => {
    global.fetch = async () => { throw new Error('network down'); };
    try {
      const voices = await fetchCantoneseVoices('key');
      assert.deepEqual(voices, CURATED_CANTONESE_VOICES);
    } finally {
      restore();
    }
  });

  test('falls back when the response has no usable voices', async () => {
    global.fetch = async () => ({ ok: true, text: async () => JSON.stringify({ voices: [] }) });
    try {
      const voices = await fetchCantoneseVoices('key');
      assert.deepEqual(voices, CURATED_CANTONESE_VOICES);
    } finally {
      restore();
    }
  });
});
