// core/hooks/useRecoveryState.ts
import { useState, useEffect } from 'react';
import { AppData, RecoveryState, WorkoutSummary, DailyMetrics } from '../models/types';
import * as HealthService from '../services/health';
import { calculateNewRecoveryState } from '../logic/recovery';
import { calculateWorkoutLoadFromInputs, HeartRateSample } from '../logic/load';

const formatDateKey = (date: Date) => date.toISOString().slice(0, 10);

const toNumericValue = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const getAverageHeartRate = (samples: HeartRateSample[]) => {
  if (samples.length === 0) return undefined;
  const total = samples.reduce((sum, sample) => sum + sample.value, 0);
  return total / samples.length;
};

const aggregateDailyMetrics = (
  rhrSamples: any[],
  hrvSamples: any[],
  sleepSamples: any[]
): DailyMetrics[] => {
  const dailyMap = new Map<string, DailyMetrics>();

  const getOrCreate = (dateKey: string) => {
    const existing = dailyMap.get(dateKey);
    if (existing) return existing;
    const entry: DailyMetrics = { date: dateKey };
    dailyMap.set(dateKey, entry);
    return entry;
  };

  rhrSamples.forEach(sample => {
    const dateKey = formatDateKey(new Date(sample.startDate ?? sample.date ?? Date.now()));
    const value = Number(sample.value ?? sample.restingHeartRate);
    if (!Number.isFinite(value)) return;
    const entry = getOrCreate(dateKey);
    entry.restingHeartRate = value;
  });

  hrvSamples.forEach(sample => {
    const dateKey = formatDateKey(new Date(sample.startDate ?? sample.date ?? Date.now()));
    const value = Number(sample.value ?? sample.hrv);
    if (!Number.isFinite(value)) return;
    const entry = getOrCreate(dateKey);
    entry.hrvSdn = value;
  });

  sleepSamples.forEach(sample => {
    const start = new Date(sample.startDate ?? Date.now());
    const end = new Date(sample.endDate ?? sample.startDate ?? Date.now());
    const minutes = Math.max(0, (end.getTime() - start.getTime()) / (1000 * 60));
    if (minutes <= 0) return;
    const dateKey = formatDateKey(start);
    const entry = getOrCreate(dateKey);
    entry.sleepInMinutes = (entry.sleepInMinutes ?? 0) + minutes;
  });

  return Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date));
};

// Initial empty state for the application
const initialAppData: AppData = {
  userProfile: { id: 'localUser' },
  workoutSummaries: [],
  dailyMetrics: [],
  lastRecoveryState: {
    timestamp: new Date().toISOString(),
    debtScore: 0,
    recoveryHoursRemaining: 0,
    status: 'green',
  },
};

export const useRecoveryState = () => {
  const [appData, setAppData] = useState<AppData>(initialAppData);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isHealthKitAvailable, setIsHealthKitAvailable] = useState(false);

  // Effect to initialize HealthKit on mount
  useEffect(() => {
    const init = async () => {
      try {
        await HealthService.initializeHealthKit();
        setIsHealthKitAvailable(true);
        // Initial data fetch can be triggered here
        // For now, we just stop loading
        setIsLoading(false);
      } catch (e: any) {
        setError(e.message || 'An unknown error occurred.');
        setIsLoading(false);
      }
    };

    init();
  }, []);
  
  // Function to process new data and update the state
  const processNewData = async () => {
    if (!isHealthKitAvailable) return;
    
    setIsLoading(true);
    try {
        // 1. Fetch new raw data from HealthKit (e.g., last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const options = { startDate: thirtyDaysAgo.toISOString() };

        const [workouts, rhr, hrv, sleep] = await Promise.all([
            HealthService.fetchWorkouts(options),
            HealthService.fetchRestingHeartRate(options),
            HealthService.fetchHrv(options),
            HealthService.fetchSleep(options)
        ]);

        const newDailyMetrics: DailyMetrics[] = aggregateDailyMetrics(
          rhr,
          hrv,
          sleep
        );
        const dailyMetricsByDate = new Map(
          newDailyMetrics.map(metric => [metric.date, metric])
        );

        // 2. Transform raw data into our data models (WorkoutSummary, DailyMetrics)
        // This is a placeholder for a more complex transformation logic.
        // For example, we'd need to get HR samples for each workout to calculate zones.
        const newWorkoutSummaries: WorkoutSummary[] = await Promise.all(
          workouts.map(async w => {
            const durationInSeconds =
              (new Date(w.endDate).getTime() - new Date(w.startDate).getTime()) / 1000;
            const durationMinutes = durationInSeconds / 60;
            const workoutDateKey = formatDateKey(new Date(w.startDate));
            const dailyMetric = dailyMetricsByDate.get(workoutDateKey);

            const heartRateSamples = await HealthService.fetchHeartRateSamples({
              startDate: w.startDate,
              endDate: w.endDate,
            });

            const normalizedHeartRateSamples: HeartRateSample[] = heartRateSamples
              .map(sample => ({
                startDate: sample.startDate ?? w.startDate,
                endDate: sample.endDate ?? w.endDate,
                value: toNumericValue(sample.value) ?? 0,
              }))
              .filter(sample => sample.value > 0);

            const avgHeartRate = getAverageHeartRate(normalizedHeartRateSamples);
            const loadResult = calculateWorkoutLoadFromInputs({
              durationMinutes,
              workoutType: w.activityName,
              heartRateSamples: normalizedHeartRateSamples,
              hrMax: appData.userProfile.hrMax,
              avgHeartRate,
              restingHeartRate: dailyMetric?.restingHeartRate,
            });

            return {
              id: w.uuid,
              type: w.activityName,
              startTime: w.startDate,
              endTime: w.endDate,
              durationInSeconds,
              zoneMinutes: loadResult.zoneMinutes,
              loadScore: loadResult.loadScore,
            };
          })
        );
        
        // 3. Recalculate the recovery state
        // In a real scenario, we'd find the latest workout and apply it.
        const latestWorkout = newWorkoutSummaries.sort((a,b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())[0];
        
        const newState = calculateNewRecoveryState(
            appData.lastRecoveryState,
            newDailyMetrics,
            latestWorkout
        );

        // 4. Update the app state
        setAppData(prevData => ({
            ...prevData,
            workoutSummaries: newWorkoutSummaries,
            dailyMetrics: newDailyMetrics,
            lastRecoveryState: newState,
        }));

    } catch (e: any) {
        setError(e.message || 'Failed to process new data.');
    } finally {
        setIsLoading(false);
    }
  };

  return {
    ...appData,
    isLoading,
    error,
    isHealthKitAvailable,
    processNewData,
  };
};
