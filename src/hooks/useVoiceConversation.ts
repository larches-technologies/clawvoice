import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useVoice } from '@/hooks/useVoice';
import type { ConnectionState } from '@/types/gateway';
import { categorizeError, track, trackOnce } from '@/services/AnalyticsService';
import {
  getVoiceOrbState,
  initialVoiceConversationState,
  voiceConversationReducer,
} from '@/hooks/voiceConversationState';
import {
  DEFAULT_HANDS_FREE_SETTINGS,
  getHandsFreeSettings,
  matchWakeWord,
  type HandsFreeSettings,
} from '@/services/WakeWordConfig';

const QUICK_MANUAL_STOP_MS = 700;
// After hearing a bare wake word ("Hey Claw"), keep the mic hot for a short window
// so the user's follow-up command is treated as the request.
const WAKE_FOLLOWUP_MS = 8000;

interface Params {
  connectionState: ConnectionState;
  awaitingResponse: boolean;
  streamingText: string;
  latestAssistantId: string | null;
  sendMessage: (text: string) => Promise<void>;
  reconnect: () => Promise<void>;
}

export function useVoiceConversation({
  connectionState,
  awaitingResponse,
  streamingText,
  latestAssistantId,
  sendMessage,
  reconnect,
}: Params) {
  const [state, dispatch] = useReducer(voiceConversationReducer, initialVoiceConversationState);
  const {
    voiceState,
    inputProvider,
    transcript,
    lastError,
    startListening,
    stopListening,
    stopSpeaking,
    suspend,
    setOnFinalTranscript,
  } = useVoice();

  const stateRef = useRef(state);
  const latestAssistantIdRef = useRef(latestAssistantId);
  const inFlightUtteranceRef = useRef<string | null>(null);
  const lastSentUtteranceRef = useRef<{ text: string; at: number } | null>(null);
  const listeningStartedAtRef = useRef<number | null>(null);
  const finalTranscriptReceivedRef = useRef(false);
  const handsFreeRef = useRef<HandsFreeSettings>(DEFAULT_HANDS_FREE_SETTINGS);
  const awakeUntilRef = useRef(0);
  const wasActiveSessionRef = useRef(false);
  const [wakeEnabled, setWakeEnabled] = useState(false);
  stateRef.current = state;

  const refreshHandsFree = useCallback(() => {
    getHandsFreeSettings()
      .then((settings) => {
        handsFreeRef.current = settings;
        setWakeEnabled(settings.wakeEnabled);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    refreshHandsFree();
  }, [refreshHandsFree]);

  const pulse = useCallback((style: Haptics.ImpactFeedbackStyle) => {
    Haptics.impactAsync(style);
    setTimeout(() => {
      Haptics.selectionAsync();
    }, 70);
  }, []);

  useEffect(() => {
    dispatch({ type: AppState.currentState === 'active' ? 'FOREGROUND' : 'BACKGROUND' });
  }, []);

  useEffect(() => {
    dispatch({ type: 'TRANSCRIPT_PARTIAL', text: transcript });
  }, [transcript]);

  useEffect(() => {
    if (lastError) {
      const errorCategory = categorizeError(lastError);
      track(errorCategory === 'stt_no_match' ? 'voice_no_speech' : 'voice_stt_failed', {
        provider: inputProvider,
        error_category: errorCategory,
      });
      dispatch(
        errorCategory === 'stt_no_match'
          ? { type: 'AUDIO_NOTICE', message: lastError }
          : { type: 'AUDIO_ERROR', error: lastError },
      );
    }
  }, [inputProvider, lastError]);

  useEffect(() => {
    setOnFinalTranscript(async (text) => {
      let utterance = text.trim();
      if (!utterance) return;
      finalTranscriptReceivedRef.current = true;

      const now = Date.now();
      const handsFree = handsFreeRef.current;

      // Software wake word: while armed, ignore anything that isn't preceded by a
      // wake phrase. Once woken, the follow-up (or the words after the phrase) is the
      // command.
      if (handsFree.wakeEnabled) {
        const stillAwake = awakeUntilRef.current > now;
        if (!stillAwake) {
          const { matched, remainder } = matchWakeWord(utterance, handsFree.wakeWords);
          if (!matched) {
            // Not addressed to us — stay armed and keep listening.
            dispatch({ type: 'RESUME_MIC' });
            return;
          }

          track('voice_wake_detected', { provider: inputProvider });
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

          if (!remainder) {
            // Bare wake word — open a short window for the command and keep listening.
            awakeUntilRef.current = now + WAKE_FOLLOWUP_MS;
            dispatch({ type: 'RESUME_MIC' });
            return;
          }
          utterance = remainder;
        }
        // Consume the awake window once we actually send something.
        awakeUntilRef.current = 0;
      }

      const normalized = utterance.toLocaleLowerCase();
      const lastSent = lastSentUtteranceRef.current;
      if (
        inFlightUtteranceRef.current
        || (lastSent && lastSent.text === normalized && now - lastSent.at < 5000)
      ) {
        return;
      }

      inFlightUtteranceRef.current = normalized;
      lastSentUtteranceRef.current = { text: normalized, at: now };
      dispatch({ type: 'SEND_UTTERANCE' });
      try {
        await sendMessage(utterance);
        dispatch({ type: 'AGENT_STARTED' });
      } catch (error) {
        inFlightUtteranceRef.current = null;
        dispatch({
          type: 'AUDIO_ERROR',
          error: error instanceof Error ? error.message : 'Could not send voice message',
        });
      }
    });
  }, [inputProvider, sendMessage, setOnFinalTranscript]);

  useEffect(() => {
    if (awaitingResponse) {
      dispatch({ type: 'AGENT_STARTED' });
    }
  }, [awaitingResponse]);

  useEffect(() => {
    if (streamingText) {
      dispatch({ type: 'AGENT_STREAMING' });
    }
  }, [streamingText]);

  useEffect(() => {
    if (latestAssistantId && latestAssistantId !== latestAssistantIdRef.current) {
      latestAssistantIdRef.current = latestAssistantId;
      inFlightUtteranceRef.current = null;
      dispatch({ type: voiceState === 'speaking' ? 'TTS_STARTED' : 'AGENT_FINAL' });
    }
  }, [latestAssistantId, voiceState]);

  useEffect(() => {
    if (voiceState === 'listening') {
      if (!listeningStartedAtRef.current) {
        listeningStartedAtRef.current = Date.now();
      }
      dispatch({ type: 'MIC_READY' });
      dispatch({ type: 'TRANSCRIPT_PARTIAL', text: transcript });
    } else {
      listeningStartedAtRef.current = null;
    }
    if (voiceState === 'speaking') {
      dispatch({ type: 'TTS_STARTED' });
    }
    if (voiceState === 'idle' && stateRef.current.status === 'speaking') {
      dispatch({ type: 'TTS_DONE' });
    }
  }, [transcript, voiceState]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        refreshHandsFree();
        dispatch({ type: 'FOREGROUND' });
        if (connectionState === 'disconnected') {
          reconnect();
        }
        // If the user backgrounded mid-session with background listening on, re-arm
        // the mic automatically instead of making them tap again.
        if (handsFreeRef.current.backgroundListening && wasActiveSessionRef.current) {
          dispatch({ type: 'START_SESSION' });
        }
        wasActiveSessionRef.current = false;
        return;
      }

      wasActiveSessionRef.current = stateRef.current.sessionEnabled;
      dispatch({ type: 'BACKGROUND' });
      // Keep the audio session alive so agent playback can continue in the
      // background (voice capture itself is paused by the OS; we resume on return).
      suspend({ keepPlayback: true });
    });

    return () => sub.remove();
  }, [connectionState, reconnect, refreshHandsFree, suspend, voiceState]);

  useEffect(() => {
    const shouldListen =
      connectionState === 'connected'
      && state.foreground
      && AppState.currentState === 'active'
      && state.status === 'starting'
      && voiceState === 'idle'
      && !awaitingResponse
      && !streamingText;

    if (shouldListen) {
      startListening(true).catch((error) => {
        dispatch({ type: 'AUDIO_ERROR', error: formatAudioStartError(error) });
      });
    }
  }, [awaitingResponse, connectionState, startListening, state.foreground, state.status, streamingText, voiceState]);

  useEffect(() => {
    if (
      connectionState !== 'connected'
      || !state.foreground
      || state.status !== 'recovering'
      || voiceState !== 'idle'
      || awaitingResponse
      || streamingText
    ) {
      return;
    }

    const timer = setTimeout(() => dispatch({ type: 'START_SESSION' }), 1200);
    return () => clearTimeout(timer);
  }, [awaitingResponse, connectionState, state.foreground, state.status, streamingText, voiceState]);

  useEffect(() => {
    if (connectionState === 'connected' && state.status === 'paused' && state.foreground && state.sessionEnabled) {
      dispatch({ type: 'START_SESSION' });
    }
  }, [connectionState, state.foreground, state.sessionEnabled, state.status]);

  // Voice wake: when a wake word is configured, automatically arm the mic so the app
  // is passively listening for the wake phrase without requiring a tap.
  useEffect(() => {
    if (
      !wakeEnabled
      || connectionState !== 'connected'
      || !state.foreground
      || AppState.currentState !== 'active'
      || state.status !== 'paused'
      || state.sessionEnabled
      || Boolean(state.error)
    ) {
      return;
    }
    const timer = setTimeout(() => {
      if (stateRef.current.status === 'paused' && !stateRef.current.sessionEnabled) {
        dispatch({ type: 'START_SESSION' });
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [connectionState, state.error, state.foreground, state.sessionEnabled, state.status, wakeEnabled]);

  const toggleMic = useCallback(async () => {
    if (AppState.currentState !== 'active') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      dispatch({
        type: 'AUDIO_ERROR',
        error: 'Open ClawVoice in the foreground to use the microphone.',
      });
      return;
    }

    if (connectionState !== 'connected') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      reconnect();
      return;
    }

    if (state.status === 'speaking' || voiceState === 'speaking' || voiceState === 'preparingAudio') {
      pulse(Haptics.ImpactFeedbackStyle.Medium);
      track('voice_stopped_audio', { provider: inputProvider });
      await stopSpeaking();
      dispatch({ type: 'PAUSE_MIC' });
      return;
    }

    if (state.status === 'starting') {
      pulse(Haptics.ImpactFeedbackStyle.Medium);
      dispatch({ type: 'PAUSE_MIC' });
      await suspend();
      return;
    }

    if (state.status === 'listening' || voiceState === 'listening') {
      pulse(Haptics.ImpactFeedbackStyle.Medium);
      const elapsed = listeningStartedAtRef.current ? Date.now() - listeningStartedAtRef.current : Infinity;
      if (elapsed < QUICK_MANUAL_STOP_MS) {
        dispatch({ type: 'PAUSE_MIC' });
        await suspend();
        return;
      }

      const pendingTranscript = (state.transcript || transcript).trim();
      if (pendingTranscript) {
        dispatch({ type: 'SEND_UTTERANCE' });
        await stopListening();
        return;
      }

      finalTranscriptReceivedRef.current = false;
      await stopListening();
      if (!finalTranscriptReceivedRef.current) {
        dispatch({ type: 'PAUSE_MIC' });
      }
      return;
    }

    pulse(Haptics.ImpactFeedbackStyle.Heavy);
    track('voice_started', { provider: inputProvider });
    trackOnce('first_voice_started', { provider: inputProvider });
    dispatch({ type: 'RESUME_MIC' });
  }, [connectionState, inputProvider, pulse, reconnect, state.status, state.transcript, stopListening, stopSpeaking, suspend, transcript, voiceState]);

  useEffect(() => {
    if (state.status !== 'starting') return;

    const timer = setTimeout(() => {
      if (stateRef.current.status !== 'starting') return;
      dispatch({ type: 'PAUSE_MIC' });
      suspend();
    }, 4500);

    return () => clearTimeout(timer);
  }, [state.status, suspend]);

  const pause = useCallback(async () => {
    dispatch({ type: 'PAUSE_MIC' });
    await suspend();
  }, [suspend]);

  const statusLabel = (() => {
    if (voiceState === 'thinking') {
      return 'Transcribing...';
    }

    switch (state.status) {
      case 'paused':
        return state.error || (connectionState === 'connected' ? 'Tap to listen.' : 'Tap to reconnect');
      case 'starting':
        return 'Starting microphone...';
      case 'listening': {
        if ((state.transcript || transcript).trim()) return 'Tap to send.';
        if (wakeEnabled && awakeUntilRef.current <= Date.now()) {
          const phrase = handsFreeRef.current.wakeWords[0];
          return phrase ? `Say "${phrase}" to talk.` : 'Listening for your wake word.';
        }
        return 'Listening. Pause when needed.';
      }
      case 'finalizing':
        return 'Sending...';
      case 'awaitingAgent':
        return 'Waiting for response...';
      case 'agentStreaming':
        return 'Agent is responding...';
      case 'speaking':
        return 'Playing audio. Tap to stop.';
      case 'recovering':
        return voiceState === 'preparingAudio'
          ? 'Preparing audio...'
          : voiceState === 'speaking'
          ? 'Playing audio. Tap to stop.'
          : 'Listening will resume...';
      case 'error':
        return state.error || 'Microphone unavailable';
      default:
        return undefined;
    }
  })();

  return {
    conversationState: state,
    orbState: getVoiceOrbState(state.status, voiceState),
    transcript: state.transcript || transcript,
    statusLabel,
    toggleMic,
    pause,
    isBusy: state.status === 'finalizing',
  };
}

function formatAudioStartError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (message.toLowerCase().includes('background')) {
    return 'Open ClawVoice in the foreground to use the microphone.';
  }
  return 'Could not start microphone';
}
