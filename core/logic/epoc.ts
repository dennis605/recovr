import { DailyMetrics, WorkoutSummary } from '../models/types';

export type EpocConfig = {
  a: number;
  fInt: number;
  vo2Max: number;
  k: number;
};

const DEFAULT_CONFIG: EpocConfig = {
  a: 3.5,
  fInt: 1.0,
  vo2Max: 40,
  k: 1.2,
};

const ZONE_INTENSITIES = {
  z1: 0.55,
  z2: 0.65,
  z3: 0.75,
  z4: 0.85,
  z5: 0.95,
};

const TYPE_INTENSITY: Record<string, number> = {
  running: 0.75,
  cycling: 0.7,
  swimming: 0.72,
  strength: 0.6,
  hiit: 0.85,
  walking: 0.55,
  default: 0.65,
};

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

const median = (values: number[]) => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

export const estimateIntensityRatio = (workout: WorkoutSummary) => {
  const minutes =
    workout.zoneMinutes.z1 +
    workout.zoneMinutes.z2 +
    workout.zoneMinutes.z3 +
    workout.zoneMinutes.z4 +
    workout.zoneMinutes.z5;

  if (minutes > 0) {
    const weighted =
      workout.zoneMinutes.z1 * ZONE_INTENSITIES.z1 +
      workout.zoneMinutes.z2 * ZONE_INTENSITIES.z2 +
      workout.zoneMinutes.z3 * ZONE_INTENSITIES.z3 +
      workout.zoneMinutes.z4 * ZONE_INTENSITIES.z4 +
      workout.zoneMinutes.z5 * ZONE_INTENSITIES.z5;
    return clamp(weighted / minutes, 0.4, 1.0);
  }

  const key = workout.type?.toLowerCase() ?? 'default';
  return TYPE_INTENSITY[key] ?? TYPE_INTENSITY.default;
};

export const estimateEpocTotal = (
  workout: WorkoutSummary,
  config: EpocConfig = DEFAULT_CONFIG
) => {
  const durationMinutes = workout.durationInSeconds / 60;
  if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
    return 0;
  }
  const intensityRatio = estimateIntensityRatio(workout);
  const epocPerMinute = config.fInt * Math.exp(config.a * intensityRatio);
  return durationMinutes * epocPerMinute;
};

export const estimateRecoveryHoursAdded = (
  workout: WorkoutSummary,
  config: EpocConfig = DEFAULT_CONFIG
) => {
  const epocTotal = estimateEpocTotal(workout, config);
  if (config.vo2Max <= 0 || config.k <= 0) {
    return 0;
  }
  return epocTotal / (config.vo2Max * config.k);
};

export const estimateRecoveryHoursTotal = (
  workouts: WorkoutSummary[],
  since: Date,
  config: EpocConfig = DEFAULT_CONFIG
) => {
  return workouts
    .filter(w => new Date(w.endTime) >= since)
    .reduce((sum, workout) => sum + estimateRecoveryHoursAdded(workout, config), 0);
};

export const estimateRecoveryRemaining = (
  workouts: WorkoutSummary[],
  since: Date,
  modifier: number,
  config: EpocConfig = DEFAULT_CONFIG
) => {
  const nowMs = Date.now();
  return workouts
    .filter(w => new Date(w.endTime) >= since)
    .reduce((sum, workout) => {
      const added = estimateRecoveryHoursAdded(workout, config);
      const endMs = new Date(workout.endTime).getTime();
      if (!Number.isFinite(endMs)) {
        return sum;
      }
      const hoursSince = Math.max(0, (nowMs - endMs) / (1000 * 60 * 60));
      return sum + Math.max(0, added - hoursSince * modifier);
    }, 0);
};

export const getLatestWorkoutEnd = (workouts: WorkoutSummary[], since: Date) => {
  const recent = workouts.filter(w => new Date(w.endTime) >= since);
  if (recent.length === 0) return null;
  return recent
    .map(w => new Date(w.endTime))
    .filter(date => Number.isFinite(date.getTime()))
    .sort((a, b) => b.getTime() - a.getTime())[0];
};

export const calculateRecoveryModifier = (
  dailyMetrics: DailyMetrics[],
  workoutSummaries: WorkoutSummary[]
) => {
  const recentMetrics = dailyMetrics.slice(-7);
  const latest = recentMetrics[recentMetrics.length - 1];

  const sleepBaseline = median(
    recentMetrics.map(m => m.sleepInMinutes).filter(Boolean) as number[]
  );
  const hrvBaseline = median(
    recentMetrics.map(m => m.hrvSdn).filter(Boolean) as number[]
  );
  const rhrBaseline = median(
    recentMetrics.map(m => m.restingHeartRate).filter(Boolean) as number[]
  );

  const sleepMinutes = latest?.sleepInMinutes ?? 0;
  const hrv = latest?.hrvSdn ?? 0;
  const rhr = latest?.restingHeartRate ?? 0;

  let sleepFactor = 1.0;
  if (sleepBaseline > 0) {
    const sleepScore = (sleepMinutes / sleepBaseline) * 100;
    if (sleepScore >= 120) sleepFactor = 1.5;
    else if (sleepScore >= 100) sleepFactor = 1.2;
    else if (sleepScore < 70) sleepFactor = 0.5;
  }

  let hrvFactor = 1.0;
  if (hrvBaseline > 0) {
    if (hrv >= hrvBaseline * 1.05) hrvFactor = 1.2;
    else if (hrv <= hrvBaseline * 0.8) hrvFactor = 0.2;
  }

  let rhrFactor = 1.0;
  if (rhrBaseline > 0) {
    if (rhr <= rhrBaseline * 0.95) rhrFactor = 1.1;
    else if (rhr >= rhrBaseline * 1.05) rhrFactor = 0.8;
  }

  const now = new Date();
  const threeDaysAgo = new Date();
  threeDaysAgo.setDate(now.getDate() - 3);
  const recentLoad = workoutSummaries
    .filter(w => new Date(w.startTime) >= threeDaysAgo)
    .reduce((sum, w) => sum + (w.loadScore ?? 0), 0);
  const stressFactor = clamp(1 - recentLoad / 300, 0.2, 1);

  return {
    modifier: (sleepFactor + hrvFactor + rhrFactor + stressFactor) / 4,
    sleepFactor,
    hrvFactor,
    rhrFactor,
    stressFactor,
    recentLoad: Math.round(recentLoad),
  };
};
