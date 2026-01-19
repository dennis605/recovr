import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { useRecoveryState } from '@/core/hooks/useRecoveryState';
import { useMemo } from 'react';
import { StyleSheet, Button, ActivityIndicator, ScrollView } from 'react-native';

export default function HomeScreen() {
  const {
    lastRecoveryState,
    isLoading,
    error,
    isHealthKitAvailable,
    healthDebug,
    checkHealthKitStatus,
    processNewData,
  } = useRecoveryState();

  const statusConfig = useMemo(() => {
    const configs = {
      green: {
        color: '#20C997',
        label: 'Bereit für Intensität',
        description: 'Dein Körper ist bereit für hartes Training.',
      },
      yellow: {
        color: '#F4B740',
        label: 'Moderat trainieren',
        description: 'Halte das Tempo konstant und vermeide Maximalbelastung.',
      },
      red: {
        color: '#FF6B6B',
        label: 'Erholung priorisieren',
        description: 'Dein Körper braucht mehr Ruhe vor intensiven Einheiten.',
      },
    };
    return configs[lastRecoveryState.status] ?? configs.green;
  }, [lastRecoveryState.status]);

  const recoveryHours = Math.max(0, Math.round(lastRecoveryState.recoveryHoursRemaining));
  const readyTimeLabel = lastRecoveryState.readyForHardTrainingAt
    ? new Date(lastRecoveryState.readyForHardTrainingAt).toLocaleString('de-DE')
    : 'Jederzeit bereit';
  const debtScore = Math.max(0, Math.round(lastRecoveryState.debtScore));
  const breakdown = lastRecoveryState.explanationBreakdown;
  const statusLabelMap = {
    green: 'GRÜN',
    yellow: 'GELB',
    red: 'ROT',
  };

  const formatModifier = (value?: number) => {
    if (value === undefined) return '—';
    const formatted = Math.round(value * 100);
    return `${formatted > 0 ? '+' : ''}${formatted}%`;
  };

  const renderContent = () => {
    if (isLoading) {
      return <ActivityIndicator size="large" style={styles.loading} />;
    }

    if (error) {
      return (
        <ThemedView style={styles.noticeCard} lightColor="#FFF5F5" darkColor="#2A1A1A">
          <ThemedText type="defaultSemiBold" style={styles.noticeTitle}>
            Etwas ist schiefgelaufen
          </ThemedText>
          <ThemedText type="default">{error}</ThemedText>
          <ThemedView style={styles.retryRow} lightColor="transparent" darkColor="transparent">
            <Button title="Erneut versuchen" onPress={processNewData} />
          </ThemedView>
        </ThemedView>
      );
    }

    if (!isHealthKitAvailable) {
      return (
        <>
          <ThemedView style={styles.noticeCard} lightColor="#FFF8E5" darkColor="#2A2210">
            <ThemedText type="defaultSemiBold" style={styles.noticeTitle}>
              Gesundheitsdaten nicht verfügbar
            </ThemedText>
            <ThemedText type="default">
              HealthKit ist auf diesem Gerät nicht verfügbar. Verbinde Apple Health, um die Erholung zu sehen.
            </ThemedText>
          </ThemedView>
          <ThemedView style={styles.debugCard} lightColor="#FFFFFF" darkColor="#16191F">
            <ThemedText type="defaultSemiBold" style={styles.noticeTitle}>
              HealthKit-Debug
            </ThemedText>
            <ThemedView lightColor="transparent" darkColor="transparent" style={styles.debugRow}>
              <ThemedText>Modul verfügbar</ThemedText>
              <ThemedText type="defaultSemiBold">
                {healthDebug?.moduleAvailable ? 'yes' : 'no'}
              </ThemedText>
            </ThemedView>
            <ThemedView lightColor="transparent" darkColor="transparent" style={styles.debugRow}>
              <ThemedText>HealthKit verfügbar</ThemedText>
              <ThemedText type="defaultSemiBold">
                {healthDebug?.isAvailable === undefined
                  ? 'unbekannt'
                  : healthDebug.isAvailable
                    ? 'ja'
                    : 'nein'}
              </ThemedText>
            </ThemedView>
            {healthDebug?.error ? (
              <ThemedText type="default">{healthDebug.error}</ThemedText>
            ) : null}
            <Button title="HealthKit prüfen" onPress={checkHealthKitStatus} />
          </ThemedView>
        </>
      );
    }

    return (
      <>
        <ThemedView style={styles.statusCard} lightColor="#FFFFFF" darkColor="#16191F">
          <ThemedView
            style={[styles.statusBadge, { backgroundColor: statusConfig.color }]}
            lightColor="transparent"
            darkColor="transparent"
          >
            <ThemedText style={styles.statusBadgeText}>
              {recoveryHours > 0 ? `${recoveryHours}h` : '✓'}
            </ThemedText>
          </ThemedView>
          <ThemedView style={styles.statusInfo} lightColor="transparent" darkColor="transparent">
            <ThemedText type="subtitle">{statusConfig.label}</ThemedText>
            <ThemedText style={styles.statusDescription}>{statusConfig.description}</ThemedText>
            <ThemedView style={styles.readyRow} lightColor="transparent" darkColor="transparent">
              <ThemedText type="defaultSemiBold">Bereit für hartes Training</ThemedText>
              <ThemedText style={styles.readyTime}>{readyTimeLabel}</ThemedText>
            </ThemedView>
          </ThemedView>
        </ThemedView>

        <ThemedView style={styles.metricsGrid} lightColor="transparent" darkColor="transparent">
          <ThemedView style={styles.metricCard} lightColor="#F4F6FF" darkColor="#1E2430">
            <ThemedText type="defaultSemiBold">Erholungsdefizit</ThemedText>
            <ThemedText style={styles.metricValue}>{debtScore}</ThemedText>
            <ThemedText style={styles.metricCaption}>Belastungspunkte verbleibend</ThemedText>
          </ThemedView>
          <ThemedView style={styles.metricCard} lightColor="#F3FFF9" darkColor="#15261E">
            <ThemedText type="defaultSemiBold">Status</ThemedText>
            <ThemedText style={[styles.metricValue, { color: statusConfig.color }]}>
              {statusLabelMap[lastRecoveryState.status]}
            </ThemedText>
            <ThemedText style={styles.metricCaption}>Trainingsbereitschaft</ThemedText>
          </ThemedView>
        </ThemedView>

        <ThemedView style={styles.breakdownCard} lightColor="#FFFFFF" darkColor="#16191F">
          <ThemedView style={styles.breakdownHeader} lightColor="transparent" darkColor="transparent">
            <ThemedText type="subtitle">Warum diese Erholung?</ThemedText>
            <ThemedText style={styles.breakdownCaption}>Letzte Eingaben angewendet</ThemedText>
          </ThemedView>
          <ThemedView style={styles.breakdownRow} lightColor="transparent" darkColor="transparent">
            <ThemedText>Letzte Trainingslast</ThemedText>
            <ThemedText type="defaultSemiBold">
              {breakdown?.lastWorkoutLoad ? Math.round(breakdown.lastWorkoutLoad) : '—'}
            </ThemedText>
          </ThemedView>
          <ThemedView style={styles.breakdownRow} lightColor="transparent" darkColor="transparent">
            <ThemedText>Schlaf-Einfluss</ThemedText>
            <ThemedText type="defaultSemiBold">{formatModifier(breakdown?.sleepModifier)}</ThemedText>
          </ThemedView>
          <ThemedView style={styles.breakdownRow} lightColor="transparent" darkColor="transparent">
            <ThemedText>HRV-Trend</ThemedText>
            <ThemedText type="defaultSemiBold">{formatModifier(breakdown?.hrvModifier)}</ThemedText>
          </ThemedView>
          <ThemedView style={styles.breakdownRow} lightColor="transparent" darkColor="transparent">
            <ThemedText>Ruhepuls</ThemedText>
            <ThemedText type="defaultSemiBold">{formatModifier(breakdown?.rhrModifier)}</ThemedText>
          </ThemedView>
          <ThemedView style={styles.breakdownRow} lightColor="transparent" darkColor="transparent">
            <ThemedText>Lernphase</ThemedText>
            <ThemedText type="defaultSemiBold">
              {formatModifier(breakdown?.learningModifier)}
            </ThemedText>
          </ThemedView>
        </ThemedView>

        <ThemedView style={styles.actionRow} lightColor="transparent" darkColor="transparent">
          <Button title="Daten aktualisieren" onPress={processNewData} />
        </ThemedView>
      </>
    );
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <ThemedView style={styles.header} lightColor="transparent" darkColor="transparent">
        <ThemedText type="title">Erholung</ThemedText>
        <ThemedText style={styles.headerSubtitle}>
          Behalte deine Trainingsbereitschaft im Blick.
        </ThemedText>
      </ThemedView>
      {renderContent()}
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
  headerSubtitle: {
    opacity: 0.7,
  },
  loading: {
    marginTop: 20,
  },
  statusCard: {
    padding: 20,
    borderRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 2,
  },
  statusBadge: {
    width: 90,
    height: 90,
    borderRadius: 45,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusBadgeText: {
    fontSize: 32,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  statusInfo: {
    flex: 1,
    gap: 6,
  },
  statusDescription: {
    opacity: 0.7,
  },
  readyRow: {
    marginTop: 8,
    gap: 4,
  },
  readyTime: {
    opacity: 0.8,
  },
  metricsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  metricCard: {
    flex: 1,
    padding: 16,
    borderRadius: 18,
    gap: 6,
  },
  metricValue: {
    fontSize: 28,
    fontWeight: '700',
  },
  metricCaption: {
    opacity: 0.7,
    fontSize: 13,
  },
  breakdownCard: {
    padding: 20,
    borderRadius: 22,
    gap: 12,
  },
  breakdownHeader: {
    gap: 4,
  },
  breakdownCaption: {
    opacity: 0.6,
    fontSize: 13,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionRow: {
    marginTop: 4,
  },
  retryRow: {
    marginTop: 8,
  },
  noticeCard: {
    padding: 20,
    borderRadius: 20,
    gap: 8,
  },
  noticeTitle: {
    fontSize: 18,
  },
  debugCard: {
    padding: 20,
    borderRadius: 20,
    gap: 12,
  },
  debugRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  }
});
