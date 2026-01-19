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
        label: 'Ready for intensity',
        description: 'Your body is primed for hard training.',
      },
      yellow: {
        color: '#F4B740',
        label: 'Train moderately',
        description: 'Keep it steady and avoid max efforts.',
      },
      red: {
        color: '#FF6B6B',
        label: 'Focus on recovery',
        description: 'Your system needs more rest before intensity.',
      },
    };
    return configs[lastRecoveryState.status] ?? configs.green;
  }, [lastRecoveryState.status]);

  const recoveryHours = Math.max(0, Math.round(lastRecoveryState.recoveryHoursRemaining));
  const readyTimeLabel = lastRecoveryState.readyForHardTrainingAt
    ? new Date(lastRecoveryState.readyForHardTrainingAt).toLocaleString()
    : 'Ready any time';
  const debtScore = Math.max(0, Math.round(lastRecoveryState.debtScore));
  const breakdown = lastRecoveryState.explanationBreakdown;

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
            Something went wrong
          </ThemedText>
          <ThemedText type="default">{error}</ThemedText>
        </ThemedView>
      );
    }

    if (!isHealthKitAvailable) {
      return (
        <>
          <ThemedView style={styles.noticeCard} lightColor="#FFF8E5" darkColor="#2A2210">
            <ThemedText type="defaultSemiBold" style={styles.noticeTitle}>
              Health data unavailable
            </ThemedText>
            <ThemedText type="default">
              HealthKit is not available on this device. Connect Apple Health to unlock recovery.
            </ThemedText>
          </ThemedView>
          <ThemedView style={styles.debugCard} lightColor="#FFFFFF" darkColor="#16191F">
            <ThemedText type="defaultSemiBold" style={styles.noticeTitle}>
              HealthKit debug
            </ThemedText>
            <ThemedView lightColor="transparent" darkColor="transparent" style={styles.debugRow}>
              <ThemedText>Module available</ThemedText>
              <ThemedText type="defaultSemiBold">
                {healthDebug?.moduleAvailable ? 'yes' : 'no'}
              </ThemedText>
            </ThemedView>
            <ThemedView lightColor="transparent" darkColor="transparent" style={styles.debugRow}>
              <ThemedText>HealthKit available</ThemedText>
              <ThemedText type="defaultSemiBold">
                {healthDebug?.isAvailable === undefined
                  ? 'unknown'
                  : healthDebug.isAvailable
                    ? 'yes'
                    : 'no'}
              </ThemedText>
            </ThemedView>
            {healthDebug?.error ? (
              <ThemedText type="default">{healthDebug.error}</ThemedText>
            ) : null}
            <Button title="Check HealthKit" onPress={checkHealthKitStatus} />
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
              <ThemedText type="defaultSemiBold">Ready for hard training</ThemedText>
              <ThemedText style={styles.readyTime}>{readyTimeLabel}</ThemedText>
            </ThemedView>
          </ThemedView>
        </ThemedView>

        <ThemedView style={styles.metricsGrid} lightColor="transparent" darkColor="transparent">
          <ThemedView style={styles.metricCard} lightColor="#F4F6FF" darkColor="#1E2430">
            <ThemedText type="defaultSemiBold">Recovery debt</ThemedText>
            <ThemedText style={styles.metricValue}>{debtScore}</ThemedText>
            <ThemedText style={styles.metricCaption}>Load points remaining</ThemedText>
          </ThemedView>
          <ThemedView style={styles.metricCard} lightColor="#F3FFF9" darkColor="#15261E">
            <ThemedText type="defaultSemiBold">Status</ThemedText>
            <ThemedText style={[styles.metricValue, { color: statusConfig.color }]}>
              {lastRecoveryState.status.toUpperCase()}
            </ThemedText>
            <ThemedText style={styles.metricCaption}>Training readiness</ThemedText>
          </ThemedView>
        </ThemedView>

        <ThemedView style={styles.breakdownCard} lightColor="#FFFFFF" darkColor="#16191F">
          <ThemedView style={styles.breakdownHeader} lightColor="transparent" darkColor="transparent">
            <ThemedText type="subtitle">Why this recovery?</ThemedText>
            <ThemedText style={styles.breakdownCaption}>Latest inputs applied</ThemedText>
          </ThemedView>
          <ThemedView style={styles.breakdownRow} lightColor="transparent" darkColor="transparent">
            <ThemedText>Last workout load</ThemedText>
            <ThemedText type="defaultSemiBold">
              {breakdown?.lastWorkoutLoad ? Math.round(breakdown.lastWorkoutLoad) : '—'}
            </ThemedText>
          </ThemedView>
          <ThemedView style={styles.breakdownRow} lightColor="transparent" darkColor="transparent">
            <ThemedText>Sleep impact</ThemedText>
            <ThemedText type="defaultSemiBold">{formatModifier(breakdown?.sleepModifier)}</ThemedText>
          </ThemedView>
          <ThemedView style={styles.breakdownRow} lightColor="transparent" darkColor="transparent">
            <ThemedText>HRV trend</ThemedText>
            <ThemedText type="defaultSemiBold">{formatModifier(breakdown?.hrvModifier)}</ThemedText>
          </ThemedView>
          <ThemedView style={styles.breakdownRow} lightColor="transparent" darkColor="transparent">
            <ThemedText>Resting HR</ThemedText>
            <ThemedText type="defaultSemiBold">{formatModifier(breakdown?.rhrModifier)}</ThemedText>
          </ThemedView>
          <ThemedView style={styles.breakdownRow} lightColor="transparent" darkColor="transparent">
            <ThemedText>Learning phase</ThemedText>
            <ThemedText type="defaultSemiBold">
              {formatModifier(breakdown?.learningModifier)}
            </ThemedText>
          </ThemedView>
        </ThemedView>

        <ThemedView style={styles.actionRow} lightColor="transparent" darkColor="transparent">
          <Button title="Refresh data" onPress={processNewData} />
        </ThemedView>
      </>
    );
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <ThemedView style={styles.header} lightColor="transparent" darkColor="transparent">
        <ThemedText type="title">Recovery</ThemedText>
        <ThemedText style={styles.headerSubtitle}>
          Stay in tune with your training readiness.
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
