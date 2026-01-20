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
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isHealthKitAvailable, setIsHealthKitAvailable] = useState(false);
  const [healthDebug, setHealthDebug] =
    useState<HealthService.HealthKitDebugStatus | null>(null);

  // Effect to initialize HealthKit on mount
  useEffect(() => {
    const init = async () => {
      try {
        setIsHealthKitAvailable(HealthService.isHealthKitModuleAvailable());
        setIsLoading(false);
      } catch (e: any) {
        setError(e.message || 'Ein unbekannter Fehler ist aufgetreten.');
        setIsLoading(false);
      }
    };

    init();
  }, []);

  const checkHealthKitStatus = async () => {
    const status = await HealthService.getHealthKitStatus();
    setHealthDebug(status);
  };
  
  const withTimeout = <T,>(promise: Promise<T>, timeoutMs: number, label: string) => {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error(`${label} (${Math.round(timeoutMs / 1000)}s)`));
      }, timeoutMs);
    });
    return Promise.race([promise, timeoutPromise]).finally(() => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }) as Promise<T>;
  };

  // Function to process new data and update the state
  const processNewData = async (options?: { force?: boolean }) => {
    if (!options?.force && !isHealthKitAvailable) return;
    
    setIsLoading(true);
    try {
        console.log('[HealthKit] refresh:start');
        setError(null);
        if (!HealthService.isHealthKitModuleAvailable()) {
          setIsHealthKitAvailable(false);
          throw new Error('HealthKit ist auf diesem Gerät nicht verfügbar.');
        }
        console.log('[HealthKit] init:start');
        const didInit = await withTimeout(
          HealthService.initializeHealthKit(),
          15000,
          'HealthKit-Initialisierung zu lange'
        );
        console.log('[HealthKit] init:done', { didInit });
        setIsHealthKitAvailable(didInit);
        if (!didInit) {
          throw new Error('HealthKit konnte nicht initialisiert werden.');
        }

        const errors: string[] = [];
        const safeFetch = async <T,>(label: string, fetcher: () => Promise<T>) => {
          try {
            return await withTimeout(fetcher(), 10000, `${label} zu lange`);
          } catch (fetchError: any) {
            errors.push(fetchError?.message ?? label);
            return [] as unknown as T;
          }
        };

        // 1. Fetch baseline metrics (last 7 days, capped)
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const baseOptions = { startDate: sevenDaysAgo.toISOString() };
        const threeDaysAgo = new Date();
        threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
        const sleepOptions = { startDate: threeDaysAgo.toISOString() };

        console.log('[HealthKit] fetch:rhr:start', baseOptions);
        const rhr = await safeFetch('Ruhepuls-Abfrage', () =>
          HealthService.fetchRestingHeartRate(baseOptions)
        );
        console.log('[HealthKit] fetch:rhr:done', { count: rhr.length });

        console.log('[HealthKit] fetch:sleep:start', sleepOptions);
        const sleep = await safeFetch('Schlaf-Abfrage', () =>
          HealthService.fetchSleep(sleepOptions)
        );
        console.log('[HealthKit] fetch:sleep:done', { count: sleep.length });

        console.log('[HealthKit] fetch:hrv:start', baseOptions);
        const hrv = await safeFetch('HRV-Abfrage', () =>
          HealthService.fetchHrv(baseOptions)
        );
        console.log('[HealthKit] fetch:hrv:done', { count: hrv.length });

        // 2. Fetch workouts (last 3 days) to reduce load
        const workoutOptions = { startDate: threeDaysAgo.toISOString() };
        console.log('[HealthKit] fetch:workouts:start', workoutOptions);
        const workouts = await safeFetch('Workouts-Abfrage', () =>
          HealthService.fetchWorkouts(workoutOptions)
        );
        console.log('[HealthKit] fetch:workouts:done', { count: workouts.length });

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
        const workoutSlice = workouts.slice(0, 20);
        console.log('[HealthKit] process:workouts', { count: workoutSlice.length });
        const newWorkoutSummaries: WorkoutSummary[] = await Promise.all(
          workoutSlice.map(async (w, index) => {
            console.log('[HealthKit] workout:start', { index, start: w.startDate, end: w.endDate });
            const durationInSeconds =
              (new Date(w.endDate).getTime() - new Date(w.startDate).getTime()) / 1000;
            const durationMinutes = durationInSeconds / 60;
            const workoutDateKey = formatDateKey(new Date(w.startDate));
            const dailyMetric = dailyMetricsByDate.get(workoutDateKey);

            const shouldFetchHeartRate = false;
            const heartRateSamples: any[] = [];

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

            console.log('[HealthKit] workout:done', {
              index,
              hrFetched: shouldFetchHeartRate,
              hrSamples: normalizedHeartRateSamples.length,
              loadScore: loadResult.loadScore,
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

        console.log('[HealthKit] refresh:done', {
          workouts: workouts.length,
          rhr: rhr.length,
          hrv: hrv.length,
          sleep: sleep.length,
          errors,
        });
        if (errors.length > 0 && workouts.length === 0 && rhr.length === 0 && hrv.length === 0 && sleep.length === 0) {
          setError(`HealthKit liefert keine Daten. ${errors.join(' · ')}`);
        }
    } catch (e: any) {
        console.log('[HealthKit] refresh:error', e);
        setError(e.message || 'Daten konnten nicht verarbeitet werden.');
    } finally {
        console.log('[HealthKit] refresh:end');
        setIsLoading(false);
    }
  };

  return {
    ...appData,
    isLoading,
    error,
    isHealthKitAvailable,
    healthDebug,
    checkHealthKitStatus,
    processNewData,
  };
};
