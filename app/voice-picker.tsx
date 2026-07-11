import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, fontSize, borderRadius } from '@/constants/theme';
import {
  getCantoneseAiKey,
  getCantoneseAiTtsSettings,
  saveCantoneseAiVoice,
} from '@/services/CantoneseAIConfig';
import {
  CURATED_CANTONESE_VOICES,
  fetchCantoneseVoices,
  type CantoneseVoice,
} from '@/services/CantoneseAISpeechService';
import { track } from '@/services/AnalyticsService';

export default function VoicePickerScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [voices, setVoices] = useState<CantoneseVoice[]>(CURATED_CANTONESE_VOICES);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hasKey, setHasKey] = useState(true);
  const [manualId, setManualId] = useState('');

  useEffect(() => {
    let mounted = true;

    (async () => {
      const [key, settings] = await Promise.all([
        getCantoneseAiKey(),
        getCantoneseAiTtsSettings(),
      ]);
      if (!mounted) return;

      setSelectedId(settings.voiceId);
      if (!key?.trim()) {
        setHasKey(false);
        setLoading(false);
        return;
      }

      try {
        const fetched = await fetchCantoneseVoices(key);
        if (mounted && fetched.length > 0) setVoices(fetched);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const selectVoice = useCallback(
    async (voice: CantoneseVoice) => {
      setSelectedId(voice.id);
      await saveCantoneseAiVoice(voice.id, voice.name);
      track('cantoneseai_voice_selected', { screen: 'settings' });
      router.back();
    },
    [router],
  );

  const applyManualId = useCallback(async () => {
    const id = manualId.trim();
    if (!id) return;
    await saveCantoneseAiVoice(id, `Custom (${id.slice(0, 8)})`);
    track('cantoneseai_voice_selected', { screen: 'settings' });
    router.back();
  }, [manualId, router]);

  return (
    <>
      <Stack.Screen options={{ title: 'Choose Voice' }} />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {!hasKey && (
          <View style={styles.notice}>
            <Text style={styles.noticeText}>
              Add your cantonese.ai API key in Settings to load the full voice library. You can still paste a voice ID below.
            </Text>
          </View>
        )}

        <Text style={styles.sectionTitle}>Voices</Text>
        <View style={styles.card}>
          {loading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color={colors.primaryLight} />
              <Text style={styles.rowDescription}>Loading voices…</Text>
            </View>
          ) : (
            voices.map((voice, index) => (
              <View key={voice.id}>
                {index > 0 && <View style={styles.divider} />}
                <Pressable style={styles.row} onPress={() => selectVoice(voice)}>
                  <View style={styles.rowText}>
                    <Text style={styles.rowLabel}>{voice.name}</Text>
                    {(voice.language || voice.gender || voice.description) && (
                      <Text style={styles.rowDescription} numberOfLines={2}>
                        {[voice.language, voice.gender, voice.description].filter(Boolean).join(' · ')}
                      </Text>
                    )}
                  </View>
                  {selectedId === voice.id && (
                    <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                  )}
                </Pressable>
              </View>
            ))
          )}
        </View>

        <Text style={styles.sectionTitle}>Manual Voice ID</Text>
        <View style={styles.card}>
          <View style={styles.keyEditContainer}>
            <Text style={styles.rowDescription}>
              Paste any voice_id from cantonese.ai/voices.
            </Text>
            <TextInput
              style={styles.input}
              value={manualId}
              onChangeText={setManualId}
              placeholder="voice_id"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Pressable
              style={[styles.applyButton, !manualId.trim() && styles.applyButtonDisabled]}
              onPress={applyManualId}
              disabled={!manualId.trim()}
            >
              <Text style={styles.applyButtonText}>Use This Voice</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </>
  );
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
  notice: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
  },
  noticeText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
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
    gap: spacing.md,
  },
  rowText: {
    flex: 1,
  },
  rowLabel: {
    fontSize: fontSize.md,
    color: colors.text,
  },
  rowDescription: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    marginTop: 2,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
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
  input: {
    backgroundColor: colors.background,
    color: colors.text,
    fontSize: fontSize.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  applyButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  applyButtonDisabled: {
    opacity: 0.5,
  },
  applyButtonText: {
    color: '#FFFFFF',
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
});
