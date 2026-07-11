# CarPlay Support Review

_Last reviewed: 2026-07 (cantonese.ai + hands-free update)_

## Summary

ClawVoice **already ships CarPlay voice support**, and it continues to work after the
migration from ElevenLabs to cantonese.ai. CarPlay voice mode is driven by the same
`VoiceEngine` / `useVoiceConversation` pipeline as the phone UI, so swapping the
speech provider under the hood required no CarPlay-specific changes — CarPlay now
speaks and transcribes through cantonese.ai automatically whenever a key is
configured.

## How it is wired

| Layer | File | Role |
|-------|------|------|
| Config plugin | `plugins/with-carplay.js` | Injects the CarPlay scene, entitlement, `SceneDelegate`, and a native `CarPlayBridge` at prebuild time. |
| Native scene | `CarPlaySceneDelegate.swift` (generated) | Presents a `CPListTemplate` root + a `CPVoiceControlTemplate` with `ready / connecting / listening / thinking / speaking / paused / error` states. |
| Native bridge | `CarPlayBridge` (RCTEventEmitter) | Sends CarPlay button commands (`startVoice`, `pauseVoice`, `stopAudio`) to JS and receives status updates via `setStatus`. |
| JS bridge | `src/services/CarPlayBridge.ts` | `addCarPlayCommandListener` + `setCarPlayStatus`. |
| Routing | `app/_layout.tsx` | Routes CarPlay commands to `/voice` with a `carplayStart` param. |
| Screen | `app/voice.tsx` | Maps conversation state → `CarPlayStatus` via `setCarPlayStatus`, and honours the `carplayStart` command by toggling the mic. |

### Entitlement

`com.apple.developer.carplay-voice-based-conversation` is added to the app
entitlements by the config plugin. This is the correct CarPlay category for a
voice assistant and must be granted by Apple on the developer portal before a
production build will run in CarPlay.

## Behaviour with the new features

- **cantonese.ai TTS/STT** — used transparently in CarPlay. The audio session is set
  to `DuckOthers` during playback so car audio dims rather than stops.
- **Speakerphone** — in CarPlay, output is already routed to the car's speakers by
  the system, so the in-app speakerphone toggle is effectively a no-op there; it
  matters for phone/desk hands-free use. It does no harm in CarPlay.
- **Voice wake / wake words** — the software wake word runs on the JS side and is
  active whenever the voice session is armed and the app scene is active. CarPlay
  users typically tap the CarPlay list item (`Start Voice`) to begin, which is the
  Apple-recommended, safety-reviewed entry point; continuous wake-word listening in
  CarPlay is subject to the same OS audio constraints as background listening.
- **Background listening** — iOS suspends microphone capture for backgrounded apps;
  the setting keeps the audio session alive for playback and re-arms the mic when the
  app returns to the foreground (or when CarPlay reactivates the scene).

## Testing notes

- CarPlay cannot be exercised in this repo's headless environment; it requires the
  CarPlay simulator (Xcode → I/O → External Displays → CarPlay) or physical head unit
  plus the granted entitlement.
- The plugin adds a dedicated `CarPlayDebug` build configuration and Xcode scheme for
  local CarPlay debugging (see `withCarPlayDebugScheme`).

## Recommended follow-ups (not blocking)

1. Surface the selected cantonese.ai voice name on the CarPlay status subtitle.
2. Consider an explicit "wake word" hint in the CarPlay `listening` state title.
3. Apply for / confirm the CarPlay entitlement approval before the next store build.
