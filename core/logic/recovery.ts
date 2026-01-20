// core/logic/recovery.ts

import { DailyMetrics, RecoveryState, WorkoutSummary } from '../models/types';

// --- Constants (as defined by the Data Scientist) ---

const HR_ZONE_WEIGHTS = {
  z1: 1.0,
  z2: 2.0,
  z3: 3.0,
  z4: 5.0,
  z5: 8.0,
};

export const BASE_RECOVERY_RATE_PER_HOUR = 6.0; // Load points recovered per hour under ideal conditions

const MODIFIERS = {
  SLEEP: {
    GOOD_THRESHOLD_RATIO: 1.0,
    POOR_THRESHOLD_RATIO: 0.8,
    GOOD_MODIFIER: 1.15,
    POOR_MODIFIER: 0.85,
  },
  HRV: {
    HIGH_THRESHOLD_RATIO: 1.1,
    LOW_THRESHOLD_RATIO: 0.9,
    HIGH_MODIFIER: 1.1,
    LOW_MODIFIER: 0.9,
  },
  RHR: {
    HIGH_THRESHOLD_RATIO: 1.05,
    LOW_THRESHOLD_RATIO: 0.95,
    HIGH_MODIFIER: 0.9, // High RHR is bad for recovery
    LOW_MODIFIER: 1.05,
    NORMAL_MODIFIER: 1.0,
  },
};

const LEARNING_PHASE_DAYS = 7;
const LEARNING_PHASE_RECOVERY_MODIFIER = 1.15;

export const DEBT_THRESHOLDS = {
  RED: 25,
  YELLOW: 10,
};

// --- Core Functions ---

/**
 * Calculates the load score for a given workout based on time in HR zones.
 * @param zoneMinutes - An object with minutes spent in each of the 5 HR zones.
 * @returns The calculated load score.
 */
export function calculateWorkoutLoad(zoneMinutes: WorkoutSummary['zoneMinutes']): number {
  let totalLoad = 0;
  totalLoad += zoneMinutes.z1 * HR_ZONE_WEIGHTS.z1;
  totalLoad += zoneMinutes.z2 * HR_ZONE_WEIGHTS.z2;
  totalLoad += zoneMinutes.z3 * HR_ZONE_WEIGHTS.z3;
  totalLoad += zoneMinutes.z4 * HR_ZONE_WEIGHTS.z4;
  totalLoad += zoneMinutes.z5 * HR_ZONE_WEIGHTS.z5;
  return totalLoad;
}

/**
 * Calculates the new recovery state by applying a workout and then calculating hourly decay.
 * @param previousState - The last known recovery state.
 * @param newWorkout - The new workout to add to the debt. (Optional)
 * @param dailyMetrics - Today's and historical daily metrics for baseline calculation.
 * @returns The new, updated recovery state.
 */
export function calculateNewRecoveryState(
  previousState: RecoveryState,
  dailyMetrics: DailyMetrics[],
  newWorkout?: WorkoutSummary
): RecoveryState {
  // 1. Calculate time passed since last update
  const now = new Date();
  const lastUpdate = new Date(previousState.timestamp);
  const hoursPassed = Math.max(0, (now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60));

  // 2. Establish Baselines from the last 28 days of metrics
  const relevantMetrics = dailyMetrics.slice(-28);
  const median = (arr: number[]) => {
    if (arr.length === 0) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  };
  
  const sleepBaseline = median(relevantMetrics.map(m => m.sleepInMinutes).filter(Boolean) as number[]);
  const hrvBaseline = median(relevantMetrics.map(m => m.hrvSdn).filter(Boolean) as number[]);
  const rhrBaseline = median(relevantMetrics.map(m => m.restingHeartRate).filter(Boolean) as number[]);

  // 3. Determine Modifiers based on the latest daily metric
  const latestMetrics = dailyMetrics[dailyMetrics.length - 1];
  let sleepModifier = 1.0;
  let hrvModifier = 1.0;
  let rhrModifier = 1.0;
  let learningModifier = 1.0;
  
  if (latestMetrics?.sleepInMinutes && sleepBaseline > 0) {
    if (latestMetrics.sleepInMinutes >= sleepBaseline * MODIFIERS.SLEEP.GOOD_THRESHOLD_RATIO) {
      sleepModifier = MODIFIERS.SLEEP.GOOD_MODIFIER;
    } else if (latestMetrics.sleepInMinutes < sleepBaseline * MODIFIERS.SLEEP.POOR_THRESHOLD_RATIO) {
      sleepModifier = MODIFIERS.SLEEP.POOR_MODIFIER;
    }
  }
  if (latestMetrics?.hrvSdn && hrvBaseline > 0) {
    if (latestMetrics.hrvSdn > hrvBaseline * MODIFIERS.HRV.HIGH_THRESHOLD_RATIO) {
      hrvModifier = MODIFIERS.HRV.HIGH_MODIFIER;
    } else if (latestMetrics.hrvSdn < hrvBaseline * MODIFIERS.HRV.LOW_THRESHOLD_RATIO) {
      hrvModifier = MODIFIERS.HRV.LOW_MODIFIER;
    }
  }
  if (latestMetrics?.restingHeartRate && rhrBaseline > 0) {
    if (latestMetrics.restingHeartRate > rhrBaseline * MODIFIERS.RHR.HIGH_THRESHOLD_RATIO) {
      rhrModifier = MODIFIERS.RHR.HIGH_MODIFIER;
    } else if (latestMetrics.restingHeartRate < rhrBaseline * MODIFIERS.RHR.LOW_THRESHOLD_RATIO) {
      rhrModifier = MODIFIERS.RHR.LOW_MODIFIER;
    }
  }

  // 4. Calculate recovered debt
  if (dailyMetrics.length > 0 && dailyMetrics.length < LEARNING_PHASE_DAYS) {
    learningModifier = LEARNING_PHASE_RECOVERY_MODIFIER;
  }

  const effectiveRecoveryRate = BASE_RECOVERY_RATE_PER_HOUR * sleepModifier * hrvModifier * rhrModifier * learningModifier;
  const recoveredDebt = hoursPassed * effectiveRecoveryRate;
  let currentDebt = Math.max(0, previousState.debtScore - recoveredDebt);

  // 5. Add new workout load, if any
  let workoutLoad = 0;
  if (newWorkout) {
    workoutLoad = newWorkout.loadScore;
    currentDebt += workoutLoad;
  }

  // 6. Calculate new output values
  const hardTrainingDebt = Math.max(0, currentDebt - DEBT_THRESHOLDS.YELLOW);
  const recoveryHoursRemaining = hardTrainingDebt / effectiveRecoveryRate;

  let readyForHardTrainingAt: string | undefined;
  if (recoveryHoursRemaining > 0) {
    const readyDate = new Date(now.getTime() + recoveryHoursRemaining * 60 * 60 * 1000);
    readyForHardTrainingAt = readyDate.toISOString();
  }

  // 7. Determine status
  let status: RecoveryState['status'];
  if (currentDebt <= DEBT_THRESHOLDS.YELLOW) {
    status = 'green';
  } else if (currentDebt <= DEBT_THRESHOLDS.RED) {
    status = 'yellow';
  } else {
    status = 'red';
  }

  return {
    timestamp: now.toISOString(),
    debtScore: currentDebt,
    recoveryHoursRemaining,
    readyForHardTrainingAt,
    status,
    explanationBreakdown: {
      lastWorkoutLoad: newWorkout ? newWorkout.loadScore : undefined,
      sleepModifier,
      hrvModifier,
      rhrModifier,
      learningModifier,
    },
  };
}
