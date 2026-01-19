// core/models/types.ts

/**
 * Represents the user's configuration and profile data.
 * In the local-only MVP, this might be stored in AsyncStorage.
 */
export interface UserProfile {
  id: string; // A local unique ID
  hrMax?: number;
  // Further configuration can be added here.
}

/**
 * Represents a single, aggregated workout summary processed from HealthKit data.
 */
export interface WorkoutSummary {
  id: string; // HealthKit UUID
  type: string;
  startTime: string; // ISO 8601 string
  endTime: string; // ISO 8601 string
  durationInSeconds: number;
  energyBurnedInKcal?: number;
  distanceInMeters?: number;
  zoneMinutes: {
    z1: number;
    z2: number;
    z3: number;
    z4: number;
    z5: number;
  };
  loadScore: number;
}

/**
 * Represents aggregated health metrics for a single day.
 */
export interface DailyMetrics {
  date: string; // YYYY-MM-DD
  sleepInMinutes?: number;
  restingHeartRate?: number;
  hrvSdn?: number;
}

/**
 * Represents the user's recovery state at a specific point in time.
 */
export interface RecoveryState {
  timestamp: string; // ISO 8601 string
  debtScore: number;
  recoveryHoursRemaining: number;
  readyForHardTrainingAt?: string; // ISO 8601 string
  status: 'green' | 'yellow' | 'red';
  explanationBreakdown?: {
    lastWorkoutLoad?: number;
    sleepModifier?: number;
    hrvModifier?: number;
    rhrModifier?: number;
    learningModifier?: number;
  };
}

/**
 * The overall state of the application's core data.
 */
export interface AppData {
  userProfile: UserProfile;
  workoutSummaries: WorkoutSummary[];
  dailyMetrics: DailyMetrics[];
  lastRecoveryState: RecoveryState;
}
