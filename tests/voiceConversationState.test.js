const assert = require('node:assert/strict');
const { loadModule, describe } = require('./harness');

const {
  initialVoiceConversationState,
  voiceConversationReducer,
  getVoiceOrbState,
} = loadModule('@/hooks/voiceConversationState');

function reduce(...actions) {
  return actions.reduce(voiceConversationReducer, initialVoiceConversationState);
}

describe('voiceConversationState reducer', (test) => {
  test('starts paused with no session', () => {
    assert.equal(initialVoiceConversationState.status, 'paused');
    assert.equal(initialVoiceConversationState.sessionEnabled, false);
  });

  test('RESUME_MIC → MIC_READY yields a listening session', () => {
    assert.deepEqual(reduce({ type: 'RESUME_MIC' }, { type: 'MIC_READY' }), {
      status: 'listening',
      transcript: '',
      error: null,
      foreground: true,
      sessionEnabled: true,
    });
  });

  test('sending an utterance moves through finalizing to awaitingAgent', () => {
    assert.equal(
      reduce(
        { type: 'RESUME_MIC' },
        { type: 'MIC_READY' },
        { type: 'TRANSCRIPT_PARTIAL', text: 'hello' },
        { type: 'SEND_UTTERANCE' },
        { type: 'AGENT_STARTED' },
      ).status,
      'awaitingAgent',
    );
  });

  test('SEND_UTTERANCE clears the transcript', () => {
    const state = reduce(
      { type: 'RESUME_MIC' },
      { type: 'MIC_READY' },
      { type: 'TRANSCRIPT_PARTIAL', text: 'hello' },
      { type: 'SEND_UTTERANCE' },
    );
    assert.equal(state.status, 'finalizing');
    assert.equal(state.transcript, '');
  });

  test('AGENT_FINAL recovers while foregrounded and session enabled', () => {
    assert.equal(reduce({ type: 'RESUME_MIC' }, { type: 'AGENT_FINAL' }).status, 'recovering');
  });

  test('AGENT_FINAL after backgrounding stays paused', () => {
    assert.equal(
      reduce({ type: 'RESUME_MIC' }, { type: 'BACKGROUND' }, { type: 'AGENT_FINAL' }).status,
      'paused',
    );
  });

  test('TTS lifecycle returns to recovering', () => {
    assert.equal(
      reduce({ type: 'RESUME_MIC' }, { type: 'TTS_STARTED' }, { type: 'TTS_DONE' }).status,
      'recovering',
    );
  });

  test('pausing during speech parks in paused', () => {
    assert.equal(
      reduce({ type: 'RESUME_MIC' }, { type: 'TTS_STARTED' }, { type: 'PAUSE_MIC' }).status,
      'paused',
    );
  });

  test('AUDIO_ERROR disables the session', () => {
    const state = reduce({ type: 'RESUME_MIC' }, { type: 'AUDIO_ERROR', error: 'mic failed' });
    assert.equal(state.sessionEnabled, false);
    assert.equal(state.status, 'error');
    assert.equal(state.error, 'mic failed');
  });

  test('BACKGROUND clears foreground, session and transcript', () => {
    const state = reduce(
      { type: 'RESUME_MIC' },
      { type: 'MIC_READY' },
      { type: 'TRANSCRIPT_PARTIAL', text: 'hi' },
      { type: 'BACKGROUND' },
    );
    assert.equal(state.foreground, false);
    assert.equal(state.sessionEnabled, false);
    assert.equal(state.transcript, '');
  });
});

describe('getVoiceOrbState', (test) => {
  test('agent phases map to idle orb', () => {
    assert.equal(getVoiceOrbState('awaitingAgent', 'idle'), 'idle');
    assert.equal(getVoiceOrbState('agentStreaming', 'idle'), 'idle');
  });

  test('thinking/preparing voice states map to thinking orb', () => {
    assert.equal(getVoiceOrbState('listening', 'thinking'), 'thinking');
    assert.equal(getVoiceOrbState('recovering', 'preparingAudio'), 'thinking');
  });

  test('listening maps to listening; speaking wins', () => {
    assert.equal(getVoiceOrbState('listening', 'idle'), 'listening');
    assert.equal(getVoiceOrbState('paused', 'speaking'), 'speaking');
  });
});
