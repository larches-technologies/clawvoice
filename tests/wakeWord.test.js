const assert = require('node:assert/strict');
const { loadModule, describe } = require('./harness');

const {
  matchWakeWord,
  formatWakeWords,
  getHandsFreeSettings,
  saveWakeWords,
  setWakeEnabled,
  setSpeakerphone,
  isSpeakerphoneEnabled,
  DEFAULT_WAKE_WORDS,
} = loadModule('@/services/WakeWordConfig');

describe('matchWakeWord', (test) => {
  const words = ['hey claw', 'ok claw'];

  test('matches an exact wake phrase with empty remainder', () => {
    assert.deepEqual(matchWakeWord('Hey Claw', words), { matched: true, remainder: '' });
  });

  test('captures the command after the wake phrase', () => {
    assert.deepEqual(matchWakeWord('hey claw what time is it', words), {
      matched: true,
      remainder: 'what time is it',
    });
  });

  test('is punctuation- and case-insensitive', () => {
    assert.deepEqual(matchWakeWord('Hey, Claw! turn on the lights', words), {
      matched: true,
      remainder: 'turn on the lights',
    });
  });

  test('tolerates a stray leading token before the wake word', () => {
    const result = matchWakeWord('uh hey claw play music', words);
    assert.equal(result.matched, true);
    assert.equal(result.remainder, 'play music');
  });

  test('does not match unrelated speech', () => {
    assert.deepEqual(matchWakeWord('please open the door', words), { matched: false, remainder: '' });
  });

  test('does not match the wake word buried deep in the sentence', () => {
    assert.equal(matchWakeWord('I was talking to my friend hey claw', words).matched, false);
  });

  test('returns no match for empty input', () => {
    assert.deepEqual(matchWakeWord('', words), { matched: false, remainder: '' });
  });
});

describe('formatWakeWords', (test) => {
  test('joins with commas', () => {
    assert.equal(formatWakeWords(['hey claw', 'ok claw']), 'hey claw, ok claw');
  });
});

describe('hands-free settings persistence', (test) => {
  test('returns documented defaults when nothing is stored', async () => {
    const settings = await getHandsFreeSettings();
    assert.equal(settings.wakeEnabled, false);
    assert.equal(settings.backgroundListening, false);
    assert.equal(settings.speakerphone, true);
    assert.deepEqual(settings.wakeWords, DEFAULT_WAKE_WORDS);
  });

  test('normalizes and round-trips wake words', async () => {
    await saveWakeWords(['  Hey Claw ', 'OK CLAW', '']);
    const settings = await getHandsFreeSettings();
    assert.deepEqual(settings.wakeWords, ['hey claw', 'ok claw']);
  });

  test('falls back to defaults when saving an empty list', async () => {
    await saveWakeWords([]);
    const settings = await getHandsFreeSettings();
    assert.deepEqual(settings.wakeWords, DEFAULT_WAKE_WORDS);
  });

  test('persists wake-enabled and speakerphone toggles', async () => {
    await setWakeEnabled(true);
    await setSpeakerphone(false);
    const settings = await getHandsFreeSettings();
    assert.equal(settings.wakeEnabled, true);
    assert.equal(settings.speakerphone, false);
    assert.equal(await isSpeakerphoneEnabled(), false);
  });
});
