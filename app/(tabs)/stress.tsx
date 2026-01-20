import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useRecoveryState } from '@/core/hooks/useRecoveryState';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, Button } from 'react-native';

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

const median = (values: number[]) => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

export default function StressScreen() {
  const { dailyMetrics, workoutSummaries, isLoading, error, processNewData } =
    useRecoveryState();

  const derived = useMemo(() => {
    const recentMetrics = dailyMetrics.slice(-7);
    const latest = recentMetrics[recentMetrics.length - 1];

    const sleepBaseline = median(
      recentMetrics.map(m => m.sleepInMinutes).filter(Boolean) as number[]
    );
    const hrvBaseline = median(
      recentMetrics.map(m => m.hrvSdn).filter(Boolean) as number[]
    );
    const rhrBaseline = median(
      recentMetrics.map(m => m.restingHeartRate).filter(Boolean) as number[]
    );

    const sleepMinutes = latest?.sleepInMinutes ?? 0;
    const hrv = latest?.hrvSdn ?? 0;
    const rhr = latest?.restingHeartRate ?? 0;

    const sleepDelta = sleepBaseline > 0 ? (sleepMinutes / sleepBaseline - 1) * 100 : null;
    const hrvDelta = hrvBaseline > 0 ? (hrv / hrvBaseline - 1) * 100 : null;
    const rhrDelta = rhrBaseline > 0 ? (rhrBaseline / rhr - 1) * 100 : null;

    const sleepScore = sleepBaseline > 0 ? clamp(sleepMinutes / sleepBaseline, 0, 1.3) : 1;
    const hrvScore = hrvBaseline > 0 ? clamp(hrv / hrvBaseline, 0.7, 1.3) : 1;
    const rhrScore = rhrBaseline > 0 ? clamp(rhrBaseline / rhr, 0.7, 1.3) : 1;

    const rawRecovery = (sleepScore + hrvScore + rhrScore) / 3;
    const recoveryIndex = Math.round(clamp(rawRecovery, 0, 1.3) * 100);

    const now = new Date();
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(now.getDate() - 3);
    const recentLoad = workoutSummaries
      .filter(w => new Date(w.startTime) >= threeDaysAgo)
      .reduce((sum, w) => sum + (w.loadScore ?? 0), 0);

    const stressIndex = Math.round(clamp(recentLoad / 200, 0, 1) * 100);

    return {
      sleepDelta,
      hrvDelta,
      rhrDelta,
      recoveryIndex,
      stressIndex,
      recentLoad: Math.round(recentLoad),
    };
  }, [dailyMetrics, workoutSummaries]);

  const formatDelta = (value: number | null) => {
    if (value === null || Number.isNaN(value)) return '—';
    const rounded = Math.round(value);
    return `${rounded > 0 ? '+' : ''}${rounded}%`;
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <ThemedView style={styles.header} lightColor="transparent" darkColor="transparent">
        <ThemedText type="title">Stress & Erholung</ThemedText>
        <ThemedText style={styles.subtitle}>
          Vereinfachte Analyse mit HRV, Ruhepuls, Schlaf und Trainingslast.
        </ThemedText>
      </ThemedView>

      {error ? (
        <ThemedView style={styles.noticeCard} lightColor="#FFF5F5" darkColor="#2A1A1A">
          <ThemedText type="defaultSemiBold" style={styles.noticeTitle}>
            Etwas ist schiefgelaufen
          </ThemedText>
          <ThemedText type="default">{error}</ThemedText>
          <Button title="Erneut versuchen" onPress={processNewData} />
        </ThemedView>
      ) : null}

      <ThemedView style={styles.indexCard} lightColor="#FFFFFF" darkColor="#16191F">
        <ThemedText type="subtitle">Erholungsindex</ThemedText>
        <ThemedText style={styles.indexValue}>{derived.recoveryIndex}</ThemedText>
        <ThemedText style={styles.indexCaption}>0 = schwach, 100 = gut</ThemedText>
        <ThemedView style={styles.progressBar} lightColor="#F1F3F6" darkColor="#232833">
          <ThemedView
            style={[styles.progressFill, { width: `${derived.recoveryIndex}%` }]}
            lightColor="#B7E4C7"
            darkColor="#2D8A5E"
          />
        </ThemedView>
      </ThemedView>

      <ThemedView style={styles.indexCard} lightColor="#FFFFFF" darkColor="#16191F">
        <ThemedText type="subtitle">Stressindex (letzte 3 Tage)</ThemedText>
        <ThemedText style={styles.indexValue}>{derived.stressIndex}</ThemedText>
        <ThemedText style={styles.indexCaption}>
          Trainingslast: {derived.recentLoad} Punkte
        </ThemedText>
        <ThemedView style={styles.progressBar} lightColor="#F1F3F6" darkColor="#232833">
          <ThemedView
            style={[styles.progressFill, { width: `${derived.stressIndex}%` }]}
            lightColor="#FFB4A2"
            darkColor="#B23B2B"
          />
        </ThemedView>
      </ThemedView>

      <ThemedView style={styles.detailCard} lightColor="#FFFFFF" darkColor="#16191F">
        <ThemedText type="subtitle">Heute vs. 7‑Tage‑Baseline</ThemedText>
        <ThemedView style={styles.detailRow} lightColor="transparent" darkColor="transparent">
          <ThemedText>Schlaf</ThemedText>
          <ThemedText type="defaultSemiBold">{formatDelta(derived.sleepDelta)}</ThemedText>
        </ThemedView>
        <ThemedView style={styles.detailRow} lightColor="transparent" darkColor="transparent">
          <ThemedText>HRV</ThemedText>
          <ThemedText type="defaultSemiBold">{formatDelta(derived.hrvDelta)}</ThemedText>
        </ThemedView>
        <ThemedView style={styles.detailRow} lightColor="transparent" darkColor="transparent">
          <ThemedText>Ruhepuls</ThemedText>
          <ThemedText type="defaultSemiBold">{formatDelta(derived.rhrDelta)}</ThemedText>
        </ThemedView>
        <ThemedText style={styles.detailHint}>
          Positive Werte verbessern die Erholung pro Stunde.
        </ThemedText>
      </ThemedView>

      {isLoading ? (
        <ThemedText style={styles.loadingHint}>Lade Gesundheitsdaten…</ThemedText>
      ) : (
        <ThemedView style={styles.actionRow} lightColor="transparent" darkColor="transparent">
          <Button title="Daten aktualisieren" onPress={processNewData} />
        </ThemedView>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
    paddingBottom: 40,
    gap: 20,
  },
  header: {
    gap: 8,
  },
  subtitle: {
    opacity: 0.7,
  },
  noticeCard: {
    padding: 20,
    borderRadius: 20,
    gap: 12,
  },
  noticeTitle: {
    fontSize: 18,
  },
  indexCard: {
    padding: 20,
    borderRadius: 24,
    gap: 8,
  },
  indexValue: {
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '700',
  },
  indexCaption: {
    opacity: 0.7,
    fontSize: 13,
  },
  progressBar: {
    height: 10,
    borderRadius: 999,
    overflow: 'hidden',
    marginTop: 8,
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
  },
  detailCard: {
    padding: 20,
    borderRadius: 24,
    gap: 10,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  detailHint: {
    fontSize: 12,
    opacity: 0.6,
  },
  actionRow: {
    marginTop: 4,
  },
  loadingHint: {
    opacity: 0.7,
  },
});
