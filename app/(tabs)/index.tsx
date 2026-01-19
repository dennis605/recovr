import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { useRecoveryState } from '@/core/hooks/useRecoveryState';
import { StyleSheet, Button, ActivityIndicator, Platform } from 'react-native';

export default function HomeScreen() {
  const {
    lastRecoveryState,
    isLoading,
    error,
    isHealthKitAvailable,
    processNewData,
  } = useRecoveryState();

  const getStatusColor = (status: 'green' | 'yellow' | 'red') => {
    const colors = {
      green: '#28a745',
      yellow: '#ffc107',
      red: '#dc3545',
    };
    return colors[status] || '#ccc';
  };
  
  const recoveryHours = Math.round(lastRecoveryState.recoveryHoursRemaining);

  const renderContent = () => {
    if (isLoading) {
      return <ActivityIndicator size="large" />;
    }

    if (error) {
      return <ThemedText type="default">Error: {error}</ThemedText>;
    }

    if (!isHealthKitAvailable) {
      return <ThemedText type="default">HealthKit is not available on this device.</ThemedText>;
    }

    return (
      <>
        <ThemedView
          style={[
            styles.statusCircle,
            { backgroundColor: getStatusColor(lastRecoveryState.status) },
          ]}
        >
          {recoveryHours > 0 ? (
            <ThemedText style={styles.statusText}>{recoveryHours}h</ThemedText>
          ) : (
            <ThemedText style={styles.statusText}>✓</ThemedText>
          )}
        </ThemedView>
        <ThemedText type="subtitle" style={styles.subtitle}>
          Recovery Time
        </ThemedText>
        {lastRecoveryState.readyForHardTrainingAt ? (
            <ThemedText style={styles.dateText}>
                Ready for hard training at: {' '}
                {new Date(lastRecoveryState.readyForHardTrainingAt).toLocaleTimeString()}
            </ThemedText>
        ) : (
            <ThemedText style={styles.dateText}>Ready for anything!</ThemedText>
        )}
        <Button title="Refresh Data" onPress={processNewData} />
      </>
    );
  };

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title">Your Recovery</ThemedText>
      {renderContent()}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  statusCircle: {
    width: 200,
    height: 200,
    borderRadius: 100,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 20,
  },
  statusText: {
    fontSize: 64,
    fontWeight: 'bold',
    color: '#fff',
  },
  subtitle: {
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 10,
  },
  dateText: {
    fontSize: 16,
    marginBottom: 20,
  }
});
