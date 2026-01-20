import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useRecoveryState } from '@/core/hooks/useRecoveryState';
import {
  calculateRecoveryModifier,
  estimateRecoveryHoursTotal,
  estimateRecoveryRemaining,
  getLatestWorkoutEnd,
} from '@/core/logic/epoc';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, Button, Pressable } from 'react-native';
import { useState } from 'react';

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
  const [windowDays, setWindowDays] = useState(30);

  const derived = useMemo(() => {
    if (workoutSummaries.length === 0) {
      return {
        hasWorkout: false,
        recoveryAdded: 0,
        recoveryRemaining: 0,
        modifier: 1,
        latestWorkoutEnd: null as Date | null,
        factors: null as null | ReturnType<typeof calculateRecoveryModifier>,
      };
    }

    const since = new Date();
    since.setDate(since.getDate() - windowDays);
    const recoveryAdded = estimateRecoveryHoursTotal(workoutSummaries, since);
    const factors = calculateRecoveryModifier(dailyMetrics, workoutSummaries);
    const recoveryRemaining = estimateRecoveryRemaining(
      workoutSummaries,
      since,
      factors.modifier
    );
    const latestWorkoutEnd = getLatestWorkoutEnd(workoutSummaries, since);

    return {
      hasWorkout: true,
      recoveryAdded,
      recoveryRemaining,
      modifier: factors.modifier,
      factors,
      latestWorkoutEnd,
    };
  }, [dailyMetrics, workoutSummaries, windowDays]);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <ThemedView style={styles.header} lightColor="transparent" darkColor="transparent">
        <ThemedText type="title">EPOC‑Erholung</ThemedText>
        <ThemedText style={styles.subtitle}>
          Schätzung nach HR‑Intensität und dynamischem Abbau.
        </ThemedText>
      </ThemedView>

      <ThemedView style={styles.segmented} lightColor="#FFFFFF" darkColor="#16191F">
        <ThemedText type="defaultSemiBold">Zeitraum</ThemedText>
        <ThemedView style={styles.segmentRow} lightColor="transparent" darkColor="transparent">
          {[7, 30, 90].map(days => {
            const active = windowDays === days;
            return (
              <Pressable key={days} onPress={() => setWindowDays(days)}>
                <ThemedView
                  style={[styles.segment, active ? styles.segmentActive : null]}
                  lightColor={active ? '#1F2933' : '#F1F3F6'}
                  darkColor={active ? '#E6ECFF' : '#232833'}
                >
                  <ThemedText
                    style={active ? styles.segmentTextActive : styles.segmentText}
                    lightColor={active ? '#FFFFFF' : '#1F2933'}
                    darkColor={active ? '#1A1C21' : '#E6ECFF'}
                  >
                    {days} Tage
                  </ThemedText>
                </ThemedView>
              </Pressable>
            );
          })}
        </ThemedView>
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
            <ThemedText type="subtitle">Letzte {windowDays} Tage</ThemedText>
            <ThemedText style={styles.cardValue}>
              {formatDuration(derived.recoveryAdded)}
            </ThemedText>
            <ThemedText style={styles.cardCaption}>
              Erholung hinzugefügt (EPOC‑Schätzung gesamt)
            </ThemedText>
          </ThemedView>

          <ThemedView style={styles.card} lightColor="#FFFFFF" darkColor="#16191F">
            <ThemedText type="subtitle">Aktuelle Erholungszeit</ThemedText>
            <ThemedText style={styles.cardValue}>
              {formatDuration(derived.recoveryRemaining)}
            </ThemedText>
            <ThemedText style={styles.cardCaption}>
              {derived.latestWorkoutEnd
                ? `Abgebaut seit ${derived.latestWorkoutEnd.toLocaleDateString('de-DE')} (${derived.latestWorkoutEnd.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })})`
                : 'Kein aktuelles Training im Zeitraum gefunden'}
              {' · '}Modifier {derived.modifier.toFixed(2)}
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
  segmented: {
    padding: 16,
    borderRadius: 18,
    gap: 10,
  },
  segmentRow: {
    flexDirection: 'row',
    gap: 10,
  },
  segment: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
  },
  segmentActive: {
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.12)',
  },
  segmentText: {
    fontSize: 13,
  },
  segmentTextActive: {
    fontSize: 13,
    fontWeight: '700',
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
