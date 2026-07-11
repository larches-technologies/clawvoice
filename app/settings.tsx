import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, Alert, ScrollView, TextInput, Platform, Switch, Linking, ActivityIndicator, ActionSheetIOS } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Updates from 'expo-updates';
import Constants from 'expo-constants';
import * as SecureStore from '@/services/SafeSecureStore';
import { colors, spacing, fontSize, borderRadius } from '@/constants/theme';
import { getGatewayConfig, deleteGatewayConfig } from '@/services/SecureStorage';
import { addSiriShortcut } from '@/services/SiriService';
import { getAnalyticsDiagnostics, isAnalyticsEnabled, sendAnalyticsTestEvent, setAnalyticsEnabled, track } from '@/services/AnalyticsService';
import type { AnalyticsDiagnostics } from '@/services/AnalyticsService';
import type { GatewayConfig } from '@/types/gateway';
import {
  CANTONESEAI_TTS_MODEL,
  CANTONESEAI_TTS_PITCH,
  CANTONESEAI_TTS_SPEED,
  DEFAULT_CANTONESEAI_MODEL,
  DEFAULT_CANTONESEAI_TTS_PITCH,
  DEFAULT_CANTONESEAI_TTS_SPEED,
  DEFAULT_CANTONESEAI_VOICE_NAME,
  getCantoneseAiKey,
  getCantoneseAiTtsSettings,
  isCantoneseAiSttEnabled,
  saveCantoneseAiKey,
  saveCantoneseAiTtsSetting,
  setCantoneseAiSttEnabled,
} from '@/services/CantoneseAIConfig';
import type { CantoneseAiModel } from '@/services/CantoneseAIConfig';
import {
  DEFAULT_VOICE_LANGUAGE,
  getVoiceLanguage,
  setVoiceLanguage,
  VOICE_LANGUAGE_OPTIONS,
} from '@/services/VoiceLanguageConfig';
import type { VoiceLanguageOption } from '@/services/VoiceLanguageConfig';
import {
  DEFAULT_WAKE_WORDS,
  formatWakeWords,
  getHandsFreeSettings,
  saveWakeWords,
  setBackgroundListening,
  setSpeakerphone,
  setWakeEnabled,
} from '@/services/WakeWordConfig';

const KEY_AUTO_PRONOUNCE = 'iclawd_auto_pronounce';
const KEY_NOTIFICATIONS = 'iclawd_notifications';
const OTA_CHANNEL = 'production';

export default function SettingsScreen() {
  const router = useRouter();
  const [config, setConfig] = useState<GatewayConfig | null>(null);
  const [cantoneseKey, setCantoneseKey] = useState('');
  const [editingKey, setEditingKey] = useState(false);
  const [keyInput, setKeyInput] = useState('');
  const [autoPronounce, setAutoPronounce] = useState(true);
  const [notifications, setNotifications] = useState(true);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [usageAnalytics, setUsageAnalytics] = useState(true);
  const [analyticsDiagnostics, setAnalyticsDiagnostics] = useState<AnalyticsDiagnostics | null>(null);
  const [sendingAnalyticsTest, setSendingAnalyticsTest] = useState(false);
  const [ttsVoiceName, setTtsVoiceName] = useState(DEFAULT_CANTONESEAI_VOICE_NAME);
  const [ttsModel, setTtsModel] = useState<CantoneseAiModel>(DEFAULT_CANTONESEAI_MODEL);
  const [ttsSpeed, setTtsSpeed] = useState(String(DEFAULT_CANTONESEAI_TTS_SPEED));
  const [ttsPitch, setTtsPitch] = useState(String(DEFAULT_CANTONESEAI_TTS_PITCH));
  const [cantoneseStt, setCantoneseStt] = useState(false);
  const [voiceLanguage, setVoiceLanguageState] = useState<VoiceLanguageOption>(DEFAULT_VOICE_LANGUAGE);
  const [wakeEnabled, setWakeEnabledState] = useState(false);
  const [wakeWordsText, setWakeWordsText] = useState(formatWakeWords(DEFAULT_WAKE_WORDS));
  const [backgroundListening, setBackgroundListeningState] = useState(false);
  const [speakerphone, setSpeakerphoneState] = useState(true);

  const loadVoiceSettings = useCallback(() => {
    getCantoneseAiTtsSettings().then((settings) => {
      setTtsVoiceName(settings.voiceName);
      setTtsModel(settings.modelId);
      setTtsSpeed(String(settings.speed));
      setTtsPitch(String(settings.pitch));
    });
  }, []);

  useEffect(() => {
    getGatewayConfig().then(setConfig);
    getCantoneseAiKey().then((k) => { if (k) setCantoneseKey(k); });
    loadVoiceSettings();
    getVoiceLanguage().then(setVoiceLanguageState);
    getHandsFreeSettings().then((hf) => {
      setWakeEnabledState(hf.wakeEnabled);
      setWakeWordsText(formatWakeWords(hf.wakeWords));
      setBackgroundListeningState(hf.backgroundListening);
      setSpeakerphoneState(hf.speakerphone);
    });
    SecureStore.getItemAsync(KEY_AUTO_PRONOUNCE).then((v) => setAutoPronounce(v !== 'false'));
    SecureStore.getItemAsync(KEY_NOTIFICATIONS).then((v) => setNotifications(v !== 'false'));
    isCantoneseAiSttEnabled().then(setCantoneseStt);
    isAnalyticsEnabled().then(setUsageAnalytics);
    getAnalyticsDiagnostics().then(setAnalyticsDiagnostics);
    track('settings_opened', { screen: 'settings' });
  }, [loadVoiceSettings]);

  // Refresh the selected-voice label when returning from the voice picker.
  useFocusEffect(useCallback(() => {
    loadVoiceSettings();
  }, [loadVoiceSettings]));

  function handleDisconnect() {
    Alert.alert(
      'Disconnect Gateway',
      'This will remove your gateway credentials. You can reconnect anytime.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: async () => {
            await deleteGatewayConfig();
            router.replace('/');
          },
        },
      ],
    );
  }

  function handleEditKey() {
    setKeyInput(cantoneseKey);
    setEditingKey(true);
  }

  async function handleSaveKey() {
    await saveCantoneseAiKey(keyInput);
    setCantoneseKey(keyInput.trim());
    if (keyInput.trim()) {
      track('cantoneseai_key_added', { screen: 'settings' });
    }
    if (!keyInput.trim()) {
      await setCantoneseAiSttEnabled(false);
      setCantoneseStt(false);
    }
    setEditingKey(false);
  }

  function handleCancelKey() {
    setEditingKey(false);
    setKeyInput('');
  }

  function handleClearKey() {
    Alert.alert('Remove API Key', 'This will remove your cantonese.ai API key.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          await saveCantoneseAiKey('');
          await setCantoneseAiSttEnabled(false);
          setCantoneseKey('');
          setCantoneseStt(false);
        },
      },
    ]);
  }

  async function toggleAutoPronounce(value: boolean) {
    setAutoPronounce(value);
    await SecureStore.setItemAsync(KEY_AUTO_PRONOUNCE, String(value));
  }

  async function toggleNotifications(value: boolean) {
    setNotifications(value);
    await SecureStore.setItemAsync(KEY_NOTIFICATIONS, String(value));
  }

  async function toggleCantoneseStt(value: boolean) {
    setCantoneseStt(value);
    await setCantoneseAiSttEnabled(value);
    track('cantoneseai_stt_enabled', { screen: 'settings', enabled: value });
  }

  async function toggleWakeEnabled(value: boolean) {
    setWakeEnabledState(value);
    await setWakeEnabled(value);
    track('voice_wake_enabled', { screen: 'settings', enabled: value });
  }

  async function toggleBackgroundListening(value: boolean) {
    setBackgroundListeningState(value);
    await setBackgroundListening(value);
    track('background_listening_enabled', { screen: 'settings', enabled: value });
  }

  async function toggleSpeakerphone(value: boolean) {
    setSpeakerphoneState(value);
    await setSpeakerphone(value);
    track('speakerphone_enabled', { screen: 'settings', enabled: value });
  }

  async function handleSaveWakeWords() {
    const words = wakeWordsText.split(/[,\n]/).map((w) => w.trim()).filter(Boolean);
    await saveWakeWords(words.length ? words : DEFAULT_WAKE_WORDS);
    const hf = await getHandsFreeSettings();
    setWakeWordsText(formatWakeWords(hf.wakeWords));
  }

  async function handleSelectModel() {
    const next: CantoneseAiModel = ttsModel === 'v6' ? 'v5' : 'v6';
    setTtsModel(next);
    await saveCantoneseAiTtsSetting(CANTONESEAI_TTS_MODEL, next);
    track('cantoneseai_tts_setting_changed', { screen: 'settings', setting: 'model' });
  }

  function handleSelectVoiceLanguage() {
    if (Platform.OS === 'ios') {
      const options = [...VOICE_LANGUAGE_OPTIONS.map((option) => option.label), 'Cancel'];
      const cancelButtonIndex = options.length - 1;
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options,
          cancelButtonIndex,
          userInterfaceStyle: 'dark',
        },
        (buttonIndex) => {
          if (buttonIndex === cancelButtonIndex) return;
          const next = VOICE_LANGUAGE_OPTIONS[buttonIndex];
          if (!next) return;
          setVoiceLanguage(next.locale).then(setVoiceLanguageState);
        },
      );
      return;
    }

    const currentIndex = VOICE_LANGUAGE_OPTIONS.findIndex((option) => option.locale === voiceLanguage.locale);
    const next = VOICE_LANGUAGE_OPTIONS[(currentIndex + 1) % VOICE_LANGUAGE_OPTIONS.length] || DEFAULT_VOICE_LANGUAGE;
    setVoiceLanguage(next.locale).then(setVoiceLanguageState);
  }

  async function toggleUsageAnalytics(value: boolean) {
    setUsageAnalytics(value);
    await setAnalyticsEnabled(value);
    if (value) {
      await track('settings_opened', { screen: 'settings' });
    }
    setAnalyticsDiagnostics(await getAnalyticsDiagnostics());
  }

  async function handleSendAnalyticsTest() {
    if (!usageAnalytics) {
      Alert.alert('Analytics is off', 'Turn on Usage Analytics first, then send a test event.');
      return;
    }

    setSendingAnalyticsTest(true);
    try {
      const nextDiagnostics = await sendAnalyticsTestEvent();
      setAnalyticsDiagnostics(nextDiagnostics);
      if (nextDiagnostics.lastEventStatus === 'sent') {
        Alert.alert('Test event sent', 'Open Firebase Realtime or DebugView and look for analytics_test_sent.');
      } else if (nextDiagnostics.lastEventStatus === 'module_missing') {
        Alert.alert('Firebase not loaded', 'The analytics native module is not available in this installed build.');
      } else {
        Alert.alert('Analytics test failed', nextDiagnostics.lastEventError || 'The app could not send the test event.');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not send analytics test event.';
      Alert.alert('Analytics test failed', message);
    } finally {
      setSendingAnalyticsTest(false);
    }
  }

  async function saveTtsSetting(key: string, value: string, setValue: (value: string) => void) {
    await saveCantoneseAiTtsSetting(key, value);
    setValue(value.trim());
    track('cantoneseai_tts_setting_changed', { screen: 'settings', setting: key });
  }

  async function handleCheckForUpdates() {
    track('ota_check_tapped', { screen: 'settings' });
    if (__DEV__) {
      Alert.alert('Updates unavailable', 'OTA updates are disabled in development builds.');
      return;
    }

    setCheckingUpdate(true);
    try {
      prepareUpdateRequestHeaders();
      const update = await Updates.checkForUpdateAsync();
      if (!update.isAvailable) {
        Alert.alert('Up to date', 'You are already running the latest available update.');
        return;
      }

      await Updates.fetchUpdateAsync();
      Alert.alert('Update ready', 'Restart the app now to use the latest update.', [
        { text: 'Later', style: 'cancel' },
        {
          text: 'Restart Now',
          onPress: () => {
            Updates.reloadAsync().catch(() => {});
          },
        },
      ]);
    } catch (error) {
      const message = getUpdateCheckErrorMessage(error);
      Alert.alert('Update check failed', message);
    } finally {
      setCheckingUpdate(false);
    }
  }

  const bundleLabel = Updates.updateId
    ? Updates.updateId.slice(0, 8)
    : Updates.isEmbeddedLaunch
      ? 'Embedded'
      : 'Unavailable';
  const bundleDate = Updates.createdAt
    ? Updates.createdAt.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : null;
  const analyticsLastEventLabel = formatAnalyticsLastEvent(analyticsDiagnostics);
  const appVersion = Constants.expoConfig?.version || 'Unavailable';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Gateway Section */}
      <Text style={styles.sectionTitle}>Gateway</Text>
      <View style={styles.card}>
        {config ? (
          <>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>URL</Text>
              <Text style={styles.rowValue} numberOfLines={1}>{config.url}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Name</Text>
              <Text style={styles.rowValue}>{config.name || 'My Gateway'}</Text>
            </View>
            <View style={styles.divider} />
            <Pressable style={styles.row} onPress={handleDisconnect}>
              <Text style={[styles.rowLabel, { color: colors.error }]}>Disconnect</Text>
              <Ionicons name="log-out-outline" size={18} color={colors.error} />
            </Pressable>
          </>
        ) : (
          <Pressable style={styles.row} onPress={() => router.push('/connect')}>
            <Text style={styles.rowLabel}>Connect to Gateway</Text>
            <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
          </Pressable>
        )}
      </View>

      {/* Voice Section */}
      <Text style={styles.sectionTitle}>Voice</Text>
      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Text-to-Speech</Text>
          <Text style={styles.rowValue}>{cantoneseKey ? 'cantonese.ai' : 'System Voice'}</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Speech-to-Text</Text>
          <Text style={styles.rowValue}>{cantoneseKey && cantoneseStt ? 'cantonese.ai' : 'System'}</Text>
        </View>
        <View style={styles.divider} />
        <Pressable style={styles.row} onPress={handleSelectVoiceLanguage}>
          <View style={styles.rowText}>
            <Text style={styles.rowLabel}>Language</Text>
            <Text style={styles.rowDescription}>Used for speech recognition, TTS, and gateway locale.</Text>
          </View>
          <Text style={styles.rowValue}>{voiceLanguage.label}</Text>
        </Pressable>
        <View style={styles.divider} />
        {editingKey ? (
          <View style={styles.keyEditContainer}>
            <TextInput
              style={styles.keyInput}
              value={keyInput}
              onChangeText={setKeyInput}
              placeholder="cantonese.ai API key"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
              secureTextEntry
            />
            <View style={styles.keyActions}>
              <Pressable style={styles.keyButton} onPress={handleCancelKey}>
                <Text style={styles.keyButtonCancel}>Cancel</Text>
              </Pressable>
              <Pressable style={[styles.keyButton, styles.keySaveButton]} onPress={handleSaveKey}>
                <Text style={styles.keyButtonSave}>Save</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <Pressable style={styles.row} onPress={cantoneseKey ? handleClearKey : handleEditKey}>
            <Text style={styles.rowLabel}>cantonese.ai API Key</Text>
            {cantoneseKey ? (
              <View style={styles.keyConfigured}>
                <Text style={styles.rowValue}>
                  {'•'.repeat(4)}{cantoneseKey.slice(-4)}
                </Text>
                <Pressable onPress={handleEditKey} hitSlop={8}>
                  <Ionicons name="pencil" size={14} color={colors.textSecondary} />
                </Pressable>
              </View>
            ) : (
              <Text style={[styles.rowValue, { color: colors.primary }]}>Configure</Text>
            )}
          </Pressable>
        )}
        {cantoneseKey ? (
          <>
            <View style={styles.divider} />
            <View style={styles.row}>
              <View style={styles.rowText}>
                <Text style={styles.rowLabel}>cantonese.ai STT</Text>
                <Text style={styles.rowDescription}>Use API transcription for voice and dictation.</Text>
              </View>
              <Switch
                value={cantoneseStt}
                onValueChange={toggleCantoneseStt}
                trackColor={{ false: colors.border, true: colors.primary }}
              />
            </View>
            <View style={styles.divider} />
            <Pressable style={styles.row} onPress={() => router.push('/voice-picker')}>
              <View style={styles.rowText}>
                <Text style={styles.rowLabel}>Voice</Text>
                <Text style={styles.rowDescription}>Browse the cantonese.ai voice library.</Text>
              </View>
              <View style={styles.keyConfigured}>
                <Text style={styles.rowValue} numberOfLines={1}>{ttsVoiceName}</Text>
                <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
              </View>
            </Pressable>
            <View style={styles.divider} />
            <Pressable style={styles.row} onPress={handleSelectModel}>
              <View style={styles.rowText}>
                <Text style={styles.rowLabel}>Model</Text>
                <Text style={styles.rowDescription}>Higher versions sound more natural.</Text>
              </View>
              <Text style={styles.rowValue}>{ttsModel}</Text>
            </Pressable>
            <View style={styles.divider} />
            <View style={styles.settingInputRow}>
              <Text style={styles.rowLabel}>Speed</Text>
              <TextInput
                style={styles.numberInput}
                value={ttsSpeed}
                onChangeText={setTtsSpeed}
                onBlur={() => saveTtsSetting(CANTONESEAI_TTS_SPEED, ttsSpeed, setTtsSpeed)}
                keyboardType="decimal-pad"
                placeholder="1"
                placeholderTextColor={colors.textMuted}
              />
            </View>
            <View style={styles.divider} />
            <View style={styles.settingInputRow}>
              <Text style={styles.rowLabel}>Pitch</Text>
              <TextInput
                style={styles.numberInput}
                value={ttsPitch}
                onChangeText={setTtsPitch}
                onBlur={() => saveTtsSetting(CANTONESEAI_TTS_PITCH, ttsPitch, setTtsPitch)}
                keyboardType="numbers-and-punctuation"
                placeholder="0"
                placeholderTextColor={colors.textMuted}
              />
            </View>
          </>
        ) : null}
      </View>

      {/* Hands-free Section */}
      <Text style={styles.sectionTitle}>Hands-free</Text>
      <View style={styles.card}>
        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={styles.rowLabel}>Voice Wake</Text>
            <Text style={styles.rowDescription}>Listen passively and activate when you say a wake word.</Text>
          </View>
          <Switch
            value={wakeEnabled}
            onValueChange={toggleWakeEnabled}
            trackColor={{ false: colors.border, true: colors.primary }}
          />
        </View>
        <View style={styles.divider} />
        <View style={styles.keyEditContainer}>
          <Text style={styles.rowLabel}>Wake Words</Text>
          <Text style={styles.rowDescription}>Comma-separated phrases, e.g. “hey claw, ok claw”.</Text>
          <TextInput
            style={styles.keyInput}
            value={wakeWordsText}
            onChangeText={setWakeWordsText}
            onBlur={handleSaveWakeWords}
            placeholder={formatWakeWords(DEFAULT_WAKE_WORDS)}
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
        <View style={styles.divider} />
        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={styles.rowLabel}>Background Listening</Text>
            <Text style={styles.rowDescription}>Keep the session alive and re-arm the mic when you return to the app.</Text>
          </View>
          <Switch
            value={backgroundListening}
            onValueChange={toggleBackgroundListening}
            trackColor={{ false: colors.border, true: colors.primary }}
          />
        </View>
        <View style={styles.divider} />
        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={styles.rowLabel}>Speakerphone</Text>
            <Text style={styles.rowDescription}>Play responses through the loudspeaker for hands-free use.</Text>
          </View>
          <Switch
            value={speakerphone}
            onValueChange={toggleSpeakerphone}
            trackColor={{ false: colors.border, true: colors.primary }}
          />
        </View>
      </View>

      {/* Siri Section (iOS only) */}
      {Platform.OS === 'ios' && (
        <>
          <Text style={styles.sectionTitle}>Siri</Text>
          <View style={styles.card}>
            <Pressable style={styles.row} onPress={() => addSiriShortcut()}>
              <Text style={styles.rowLabel}>Add to Siri</Text>
              <Ionicons name="mic-outline" size={18} color={colors.primary} />
            </Pressable>
            <View style={styles.divider} />
            <View style={styles.row}>
              <Text style={[styles.rowLabel, { fontSize: fontSize.sm, color: colors.textSecondary }]}>
                Say "Hey Siri, Clawd Voice" to launch voice mode
              </Text>
            </View>
          </View>
        </>
      )}

      {/* Responses Section */}
      <Text style={styles.sectionTitle}>Responses</Text>
      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Auto-pronounce</Text>
          <Switch
            value={autoPronounce}
            onValueChange={toggleAutoPronounce}
            trackColor={{ false: colors.border, true: colors.primary }}
          />
        </View>
        <View style={styles.divider} />
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Notifications</Text>
          <Switch
            value={notifications}
            onValueChange={toggleNotifications}
            trackColor={{ false: colors.border, true: colors.primary }}
          />
        </View>
      </View>

      {/* Privacy Section */}
      <Text style={styles.sectionTitle}>Privacy</Text>
      <View style={styles.card}>
        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={styles.rowLabel}>Usage Analytics</Text>
            <Text style={styles.rowDescription}>
              Helps improve reliability and onboarding. No prompts, transcripts, messages, gateway URLs, or tokens are collected.
            </Text>
          </View>
          <Switch
            value={usageAnalytics}
            onValueChange={toggleUsageAnalytics}
            trackColor={{ false: colors.border, true: colors.primary }}
          />
        </View>
        <View style={styles.divider} />
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Firebase Module</Text>
          <Text style={styles.rowValue}>
            {analyticsDiagnostics ? (analyticsDiagnostics.moduleLoaded ? 'Loaded' : 'Missing') : 'Checking'}
          </Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Firebase Project</Text>
          <Text style={styles.rowValue} numberOfLines={1}>
            {analyticsDiagnostics?.projectId || 'Unknown'}
          </Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Firebase App</Text>
          <Text style={styles.rowValue} numberOfLines={1}>
            {analyticsDiagnostics?.appId || 'Unknown'}
          </Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Last Analytics Event</Text>
          <Text style={styles.rowValue} numberOfLines={2}>
            {analyticsLastEventLabel}
          </Text>
        </View>
        <View style={styles.divider} />
        <Pressable
          style={styles.row}
          onPress={handleSendAnalyticsTest}
          disabled={sendingAnalyticsTest}
        >
          <Text style={styles.rowLabel}>Send Test Event</Text>
          {sendingAnalyticsTest ? (
            <ActivityIndicator size="small" color={colors.primaryLight} />
          ) : (
            <Ionicons name="analytics-outline" size={18} color={colors.primary} />
          )}
        </Pressable>
      </View>

      {/* About Section */}
      <Text style={styles.sectionTitle}>About</Text>
      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Version</Text>
          <Text style={styles.rowValue}>{appVersion}</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Bundle</Text>
          <Text style={styles.rowValue} numberOfLines={1}>
            {bundleDate ? `${bundleLabel} · ${bundleDate}` : bundleLabel}
          </Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Update Channel</Text>
          <Text style={styles.rowValue}>{Updates.channel || 'Missing'}</Text>
        </View>
        <View style={styles.divider} />
        <Pressable style={styles.row} onPress={handleCheckForUpdates} disabled={checkingUpdate}>
          <Text style={styles.rowLabel}>Check for Updates</Text>
          {checkingUpdate ? (
            <ActivityIndicator size="small" color={colors.primaryLight} />
          ) : (
            <Ionicons name="cloud-download-outline" size={18} color={colors.primary} />
          )}
        </Pressable>
        <View style={styles.divider} />
        <View style={styles.row}>
          <Text style={styles.rowLabel}>License</Text>
          <Text style={styles.rowValue}>MIT</Text>
        </View>
        <View style={styles.divider} />
        <Pressable style={styles.row} onPress={() => Linking.openURL('https://github.com/rvssvl/iclawd')}>
          <Text style={styles.rowLabel}>GitHub</Text>
          <Ionicons name="logo-github" size={18} color={colors.textSecondary} />
        </Pressable>
      </View>
    </ScrollView>
  );
}

function formatAnalyticsLastEvent(diagnostics: AnalyticsDiagnostics | null): string {
  if (!diagnostics?.lastEventStatus) return 'No event yet';

  const status = diagnostics.lastEventStatus.replace(/_/g, ' ');
  if (!diagnostics.lastEventAt) return status;

  const date = new Date(diagnostics.lastEventAt);
  if (Number.isNaN(date.getTime())) return status;

  const time = date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  return `${status} · ${time}`;
}

function prepareUpdateRequestHeaders() {
  if (Updates.channel) return;

  try {
    Updates.setUpdateRequestHeadersOverride?.({ 'expo-channel-name': OTA_CHANNEL });
  } catch {
    // Older or strictly configured binaries cannot override update headers at runtime.
  }
}

function getUpdateCheckErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error || '');
  const normalized = message.toLowerCase();

  if (normalized.includes('expo-channel-name') || normalized.includes('channel-name')) {
    return 'This installed build is missing the production OTA channel. Install the next App Store/TestFlight build once, then manual update checks will work normally.';
  }

  return message || 'Could not check for updates.';
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.sm,
  },
  sectionTitle: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    minHeight: 48,
  },
  rowLabel: {
    fontSize: fontSize.md,
    color: colors.text,
  },
  rowValue: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    maxWidth: '60%',
    textAlign: 'right',
  },
  rowDescription: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    marginTop: 2,
    maxWidth: 220,
  },
  rowText: {
    flex: 1,
    paddingRight: spacing.md,
  },
  settingInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 48,
    gap: spacing.md,
  },
  inlineInput: {
    flex: 1,
    minHeight: 36,
    backgroundColor: colors.background,
    color: colors.text,
    fontSize: fontSize.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    textAlign: 'right',
  },
  numberInput: {
    width: 88,
    minHeight: 36,
    backgroundColor: colors.background,
    color: colors.text,
    fontSize: fontSize.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    textAlign: 'right',
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginLeft: spacing.md,
  },
  keyEditContainer: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  keyInput: {
    backgroundColor: colors.background,
    color: colors.text,
    fontSize: fontSize.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  keyActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
  },
  keyButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.md,
  },
  keySaveButton: {
    backgroundColor: colors.primary,
  },
  keyButtonCancel: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    fontWeight: '500',
  },
  keyButtonSave: {
    color: '#FFFFFF',
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  keyConfigured: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
});
