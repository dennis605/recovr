import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useRecoveryState } from '@/core/hooks/useRecoveryState';
import { calculateRecoveryModifier, estimateRecoveryHoursAdded } from '@/core/logic/epoc';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, Button } from 'react-native';

const formatHours = (value: number) => `${value.toFixed(1)} h`;

const formatDuration = (hours: number) => {
  if (!Number.isFinite(hours)) return '—';
  if (hours >= 48) {
    return `${(hours / 24).toFixed(1)} Tage`;
  }
  return formatHours(hours);
};

export default function EpocScreen() {
  const { workoutSummaries, dailyMetrics, isLoading, error, processNewData } =
    useRecoveryState();

  const derived = useMemo(() => {
    const latestWorkout = [...workoutSummaries].sort(
      (a, b) => new Date(b.endTime).getTime() - new Date(a.endTime).getTime()
    )[0];

    if (!latestWorkout) {
      return {
        hasWorkout: false,
        recoveryAdded: 0,
        recoveryRemaining: 0,
        modifier: 1,
        factors: null as null | ReturnType<typeof calculateRecoveryModifier>,
      };
    }

    const recoveryAdded = estimateRecoveryHoursAdded(latestWorkout);
    const factors = calculateRecoveryModifier(dailyMetrics, workoutSummaries);
    const hoursSince = Math.max(
      0,
      (Date.now() - new Date(latestWorkout.endTime).getTime()) / (1000 * 60 * 60)
    );
    const recoveryRemaining = Math.max(0, recoveryAdded - hoursSince * factors.modifier);

    return {
      hasWorkout: true,
      recoveryAdded,
      recoveryRemaining,
      modifier: factors.modifier,
      factors,
      workout: latestWorkout,
      hoursSince,
    };
  }, [dailyMetrics, workoutSummaries]);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <ThemedView style={styles.header} lightColor="transparent" darkColor="transparent">
        <ThemedText type="title">EPOC‑Erholung</ThemedText>
        <ThemedText style={styles.subtitle}>
          Schätzung nach HR‑Intensität und dynamischem Abbau.
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

      {!derived.hasWorkout ? (
        <ThemedView style={styles.noticeCard} lightColor="#FFF8E5" darkColor="#2A2210">
          <ThemedText type="defaultSemiBold" style={styles.noticeTitle}>
            Keine Workouts gefunden
          </ThemedText>
          <ThemedText type="default">
            Für die EPOC‑Schätzung brauchen wir mindestens ein Training.
          </ThemedText>
        </ThemedView>
      ) : (
        <>
          <ThemedView style={styles.card} lightColor="#FFFFFF" darkColor="#16191F">
            <ThemedText type="subtitle">Letztes Training</ThemedText>
            <ThemedText style={styles.cardValue}>
              {formatDuration(derived.recoveryAdded)}
            </ThemedText>
            <ThemedText style={styles.cardCaption}>
              Erholung hinzugefügt (EPOC‑Schätzung)
            </ThemedText>
          </ThemedView>

          <ThemedView style={styles.card} lightColor="#FFFFFF" darkColor="#16191F">
            <ThemedText type="subtitle">Aktuelle Erholungszeit</ThemedText>
            <ThemedText style={styles.cardValue}>
              {formatDuration(derived.recoveryRemaining)}
            </ThemedText>
            <ThemedText style={styles.cardCaption}>
              Abgebaut seit {formatDuration(derived.hoursSince ?? 0)} mit Modifier{' '}
              {derived.modifier.toFixed(2)}
            </ThemedText>
          </ThemedView>

          <ThemedView style={styles.card} lightColor="#FFFFFF" darkColor="#16191F">
            <ThemedText type="subtitle">Recovery‑Modifier (M)</ThemedText>
            <ThemedView style={styles.detailRow} lightColor="transparent" darkColor="transparent">
              <ThemedText>Schlaf</ThemedText>
              <ThemedText type="defaultSemiBold">
                {derived.factors?.sleepFactor.toFixed(2) ?? '—'}
              </ThemedText>
            </ThemedView>
            <ThemedView style={styles.detailRow} lightColor="transparent" darkColor="transparent">
              <ThemedText>HRV</ThemedText>
              <ThemedText type="defaultSemiBold">
                {derived.factors?.hrvFactor.toFixed(2) ?? '—'}
              </ThemedText>
            </ThemedView>
            <ThemedView style={styles.detailRow} lightColor="transparent" darkColor="transparent">
              <ThemedText>Ruhepuls</ThemedText>
              <ThemedText type="defaultSemiBold">
                {derived.factors?.rhrFactor.toFixed(2) ?? '—'}
              </ThemedText>
            </ThemedView>
            <ThemedView style={styles.detailRow} lightColor="transparent" darkColor="transparent">
              <ThemedText>Stressfaktor</ThemedText>
              <ThemedText type="defaultSemiBold">
                {derived.factors?.stressFactor.toFixed(2) ?? '—'}
              </ThemedText>
            </ThemedView>
          </ThemedView>
        </>
      )}

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
  card: {
    padding: 20,
    borderRadius: 24,
    gap: 8,
  },
  cardValue: {
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '700',
  },
  cardCaption: {
    opacity: 0.7,
    fontSize: 13,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionRow: {
    marginTop: 4,
  },
  loadingHint: {
    opacity: 0.7,
  },
});
