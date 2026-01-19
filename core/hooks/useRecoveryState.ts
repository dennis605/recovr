// core/hooks/useRecoveryState.ts
import { useState, useEffect } from 'react';
import { AppData, RecoveryState, WorkoutSummary, DailyMetrics } from '../models/types';
import * as HealthService from '../services/health';
import { calculateNewRecoveryState } from '../logic/recovery';

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

        // 2. Transform raw data into our data models (WorkoutSummary, DailyMetrics)
        // This is a placeholder for a more complex transformation logic.
        // For example, we'd need to get HR samples for each workout to calculate zones.
        const newWorkoutSummaries: WorkoutSummary[] = workouts.map(w => ({
            id: w.uuid,
            type: w.activityName,
            startTime: w.startDate,
            endTime: w.endDate,
            durationInSeconds: (new Date(w.endDate).getTime() - new Date(w.startDate).getTime()) / 1000,
            // TODO: Calculate real zone minutes and load score
            zoneMinutes: { z1: 0, z2: 0, z3: 0, z4: 0, z5: 0 },
            loadScore: (w.calories || 50) * 0.5, // Dummy load score
        }));

        const newDailyMetrics: DailyMetrics[] = []; // Dummy daily metrics
        
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
